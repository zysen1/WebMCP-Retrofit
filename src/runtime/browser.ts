// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { installDocumentModelContext, type ModelContext } from '../polyfill/model-context.ts'

export { installDocumentModelContext }
import type { DerivedTool, ToolPlan } from '../types.ts'

interface RetrofitWindow extends Window {
  __retrofitTap?: boolean
  __retrofitInflight?: number
}

interface TransportDetail {
  transport: 'fetch' | 'xhr'
  method: string
  pathname: string
  status: number
  data: unknown
}

interface MarkedXhr extends XMLHttpRequest {
  __rf?: { method: string; url: string; pathname?: string }
}

export function installTransportTap(): void {
  const w = window as RetrofitWindow
  if (w.__retrofitTap) return
  w.__retrofitTap = true
  w.__retrofitInflight = 0

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, location.href)
    const track = url.pathname.startsWith('/api/')
    if (track) w.__retrofitInflight = (w.__retrofitInflight ?? 0) + 1
    try {
      const response = await originalFetch(input, init)
      if (track) {
        const text = await response.clone().text()
        let data: unknown = text
        try {
          data = JSON.parse(text) as unknown
        } catch {
          // Keep the raw body when it is not JSON.
        }
        window.dispatchEvent(
          new CustomEvent('retrofit:response', {
            detail: {
              transport: 'fetch',
              method,
              pathname: url.pathname,
              status: response.status,
              data,
            } satisfies TransportDetail,
          }),
        )
      }
      return response
    } finally {
      if (track) w.__retrofitInflight = Math.max(0, (w.__retrofitInflight ?? 1) - 1)
    }
  }

  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (
    this: MarkedXhr,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    this.__rf = { method: String(method).toUpperCase(), url: String(url) }
    return originalOpen.call(this, method, url, async ?? true, username, password)
  }
  XMLHttpRequest.prototype.send = function (this: MarkedXhr, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = this.__rf
    let track = false
    if (meta) {
      try {
        const url = new URL(meta.url, location.href)
        meta.pathname = url.pathname
        track = url.pathname.startsWith('/api/')
      } catch {
        track = false
      }
    }
    if (track) w.__retrofitInflight = (w.__retrofitInflight ?? 0) + 1
    this.addEventListener('loadend', () => {
      if (!track || !meta?.pathname) return
      w.__retrofitInflight = Math.max(0, (w.__retrofitInflight ?? 1) - 1)
      let data: unknown = this.responseText
      try {
        data = JSON.parse(this.responseText) as unknown
      } catch {
        // Keep the raw body when it is not JSON.
      }
      window.dispatchEvent(
        new CustomEvent('retrofit:response', {
          detail: {
            transport: 'xhr',
            method: meta.method,
            pathname: meta.pathname,
            status: this.status,
            data,
          } satisfies TransportDetail,
        }),
      )
    })
    return originalSend.call(this, body)
  }
}

function waitForApi(method: string, pathname: string, signal?: AbortSignal): Promise<TransportDetail> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for ${method} ${pathname}`))
    }, 5000)
    const onAbort = () => {
      cleanup()
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    const onResponse = (event: Event) => {
      const detail = (event as CustomEvent<TransportDetail>).detail
      if (!detail || detail.method !== method || detail.pathname !== pathname) return
      cleanup()
      // Let the page's own submit handler render before the tool resolves.
      setTimeout(() => resolve(detail), 0)
    }
    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener('retrofit:response', onResponse)
      signal?.removeEventListener('abort', onAbort)
    }
    if (signal?.aborted) {
      cleanup()
      reject(new DOMException('The operation was aborted.', 'AbortError'))
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    window.addEventListener('retrofit:response', onResponse)
  })
}

export async function executeRecordedForm(
  plan: ToolPlan,
  input: unknown,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
  const form = document.querySelector(plan.formSelector)
  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`Recorded form ${plan.formSelector} is not on this page`)
  }
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  for (const field of plan.fields) {
    const value = record[field.name]
    const missing = value === undefined || value === null || value === ''
    if (missing) {
      if (field.required) throw new Error(`Missing required input ${field.name}`)
      continue
    }
    const control = form.elements.namedItem(field.name)
    if (
      !control ||
      control instanceof RadioNodeList ||
      !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
    ) {
      throw new Error(`Missing control ${field.name} in ${plan.formSelector}`)
    }
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.checked = value === true || value === 'true' || value === 'on' || value === 1
    } else {
      control.value = String(value)
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const pending = waitForApi(plan.expect.method, plan.expect.pathname, signal)
  form.requestSubmit()
  const detail = await pending
  return {
    ok: detail.status >= 200 && detail.status < 300,
    status: detail.status,
    data: detail.data,
    text: JSON.stringify(detail.data),
  }
}

export async function registerDerivedTools(
  tools: DerivedTool[],
  modelContext: ModelContext,
): Promise<void> {
  for (const tool of tools) {
    const plan = tool.plan
    await modelContext.registerTool(
      {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
        annotations: tool.annotations,
        async execute(input, options) {
          return executeRecordedForm(plan, input, options?.signal)
        },
      },
      {},
    )
  }
}

export async function installAndRegister(tools: DerivedTool[]): Promise<ModelContext> {
  installTransportTap()
  const modelContext = installDocumentModelContext(document)
  await registerDerivedTools(tools, modelContext)
  return modelContext
}
