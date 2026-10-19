// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createModelContext,
  installDocumentModelContext,
  type ModelContext,
} from '../../src/polyfill/model-context.ts'

test('modelContext registers, lists, executes, and unregisters on abort', async () => {
  const context = createModelContext('http://127.0.0.1')
  const events: string[] = []
  context.addEventListener('toolchange', () => events.push('toolchange'))
  const controller = new AbortController()
  await context.registerTool(
    {
      name: 'zeta',
      description: 'Second tool',
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true },
      execute(input) {
        return { input }
      },
    },
    { signal: controller.signal },
  )
  await context.registerTool({
    name: 'alpha',
    title: 'Alpha',
    description: 'First tool',
    execute(_input, options) {
      return options?.signal?.aborted === true ? 'aborted' : 'ran'
    },
  })
  const tools = await context.getTools()
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['alpha', 'zeta'],
  )
  assert.equal(tools[1]?.annotations.readOnlyHint, true)
  assert.equal(tools[1]?.annotations.consequentialHint, false)
  const zeta = tools.find((tool) => tool.name === 'zeta')
  assert.ok(zeta)
  assert.deepEqual(await context.executeTool(zeta, { q: 'cedar' }), { input: { q: 'cedar' } })
  controller.abort()
  const after = await context.getTools()
  assert.deepEqual(
    after.map((tool) => tool.name),
    ['alpha'],
  )
  assert.deepEqual(events, ['toolchange', 'toolchange', 'toolchange'])
})

test('installDocumentModelContext does not create navigator.modelContext', () => {
  const doc: { modelContext?: ModelContext; location: { origin: string } } = { location: { origin: 'http://demo.local' } }
  const navigatorStandIn: { modelContext?: unknown } = {}
  const installed = installDocumentModelContext(doc)
  assert.equal(doc.modelContext, installed)
  assert.equal(installDocumentModelContext(doc), installed)
  assert.equal(navigatorStandIn.modelContext, undefined)
})

test('cross-origin exposure and duplicate names are rejected', async () => {
  const context = createModelContext()
  await assert.rejects(
    context.registerTool(
      { name: 'ok', description: 'ok', execute() { return null } },
      { exposedTo: ['https://other.example'] },
    ),
    /NotSupportedError|not supported/i,
  )
  await context.registerTool({ name: 'ok', description: 'ok', execute() { return null } })
  await assert.rejects(
    context.registerTool({ name: 'ok', description: 'ok again', execute() { return null } }),
    /already registered/,
  )
  await assert.rejects(context.getTools({ fromOrigins: ['https://other.example'] }), /NotSupportedError|not supported/i)
})
