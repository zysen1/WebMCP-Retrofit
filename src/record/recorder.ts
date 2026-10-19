// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import * as esbuild from 'esbuild'
import type { Page } from 'playwright'
import type { FlowAction, FormSnapshot, NetRecord, Recording, RecordStep } from '../types.ts'

let tapBundle: string | undefined

export async function transportTapScript(): Promise<string> {
  if (tapBundle) return tapBundle
  const runtimeDir = new URL('../runtime/', import.meta.url)
  const result = await esbuild.build({
    stdin: {
      contents: `import { installTransportTap } from './browser.ts'\ninstallTransportTap()\n`,
      resolveDir: new URL('.', runtimeDir).pathname,
      sourcefile: 'tap-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    target: 'es2022',
  })
  const output = result.outputFiles[0]
  if (!output) throw new Error('Failed to bundle the transport tap')
  tapBundle = output.text
  return tapBundle
}

export async function settle(page: Page, pendingReads: { count: number }): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)))
  await page.waitForFunction(() => {
    const retro = window as Window & { __retrofitInflight?: number }
    return (retro.__retrofitInflight ?? 0) === 0
  })
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)))
  const started = Date.now()
  while (pendingReads.count > 0 && Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

export async function perform(page: Page, action: FlowAction, pendingReads: { count: number }): Promise<void> {
  const locator = page.locator(action.selector)
  if (action.type === 'fill') {
    await locator.fill(action.value ?? '')
  } else if (action.type === 'select') {
    await locator.selectOption(action.value ?? '')
  } else if (action.type === 'check') {
    await locator.check()
  } else {
    await locator.click()
  }
  await settle(page, pendingReads)
}

export async function snapshotForms(page: Page): Promise<FormSnapshot[]> {
  return page.evaluate(() => {
    return [...document.forms].map((form) => {
      const fields = [...form.elements].flatMap((element) => {
        if (
          !(
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
          )
        ) {
          return []
        }
        if (!element.name || element.type === 'submit' || element.type === 'button') return []
        const labelText = [...(element.labels ?? [])]
          .map((label) => label.innerText.trim())
          .find((text) => text.length > 0)
        const options =
          element instanceof HTMLSelectElement
            ? [...element.options]
                .filter((option) => option.value !== '')
                .map((option) => ({ value: option.value, label: option.label }))
            : undefined
        return [
          {
            name: element.name,
            tag: element.tagName.toLowerCase(),
            type: element instanceof HTMLTextAreaElement ? 'textarea' : element.type || 'text',
            required: element.required,
            label: labelText || element.getAttribute('aria-label') || element.name,
            options,
            value: element instanceof HTMLInputElement && element.type === 'checkbox' ? String(element.checked) : element.value,
            min: element.getAttribute('min'),
            max: element.getAttribute('max'),
            valueType: element.getAttribute('data-value-type'),
          },
        ]
      })
      return {
        selector: form.id ? `#${CSS.escape(form.id)}` : 'form',
        id: form.id,
        toolTitle: form.getAttribute('data-tool-title') || '',
        submitLabel: form.querySelector('button[type="submit"]')?.textContent?.trim() || '',
        resultTarget: form.getAttribute('data-result') || '',
        fields,
      }
    })
  })
}

export async function recordFlow(page: Page, siteId: string, flow: FlowAction[]): Promise<Recording> {
  const requests: NetRecord[] = []
  const pendingReads = { count: 0 }
  let currentStep = -1
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/')) return
    const afterStep = currentStep
    pendingReads.count += 1
    void (async () => {
      try {
        const request = response.request()
        const header = request.headers()['x-retrofit-transport']
        let responseBody = ''
        try {
          responseBody = await response.text()
        } catch {
          responseBody = ''
        }
        requests.push({
          afterStep,
          transport: header === 'xhr' ? 'xhr' : 'fetch',
          method: request.method(),
          pathname: url.pathname,
          search: url.search,
          requestBody: request.postData() ?? null,
          status: response.status(),
          responseBody,
        })
      } finally {
        pendingReads.count -= 1
      }
    })()
  })

  const steps: RecordStep[] = []
  for (let index = 0; index < flow.length; index += 1) {
    const action = flow[index]
    if (!action) continue
    currentStep = index
    await perform(page, action, pendingReads)
    steps.push({
      index,
      action,
      title: await page.title(),
      forms: await snapshotForms(page),
    })
  }
  return {
    siteId,
    startedAt: new Date().toISOString(),
    steps,
    requests,
  }
}
