// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

/**
 * Text estimate used by the offline race. This is the common
 * ceil(chars / 4) approximation, not a tokenizer and not a bill.
 */
export function estimateTextTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Image estimate used by the offline race. Reimplements the published
 * OpenAI gpt-4o vision tile count: fit inside 2048px, scale so the
 * shortest side is at most 768px, then 85 + 170 tokens per 512px tile.
 */
export function estimateImageTokens(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0
  let w = width
  let h = height
  const maxSide = Math.max(w, h)
  if (maxSide > 2048) {
    const scale = 2048 / maxSide
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const minSide = Math.min(w, h)
  if (minSide > 768) {
    const scale = 768 / minSide
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return 85 + 170 * tiles
}

export function pngSize(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24) {
    throw new Error('PNG is too small to contain an IHDR')
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}
