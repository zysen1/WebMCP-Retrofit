// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveTools } from '../../src/derive/derive.ts'
import { emitSnippet } from '../../src/derive/emit.ts'
import { WEBMCP_PIN } from '../../src/spec-pin.ts'
import type { Recording } from '../../src/types.ts'

const recording: Recording = {
  siteId: 'fixture',
  startedAt: '2026-10-19T00:00:00.000Z',
  steps: [
    {
      index: 0,
      action: { type: 'click', selector: '#search-catalog button[type=submit]' },
      title: 'Northwind Nook',
      forms: [
        {
          selector: '#search-catalog',
          id: 'search-catalog',
          toolTitle: 'Search catalog',
          submitLabel: 'Search',
          resultTarget: 'search-results',
          fields: [
            {
              name: 'q',
              tag: 'input',
              type: 'search',
              required: true,
              label: 'Search',
              value: 'cedar',
            },
            {
              name: 'category',
              tag: 'select',
              type: 'select-one',
              required: true,
              label: 'Category',
              value: 'drinkware',
              options: [
                { value: 'drinkware', label: 'Drinkware' },
                { value: 'textiles', label: 'Textiles' },
              ],
            },
          ],
        },
      ],
    },
    {
      index: 1,
      action: { type: 'click', selector: '#place-order button[type=submit]' },
      title: 'Northwind Nook',
      forms: [
        {
          selector: '#place-order',
          id: 'place-order',
          toolTitle: 'Place order',
          submitLabel: 'Place order',
          resultTarget: 'outcome',
          fields: [
            { name: 'email', tag: 'input', type: 'email', required: true, label: 'Email', value: 'ada@analytical.example' },
            { name: 'qty', tag: 'input', type: 'hidden', required: true, label: 'Quantity', value: '2', valueType: 'number' },
            { name: 'terms', tag: 'input', type: 'checkbox', required: true, label: 'Terms', value: 'true' },
            { name: 'notes', tag: 'textarea', type: 'textarea', required: false, label: 'Notes', value: 'side door' },
          ],
        },
      ],
    },
  ],
  requests: [
    {
      afterStep: 0,
      transport: 'fetch',
      method: 'GET',
      pathname: '/api/products',
      search: '?q=cedar&category=drinkware',
      requestBody: null,
      status: 200,
      responseBody: JSON.stringify({ products: [] }),
    },
    {
      afterStep: 1,
      transport: 'xhr',
      method: 'POST',
      pathname: '/api/checkout',
      search: '',
      requestBody: JSON.stringify({ email: 'ada@analytical.example', qty: 2, terms: true, notes: 'side door' }),
      status: 201,
      responseBody: JSON.stringify({ order: { id: 'NW-1001' } }),
    },
  ],
}

test('deriveTools builds schemas from the recorded form and request', () => {
  const tools = deriveTools(recording)
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['search_catalog', 'place_order'],
  )
  const search = tools[0]
  assert.ok(search)
  assert.equal(search.annotations.readOnlyHint, true)
  assert.equal(search.annotations.consequentialHint, false)
  assert.equal(search.inputSchema.properties.category?.enum?.includes('drinkware'), true)
  assert.deepEqual(search.exampleInput, { q: 'cedar', category: 'drinkware' })
  assert.equal(search.plan.expect.transport, 'fetch')

  const order = tools[1]
  assert.ok(order)
  assert.equal(order.annotations.readOnlyHint, false)
  assert.equal(order.annotations.consequentialHint, true)
  assert.equal(order.inputSchema.properties.email?.format, 'email')
  assert.equal(order.inputSchema.properties.qty?.type, 'number')
  assert.equal(order.inputSchema.properties.terms?.type, 'boolean')
  assert.equal(order.inputSchema.required.includes('notes'), false)
  assert.equal(order.exampleInput.terms, true)
  assert.equal(order.exampleInput.qty, 2)
  assert.equal(order.plan.expect.ui, 'outcome')
  assert.equal(order.plan.expect.transport, 'xhr')
})

test('emitted snippet targets document.modelContext and cites the pin', () => {
  const snippet = emitSnippet('fixture', deriveTools(recording))
  assert.match(snippet, /document\.modelContext/)
  assert.match(snippet, new RegExp(WEBMCP_PIN.specCommit))
  assert.match(snippet, /registerTool\(/)
  assert.match(snippet, /executeRecordedForm/)
  assert.doesNotMatch(snippet, /navigator\.modelContext\s*=/)
  assert.doesNotMatch(snippet, /provideContext\s*\(/)
  assert.doesNotMatch(snippet, /clearContext\s*\(/)
  assert.match(snippet, /not emitted/)
})
