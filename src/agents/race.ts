// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import type { Browser, Page } from 'playwright'
import { perform } from '../record/recorder.ts'
import { shopOrder } from '../sites/goal.ts'
import { estimateImageTokens, estimateTextTokens, pngSize } from '../tokens.ts'
import type { AgentStep, AgentTrace, DerivedTool, FlowAction, PlacedOrder } from '../types.ts'

async function observationText(page: Page): Promise<string> {
  try {
    return await page.locator('body').ariaSnapshot()
  } catch {
    return page.locator('body').innerText()
  }
}

async function readOrder(page: Page): Promise<PlacedOrder | null> {
  return page.evaluate(() => {
    const node = document.getElementById('outcome')
    if (!node?.dataset.outcomeJson) return null
    return JSON.parse(node.dataset.outcomeJson) as PlacedOrder
  })
}

export async function runScreenshotAgent(page: Page, flow: FlowAction[]): Promise<AgentTrace> {
  await page.waitForSelector('#search-catalog')
  const pendingReads = { count: 0 }
  const steps: AgentStep[] = []
  const started = Date.now()
  for (const action of flow) {
    const shot = await page.screenshot({ type: 'png' })
    const size = pngSize(shot)
    const text = await observationText(page)
    const tokens = estimateImageTokens(size.width, size.height) + estimateTextTokens(text)
    steps.push({
      kind: 'screenshot',
      detail: `${size.width}x${size.height} plus accessibility text`,
      tokens,
    })
    await perform(page, action, pendingReads)
    steps.push({
      kind: action.type,
      detail: action.value ? `${action.selector} = ${action.value}` : action.selector,
      tokens: estimateTextTokens(JSON.stringify(action)),
    })
  }
  const finalShot = await page.screenshot({ type: 'png' })
  const finalSize = pngSize(finalShot)
  const finalText = await observationText(page)
  steps.push({
    kind: 'screenshot',
    detail: `confirmation ${finalSize.width}x${finalSize.height}`,
    tokens: estimateImageTokens(finalSize.width, finalSize.height) + estimateTextTokens(finalText),
  })
  const order = await readOrder(page)
  return {
    agent: 'screenshot',
    steps,
    estimatedTokens: steps.reduce((sum, step) => sum + step.tokens, 0),
    catalogTokens: 0,
    taskMs: Date.now() - started,
    screenshots: steps.filter((step) => step.kind === 'screenshot').length,
    toolCalls: 0,
    uiActions: steps.filter((step) => step.kind !== 'screenshot').length,
    order,
    toolOrder: null,
  }
}

function asOrder(value: unknown): PlacedOrder | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.sku !== 'string') return null
  return {
    id: record.id,
    sku: record.sku,
    qty: Number(record.qty),
    email: String(record.email),
    shipping: String(record.shipping),
    total: Number(record.total),
  }
}

export async function runWebmcpAgent(page: Page, tools: DerivedTool[]): Promise<AgentTrace> {
  await page.waitForSelector('#search-catalog')
  await page.waitForFunction(() => Boolean(window.__retrofitReady))
  await page.evaluate(() => window.__retrofitReady)
  const started = Date.now()
  const catalog = await page.evaluate(async () => {
    const modelContext = document.modelContext
    if (!modelContext) throw new Error('document.modelContext is missing')
    const listed = await modelContext.getTools()
    return listed.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }))
  })
  const catalogTokens = estimateTextTokens(JSON.stringify(catalog))
  const steps: AgentStep[] = []
  let toolOrder: PlacedOrder | null = null
  for (const tool of tools) {
    const result = await page.evaluate(async ({ name, input }) => {
      const modelContext = document.modelContext
      if (!modelContext) throw new Error('document.modelContext is missing')
      const listed = await modelContext.getTools()
      const match = listed.find((item) => item.name === name)
      if (!match) throw new Error(`Missing tool ${name}`)
      return (await modelContext.executeTool(match, input)) as {
        data?: { order?: unknown }
        text?: string
      }
    }, { name: tool.name, input: tool.exampleInput })
    const payload = result?.data?.order
    const parsed = asOrder(payload)
    if (parsed) toolOrder = parsed
    steps.push({
      kind: 'tool_call',
      detail: tool.name,
      tokens: estimateTextTokens(JSON.stringify(tool.exampleInput)) + estimateTextTokens(JSON.stringify(result)),
    })
  }
  const order = await readOrder(page)
  return {
    agent: 'webmcp',
    steps,
    estimatedTokens: catalogTokens + steps.reduce((sum, step) => sum + step.tokens, 0),
    catalogTokens,
    taskMs: Date.now() - started,
    screenshots: 0,
    toolCalls: steps.length,
    uiActions: 0,
    order,
    toolOrder,
  }
}

export async function raceShop(options: {
  browser: Browser
  url: string
  flow: FlowAction[]
  tools: DerivedTool[]
  tapJs: string
  injectJs: string
}): Promise<{ screenshot: AgentTrace; webmcp: AgentTrace }> {
  const screenshotContext = await options.browser.newContext({ viewport: { width: 1280, height: 720 } })
  const webmcpContext = await options.browser.newContext({ viewport: { width: 1280, height: 720 } })
  try {
    const screenshotPage = await screenshotContext.newPage()
    const webmcpPage = await webmcpContext.newPage()
    screenshotPage.setDefaultTimeout(7000)
    webmcpPage.setDefaultTimeout(7000)
    await screenshotPage.addInitScript({ content: options.tapJs })
    await webmcpPage.addInitScript({ content: options.injectJs })
    await Promise.all([
      screenshotPage.goto(options.url, { waitUntil: 'load' }),
      webmcpPage.goto(options.url, { waitUntil: 'load' }),
    ])
    const [screenshot, webmcp] = await Promise.all([
      runScreenshotAgent(screenshotPage, options.flow),
      runWebmcpAgent(webmcpPage, options.tools),
    ])
    if (!screenshot.order || !webmcp.order) {
      throw new Error(
        `Race did not place both orders (screenshot=${JSON.stringify(screenshot.order)}, webmcp=${JSON.stringify(webmcp.order)})`,
      )
    }
    if (screenshot.order.sku !== shopOrder.sku || webmcp.order.sku !== shopOrder.sku) {
      throw new Error('Race orders did not keep the recorded sku')
    }
    return { screenshot, webmcp }
  } finally {
    await screenshotContext.close()
    await webmcpContext.close()
  }
}
