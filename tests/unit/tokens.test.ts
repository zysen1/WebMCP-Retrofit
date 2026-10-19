// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateImageTokens, estimateTextTokens, pngSize } from '../../src/tokens.ts'

test('text tokens use ceil(chars / 4)', () => {
  assert.equal(estimateTextTokens(''), 0)
  assert.equal(estimateTextTokens('abcd'), 1)
  assert.equal(estimateTextTokens('abcde'), 2)
})

test('image tokens follow the 512px tile count', () => {
  assert.equal(estimateImageTokens(1280, 720), 85 + 170 * 6)
  assert.equal(estimateImageTokens(1, 1), 85 + 170)
  assert.equal(estimateImageTokens(0, 10), 0)
})

test('pngSize reads the IHDR dimensions', () => {
  const buffer = Buffer.alloc(24)
  buffer.writeUInt32BE(1280, 16)
  buffer.writeUInt32BE(720, 20)
  assert.deepEqual(pngSize(buffer), { width: 1280, height: 720 })
})
