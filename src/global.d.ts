// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import type { ModelContext } from './polyfill/model-context.ts'

declare global {
  interface Document {
    modelContext?: ModelContext
  }

  interface Window {
    __retrofitInflight?: number
    __retrofitReady?: Promise<void>
    __retrofitTap?: boolean
    __site?: { show: (view: string) => void }
  }
}

export {}
