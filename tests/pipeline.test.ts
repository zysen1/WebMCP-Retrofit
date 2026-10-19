// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { repoRootFrom, runPipeline } from '../src/pipeline.ts'
import { shopOrder } from '../src/sites/goal.ts'

test('record, derive, contract-test, and race the local demo sites', { timeout: 180_000 }, async () => {
  const output = await runPipeline(repoRootFrom(import.meta.url))
  const { contracts, race } = output.results
  assert.equal(contracts.failed, 0, JSON.stringify(contracts.bySite))
  assert.equal(contracts.bySite.length, 5)
  assert.equal(contracts.passRate, 1)
  assert.deepEqual(
    output.tools.shop?.map((tool) => tool.name),
    ['search_catalog', 'add_to_cart', 'place_order'],
  )
  assert.ok((output.tools.library?.length ?? 0) >= 2)
  assert.ok((output.tools.support?.length ?? 0) >= 2)
  assert.ok((output.tools.booking?.length ?? 0) >= 2)
  assert.ok((output.tools.pantry?.length ?? 0) >= 2)
  assert.equal(race.webmcp.toolCalls, 3)
  assert.equal(race.webmcp.screenshots, 0)
  assert.equal(race.screenshot.toolCalls, 0)
  assert.ok(race.screenshot.screenshots > race.webmcp.toolCalls)
  assert.ok(race.screenshot.steps.length > race.webmcp.steps.length)
  assert.ok(race.screenshot.estimatedTokens > race.webmcp.estimatedTokens)
  assert.equal(race.screenshot.order?.sku, shopOrder.sku)
  assert.equal(race.webmcp.order?.sku, shopOrder.sku)
  assert.equal(race.screenshot.order?.qty, shopOrder.qty)
  assert.equal(race.webmcp.order?.qty, shopOrder.qty)
  assert.equal(race.screenshot.order?.email, shopOrder.email)
  assert.equal(race.webmcp.order?.email, shopOrder.email)
  assert.equal(race.screenshot.order?.shipping, shopOrder.shipping)
  assert.equal(race.webmcp.order?.shipping, shopOrder.shipping)
  assert.equal(race.screenshot.order?.total, race.webmcp.order?.total)
  assert.equal(race.webmcp.toolOrder?.id, race.webmcp.order?.id)
  assert.ok((race.screenshot.order?.total ?? 0) > 0)
})
