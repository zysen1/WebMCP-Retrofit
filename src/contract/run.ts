// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { readFileSync } from 'node:fs'
import { chromium, type Browser, type Page } from 'playwright'
import type { ContractCheck, ContractReport, DerivedTool, JsonSchemaProperty } from '../types.ts'
import { startSiteById } from '../sites/server.ts'

interface ContractFile {
  siteId: string
  tools: DerivedTool[]
}

function check(id: string, pass: boolean, detail: string): ContractCheck {
  return { id, pass, detail }
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const values = new Set(left)
  return right.every((item) => values.has(item))
}

function propertyMismatch(actual: JsonSchemaProperty | undefined, expected: JsonSchemaProperty): string | null {
  if (!actual) return 'missing property'
  if (actual.type !== expected.type) return `type ${actual.type} != ${expected.type}`
  if (expected.format && actual.format !== expected.format) return `format ${actual.format} != ${expected.format}`
  if (expected.enum) {
    if (!actual.enum || !sameSet(actual.enum, expected.enum)) return 'enum mismatch'
  }
  if (expected.minimum != null && actual.minimum !== expected.minimum) return 'minimum mismatch'
  if (expected.maximum != null && actual.maximum !== expected.maximum) return 'maximum mismatch'
  return null
}

export async function executeContract(
  siteId: string,
  tools: DerivedTool[],
  injectJs: string,
  browser?: Browser,
): Promise<ContractReport> {
  const running = await startSiteById(siteId)
  const owned = browser ? null : await chromium.launch({ headless: true })
  const active = browser ?? owned
  if (!active) throw new Error('Browser failed to launch')
  const checks: ContractCheck[] = []
  try {
    const context = await active.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(7000)
    await page.addInitScript({ content: injectJs })
    await page.goto(running.url, { waitUntil: 'load' })
    await page.waitForFunction(() => Boolean(window.__retrofitReady))
    await page.evaluate(() => window.__retrofitReady)
    const discovered = await page.evaluate(async () => {
      const modelContext = document.modelContext
      if (!modelContext) return { error: 'document.modelContext is missing', tools: [] }
      const listed = await modelContext.getTools()
      return {
        error: '',
        tools: listed.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        })),
      }
    })
    checks.push(check(`${siteId}:context`, discovered.error === '', discovered.error || 'document.modelContext is installed'))
    const byName = new Map(discovered.tools.map((tool) => [tool.name, tool]))
    for (const tool of tools) {
      const live = byName.get(tool.name)
      checks.push(check(`${tool.name}:registered`, Boolean(live), live ? 'registered' : 'not registered'))
      if (!live) continue
      checks.push(
        check(
          `${tool.name}:description`,
          typeof live.description === 'string' && live.description.length > 0,
          live.description,
        ),
      )
      const schema = live.inputSchema as {
        type?: string
        properties?: Record<string, JsonSchemaProperty>
        required?: string[]
      }
      checks.push(check(`${tool.name}:schema-type`, schema?.type === 'object', `type=${schema?.type}`))
      checks.push(
        check(
          `${tool.name}:required`,
          sameSet(schema?.required ?? [], tool.inputSchema.required),
          `required=${(schema?.required ?? []).join(',')}`,
        ),
      )
      const propertyErrors: string[] = []
      for (const [name, expected] of Object.entries(tool.inputSchema.properties)) {
        const mismatch = propertyMismatch(schema?.properties?.[name], expected)
        if (mismatch) propertyErrors.push(`${name}: ${mismatch}`)
      }
      checks.push(
        check(`${tool.name}:properties`, propertyErrors.length === 0, propertyErrors.join('; ') || 'properties match'),
      )
      const annotations = live.annotations as Record<string, boolean>
      const annotationOk =
        annotations?.readOnlyHint === tool.annotations.readOnlyHint &&
        annotations?.untrustedContentHint === tool.annotations.untrustedContentHint &&
        annotations?.consequentialHint === tool.annotations.consequentialHint &&
        annotations?.debugging === tool.annotations.debugging
      checks.push(check(`${tool.name}:annotations`, annotationOk, JSON.stringify(annotations)))
      checks.push(await runExample(page, tool))
      checks.push(await runEmpty(page, tool))
    }
    await context.close()
  } finally {
    if (owned) await owned.close()
    await running.close()
  }
  const failed = checks.filter((item) => !item.pass).length
  return {
    siteId,
    toolNames: tools.map((tool) => tool.name),
    checks,
    passed: checks.length - failed,
    failed,
  }
}

async function runExample(page: Page, tool: DerivedTool): Promise<ContractCheck> {
  const seen: { method: string; pathname: string; transport: string }[] = []
  const onRequest = (request: { method: () => string; url: () => string; headers: () => Record<string, string> }) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return
    seen.push({
      method: request.method(),
      pathname: url.pathname,
      transport: request.headers()['x-retrofit-transport'] ?? '',
    })
  }
  page.on('request', onRequest)
  let result: { ok?: boolean; status?: number; data?: unknown; text?: string } | null = null
  let thrown = ''
  try {
    result = await page.evaluate(async ({ name, input }) => {
      const modelContext = document.modelContext
      if (!modelContext) throw new Error('missing modelContext')
      const tools = await modelContext.getTools()
      const match = tools.find((item) => item.name === name)
      if (!match) throw new Error(`missing tool ${name}`)
      return (await modelContext.executeTool(match, input)) as {
        ok?: boolean
        status?: number
        data?: unknown
        text?: string
      }
    }, { name: tool.name, input: tool.exampleInput })
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error)
  } finally {
    page.off('request', onRequest)
  }
  const network = seen.some(
    (item) =>
      item.method === tool.plan.expect.method &&
      item.pathname === tool.plan.expect.pathname &&
      item.transport === tool.plan.expect.transport,
  )
  const data = result?.data && typeof result.data === 'object' ? (result.data as Record<string, unknown>) : {}
  const keysOk = tool.plan.expect.responseKeys.every((key) => Object.prototype.hasOwnProperty.call(data, key))
  const uiOk = await page.evaluate((plan) => {
    if (plan.expect.ui === 'outcome') {
      const outcome = document.getElementById('outcome')
      return Boolean(outcome?.dataset.outcomeJson)
    }
    const region = document.getElementById(plan.resultTarget)
    return Boolean(region && region.childElementCount > 0)
  }, tool.plan)
  const pass =
    thrown === '' &&
    result?.ok === true &&
    result.status === tool.plan.expect.status &&
    keysOk &&
    network &&
    uiOk
  const detail = thrown || JSON.stringify({ status: result?.status, keys: Object.keys(data), network, uiOk, seen })
  return check(`${tool.name}:example`, pass, detail)
}

async function runEmpty(page: Page, tool: DerivedTool): Promise<ContractCheck> {
  if (tool.inputSchema.required.length === 0) {
    return check(`${tool.name}:rejects-empty`, true, 'no required inputs')
  }
  const outcome = await page.evaluate(async (name) => {
    const modelContext = document.modelContext
    if (!modelContext) return { threw: false, ok: false, message: 'missing modelContext' }
    const tools = await modelContext.getTools()
    const match = tools.find((item) => item.name === name)
    if (!match) return { threw: false, ok: false, message: 'missing tool' }
    try {
      const result = (await modelContext.executeTool(match, {})) as { ok?: boolean }
      return { threw: false, ok: result?.ok === true, message: '' }
    } catch (error) {
      return { threw: true, ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }, tool.name)
  const pass = outcome.threw || outcome.ok === false
  return check(`${tool.name}:rejects-empty`, pass, outcome.message || 'empty input was rejected')
}

export async function runGeneratedContract(contractUrl: URL): Promise<ContractReport> {
  const contract = JSON.parse(readFileSync(contractUrl, 'utf8')) as ContractFile
  const injectPath = new URL('./inject.js', contractUrl)
  const injectJs = readFileSync(injectPath, 'utf8')
  return executeContract(contract.siteId, contract.tools, injectJs)
}
