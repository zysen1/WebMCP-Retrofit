// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export interface ControlSpec {
  formId: string
  name: string
  label: string
  type?: string
  required?: boolean
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  hidden?: boolean
  valueType?: 'number'
  value?: string
}

export function control(field: ControlSpec): string {
  const id = `${field.formId}-${field.name}`
  const required = field.required ? ' required' : ''
  if (field.hidden) {
    const valueType = field.valueType ? ` data-value-type="${field.valueType}"` : ''
    const value = field.value ? ` value="${escapeHtml(field.value)}"` : ''
    return `<input type="hidden" id="${id}" name="${escapeHtml(field.name)}" aria-label="${escapeHtml(field.label)}"${value}${valueType}${required}>`
  }
  if (field.type === 'checkbox') {
    return `<div class="field check"><input id="${id}" name="${escapeHtml(field.name)}" type="checkbox"${required}><label for="${id}">${escapeHtml(field.label)}</label></div>`
  }
  let input: string
  if (field.options) {
    const options = field.options
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join('')
    input = `<select id="${id}" name="${escapeHtml(field.name)}"${required}>${options}</select>`
  } else if (field.type === 'textarea') {
    input = `<textarea id="${id}" name="${escapeHtml(field.name)}"${required}></textarea>`
  } else {
    const min = field.min != null ? ` min="${field.min}"` : ''
    const max = field.max != null ? ` max="${field.max}"` : ''
    const valueType = field.valueType ? ` data-value-type="${field.valueType}"` : ''
    input = `<input id="${id}" name="${escapeHtml(field.name)}" type="${field.type ?? 'text'}"${required}${min}${max}${valueType}>`
  }
  return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label>${input}</div>`
}

export function formOpen(options: {
  id: string
  title: string
  endpoint: string
  method: 'GET' | 'POST'
  transport: 'fetch' | 'xhr'
  result: string
}): string {
  return `<form id="${options.id}" data-tool-title="${escapeHtml(options.title)}" data-endpoint="${options.endpoint}" data-method="${options.method}" data-transport="${options.transport}" data-result="${options.result}" autocomplete="off">`
}
