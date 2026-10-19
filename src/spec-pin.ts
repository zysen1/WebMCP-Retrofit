// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

/** Pinned WebMCP surface. Checked against the spec repo on 2026-10-19. */
export const WEBMCP_PIN = {
  specRepo: 'https://github.com/webmachinelearning/webmcp',
  specCommit: 'f14762e63607bf96592b1a7a6392cd2b047b8209',
  specCommitDate: '2026-10-16',
  specCommitMessage: 'Editorial: sync explainers with spec (#350)',
  api: 'document.modelContext',
  methods: ['registerTool', 'getTools', 'executeTool'] as const,
  event: 'toolchange',
  deprecatedAliasNotEmitted: 'navigator.modelContext',
  removedMethodsNotEmitted: ['provideContext', 'clearContext'] as const,
  polyfillPackage: '@mcp-b/webmcp-polyfill',
  polyfillVersion: '6.0.3',
  polyfillUpstreamRevision: '6bf6c57bbaf3d1173d7737cfb79572632d9b7871',
  chromeDocsUpdated: '2026-10-16',
  checkedOn: '2026-10-19',
} as const

export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/
