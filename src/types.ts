// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

export type Transport = 'fetch' | 'xhr'

export interface FlowAction {
  type: 'fill' | 'select' | 'check' | 'click'
  selector: string
  value?: string
}

export interface FormFieldSnapshot {
  name: string
  tag: string
  type: string
  required: boolean
  label: string
  value: string
  options?: { value: string; label: string }[]
  min?: string | null
  max?: string | null
  valueType?: string | null
}

export interface FormSnapshot {
  selector: string
  id: string
  toolTitle: string
  submitLabel: string
  resultTarget: string
  fields: FormFieldSnapshot[]
}

export interface RecordStep {
  index: number
  action: FlowAction
  title: string
  forms: FormSnapshot[]
}

export interface NetRecord {
  afterStep: number
  transport: Transport
  method: string
  pathname: string
  search: string
  requestBody: string | null
  status: number
  responseBody: string
}

export interface Recording {
  siteId: string
  startedAt: string
  steps: RecordStep[]
  requests: NetRecord[]
}

export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required: string[]
  additionalProperties: false
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean'
  description: string
  enum?: string[]
  format?: string
  minimum?: number
  maximum?: number
}

export interface ToolAnnotations {
  readOnlyHint: boolean
  untrustedContentHint: boolean
  consequentialHint: boolean
  debugging: boolean
}

export interface ToolPlan {
  formSelector: string
  resultTarget: string
  fields: Array<{
    name: string
    kind: 'string' | 'number' | 'boolean'
    required: boolean
  }>
  expect: {
    method: string
    pathname: string
    transport: Transport
    status: number
    responseKeys: string[]
    ui: 'results' | 'outcome'
  }
}

export interface DerivedTool {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: ToolAnnotations
  exampleInput: Record<string, unknown>
  plan: ToolPlan
  order: number
}

export interface ContractCheck {
  id: string
  pass: boolean
  detail: string
}

export interface ContractReport {
  siteId: string
  toolNames: string[]
  checks: ContractCheck[]
  passed: number
  failed: number
}

export interface AgentStep {
  kind: 'screenshot' | 'fill' | 'select' | 'check' | 'click' | 'tool_call'
  detail: string
  tokens: number
}

export interface PlacedOrder {
  id: string
  sku: string
  qty: number
  email: string
  shipping: string
  total: number
}

export interface AgentTrace {
  agent: 'screenshot' | 'webmcp'
  steps: AgentStep[]
  estimatedTokens: number
  catalogTokens: number
  taskMs: number
  screenshots: number
  toolCalls: number
  uiActions: number
  order: PlacedOrder | null
  toolOrder: PlacedOrder | null
}
