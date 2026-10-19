// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { TOOL_NAME_PATTERN } from '../spec-pin.ts'
import type {
  DerivedTool,
  FormFieldSnapshot,
  FormSnapshot,
  JsonSchemaProperty,
  NetRecord,
  Recording,
  RecordStep,
  ToolAnnotations,
} from '../types.ts'

const OUTCOME_KEYS = new Set(['order', 'hold', 'ticket', 'appointment', 'receipt'])
const CONSEQUENTIAL = /(checkout|orders|order|holds|tickets|appointments|receipts)/

export function deriveTools(recording: Recording): DerivedTool[] {
  const groups = new Map<string, NetRecord[]>()
  for (const request of recording.requests) {
    if (!request.pathname.startsWith('/api/') || request.status >= 400) continue
    const key = `${request.method} ${request.pathname}`
    const list = groups.get(key) ?? []
    list.push(request)
    groups.set(key, list)
  }

  const tools: DerivedTool[] = []
  for (const list of groups.values()) {
    const request = list[list.length - 1]
    if (!request) continue
    const step = recording.steps[request.afterStep]
    if (!step) {
      throw new Error(`Request ${request.method} ${request.pathname} has no step ${request.afterStep}`)
    }
    const payload = parsePayload(request)
    const form = matchForm(step, payload)
    tools.push(buildTool(form, request, payload, step.index))
  }
  tools.sort((a, b) => a.order - b.order)
  const names = new Set<string>()
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Derived duplicate tool name ${tool.name}`)
    }
    names.add(tool.name)
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(`Derived tool name is not WebMCP-safe: ${tool.name}`)
    }
  }
  return tools
}

function matchForm(step: RecordStep, payload: Record<string, unknown>): FormSnapshot {
  const keys = Object.keys(payload)
  const candidates = step.forms.filter((form) => keys.every((key) => form.fields.some((field) => field.name === key)))
  if (candidates.length === 0) {
    throw new Error(
      `No form on step ${step.index} (${step.action.selector}) covers ${keys.join(', ') || '(empty payload)'}`,
    )
  }
  const inside = candidates.filter((form) => selectorInside(form.selector, step.action.selector))
  if (inside.length === 1 && inside[0]) return inside[0]
  if (inside.length > 1) {
    throw new Error(`Multiple forms contain ${step.action.selector}`)
  }
  if (candidates.length === 1 && candidates[0]) return candidates[0]
  throw new Error(
    `Ambiguous form for ${step.action.selector}: ${candidates.map((form) => form.selector).join(', ')}`,
  )
}

function selectorInside(formSelector: string, actionSelector: string): boolean {
  return (
    actionSelector === formSelector ||
    actionSelector.startsWith(`${formSelector} `) ||
    actionSelector.startsWith(`${formSelector}>`)
  )
}

function buildTool(
  form: FormSnapshot,
  request: NetRecord,
  payload: Record<string, unknown>,
  order: number,
): DerivedTool {
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []
  const planFields: DerivedTool['plan']['fields'] = []
  for (const field of form.fields) {
    const property = schemaForField(field, payload[field.name])
    properties[field.name] = property
    planFields.push({ name: field.name, kind: property.type, required: field.required })
    if (field.required) required.push(field.name)
  }
  const responseKeys = objectKeys(request.responseBody)
  const transportLabel = request.transport === 'xhr' ? 'XMLHttpRequest' : 'fetch'
  const inputs = form.fields.map((field) => `${field.name} (${field.label})`).join(', ')
  const title = form.toolTitle || form.submitLabel || form.id
  const description = `${title}. Recorded user flow submitted ${form.selector} via ${transportLabel} ${request.method} ${request.pathname}. Inputs: ${inputs}.`
  const example: Record<string, unknown> = {}
  for (const field of form.fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field.name)) {
      example[field.name] = coerce(field, payload[field.name])
    }
  }
  return {
    name: toolName(form.id),
    title,
    description,
    inputSchema: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
    annotations: annotations(request.method, request.pathname),
    exampleInput: example,
    plan: {
      formSelector: form.selector,
      resultTarget: form.resultTarget,
      fields: planFields,
      expect: {
        method: request.method,
        pathname: request.pathname,
        transport: request.transport,
        status: request.status,
        responseKeys,
        ui: responseKeys.some((key) => OUTCOME_KEYS.has(key)) ? 'outcome' : 'results',
      },
    },
    order,
  }
}

function schemaForField(field: FormFieldSnapshot, example: unknown): JsonSchemaProperty {
  if (field.type === 'checkbox') {
    return { type: 'boolean', description: field.label }
  }
  const numeric = field.type === 'number' || field.valueType === 'number' || typeof example === 'number'
  if (numeric) {
    const property: JsonSchemaProperty = { type: 'number', description: field.label }
    if (field.min != null && field.min !== '') property.minimum = Number(field.min)
    if (field.max != null && field.max !== '') property.maximum = Number(field.max)
    return property
  }
  if ((field.type === 'select-one' || field.tag === 'select') && field.options && field.options.length > 0) {
    return {
      type: 'string',
      description: field.label,
      enum: field.options.map((option) => option.value),
    }
  }
  const property: JsonSchemaProperty = { type: 'string', description: field.label }
  if (field.type === 'email') property.format = 'email'
  return property
}

function coerce(field: FormFieldSnapshot, value: unknown): unknown {
  if (field.type === 'checkbox') return value === true || value === 'true' || value === 'on'
  if (field.type === 'number' || field.valueType === 'number') return Number(value)
  return value
}

function annotations(method: string, pathname: string): ToolAnnotations {
  return {
    readOnlyHint: method === 'GET',
    untrustedContentHint: false,
    consequentialHint: method !== 'GET' && CONSEQUENTIAL.test(pathname),
    debugging: false,
  }
}

function toolName(formId: string): string {
  const base = formId.replace(/-/g, '_').replace(/[^A-Za-z0-9_.]/g, '')
  const named = /^[A-Za-z_]/.test(base) ? base : `tool_${base}`
  return named.slice(0, 128)
}

function parsePayload(request: NetRecord): Record<string, unknown> {
  if (request.method === 'GET') {
    const params = new URLSearchParams(request.search)
    const payload: Record<string, unknown> = {}
    for (const [key, value] of params) payload[key] = value
    return payload
  }
  if (!request.requestBody) return {}
  const parsed = JSON.parse(request.requestBody) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected a JSON object body for ${request.method} ${request.pathname}`)
  }
  return parsed as Record<string, unknown>
}

function objectKeys(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.keys(parsed as Record<string, unknown>)
  } catch {
    return []
  }
}
