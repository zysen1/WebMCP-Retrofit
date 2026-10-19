// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { bundleSnippet } from './bundle.ts'
import { executeContract } from './contract/run.ts'
import { deriveTools } from './derive/derive.ts'
import { contractDocument, emitContractTest, emitSnippet } from './derive/emit.ts'
import { raceShop } from './agents/race.ts'
import { recordFlow, transportTapScript } from './record/recorder.ts'
import { renderReport, type MeasuredResults } from './report/render.ts'
import { shopOrder } from './sites/goal.ts'
import { sites } from './sites/definitions.ts'
import { startSite } from './sites/server.ts'
import { WEBMCP_PIN } from './spec-pin.ts'
import type { ContractReport, DerivedTool, Recording } from './types.ts'

export interface PipelineOutput {
  results: MeasuredResults
  recordings: Recording[]
  tools: Record<string, DerivedTool[]>
}

export async function runPipeline(root: string): Promise<PipelineOutput> {
  const browser = await chromium.launch({ headless: true })
  const tapJs = await transportTapScript()
  const recordings: Recording[] = []
  const tools: Record<string, DerivedTool[]> = {}
  const reports: ContractReport[] = []
  try {
    for (const site of sites) {
      const running = await startSite(site)
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        const page = await context.newPage()
        page.setDefaultTimeout(7000)
        await page.addInitScript({ content: tapJs })
        await page.goto(running.url, { waitUntil: 'load' })
        const recording = await recordFlow(page, site.id, site.flow)
        recordings.push(recording)
        const derived = deriveTools(recording)
        tools[site.id] = derived
        const dir = join(root, 'generated', site.id)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'recording.json'), JSON.stringify(recording, null, 2))
        writeFileSync(join(dir, 'contract.json'), JSON.stringify(contractDocument(site.id, derived), null, 2))
        writeFileSync(join(dir, 'inject.ts'), emitSnippet(site.id, derived))
        writeFileSync(join(dir, 'contract.test.ts'), emitContractTest(site.id, derived.map((tool) => tool.name)))
        const injectJs = await bundleSnippet(join(dir, 'inject.ts'))
        writeFileSync(join(dir, 'inject.js'), injectJs)
      } finally {
        await context.close()
        await running.close()
      }
    }

    for (const site of sites) {
      const derived = tools[site.id]
      if (!derived) throw new Error(`Missing tools for ${site.id}`)
      const injectJs = await bundleSnippet(join(root, 'generated', site.id, 'inject.ts'))
      const report = await executeContract(site.id, derived, injectJs, browser)
      reports.push(report)
      if (report.failed > 0) {
        const failed = report.checks.filter((item) => !item.pass)
        console.error(`${site.id} contract failures:\n${failed.map((item) => `${item.id}: ${item.detail}`).join('\n')}`)
      }
    }

    const shop = sites[0]
    if (!shop || shop.id !== 'shop') throw new Error('Shop site is not first')
    const shopTools = tools.shop
    if (!shopTools) throw new Error('Shop tools were not derived')
    const running = await startSite(shop)
    let race: Awaited<ReturnType<typeof raceShop>>
    try {
      race = await raceShop({
        browser,
        url: running.url,
        flow: shop.flow,
        tools: shopTools,
        tapJs,
        injectJs: await bundleSnippet(join(root, 'generated', 'shop', 'inject.ts')),
      })
    } finally {
      await running.close()
    }

    const checks = reports.reduce((sum, report) => sum + report.checks.length, 0)
    const passed = reports.reduce((sum, report) => sum + report.passed, 0)
    const failed = reports.reduce((sum, report) => sum + report.failed, 0)
    const results: MeasuredResults = {
      measuredAt: new Date().toISOString(),
      dataset: 'bundled local demo sites: shop, library, support, booking, pantry',
      specPin: WEBMCP_PIN,
      contracts: {
        checks,
        passed,
        failed,
        passRate: checks === 0 ? 0 : passed / checks,
        bySite: reports.map((report) => ({
          siteId: report.siteId,
          tools: report.toolNames.length,
          checks: report.checks.length,
          passed: report.passed,
          failed: report.failed,
          passRate: report.checks.length === 0 ? 0 : report.passed / report.checks.length,
        })),
      },
      race: {
        goal: { sku: shopOrder.sku, qty: shopOrder.qty, email: shopOrder.email },
        counting:
          'A screenshot-and-click step is one captured screenshot or one UI action. A WebMCP step is one tool call. Tool-catalog tokens are included in the WebMCP total and are not an extra step.',
        tokenModel:
          'Text tokens are ceil(chars / 4). Screenshot tokens use the published gpt-4o tile count (85 + 170 per 512px tile after the 2048/768 rescale) plus the accessibility-tree text. These are estimates, not a provider bill.',
        screenshot: race.screenshot,
        webmcp: race.webmcp,
      },
      realLlmComparison: 'WIP',
    }
    const docs = join(root, 'docs')
    mkdirSync(docs, { recursive: true })
    writeFileSync(join(docs, 'results.json'), JSON.stringify(results, null, 2))
    const html = renderReport(results)
    const reportPath = join(docs, 'race-report.html')
    writeFileSync(reportPath, html)
    const shotPage = await browser.newPage({ viewport: { width: 1120, height: 1120 } })
    await shotPage.goto(pathToFileURL(reportPath).href, { waitUntil: 'load' })
    const pngPath = join(docs, 'race-report.png')
    await shotPage.screenshot({ path: pngPath })
    await shotPage.close()
    return { results, recordings, tools }
  } finally {
    await browser.close()
  }
}

export function repoRootFrom(importUrl: string): string {
  return fileURLToPath(new URL('..', importUrl))
}
