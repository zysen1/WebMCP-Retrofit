// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.
//
// Original subset of the pinned WebMCP imperative surface. This is not
// a copy of @mcp-b/webmcp-polyfill. It exists so the offline demo can
// register and call tools in a browser that has no native modelContext.

import { TOOL_NAME_PATTERN } from '../spec-pin.ts'

export interface ToolAnnotationsInput {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
  consequentialHint?: boolean
  debugging?: boolean
}

export interface ToolRegistration {
  name: string
  title?: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations?: ToolAnnotationsInput
  execute: (input: unknown, options?: { signal?: AbortSignal }) => unknown
}

export interface RegisterToolOptions {
  signal?: AbortSignal
  exposedTo?: string[]
}

export interface PublicTool {
  name: string
  title: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations: Required<ToolAnnotationsInput>
  origin: string
  window: typeof globalThis
}

export interface ModelContext {
  registerTool(tool: ToolRegistration, options?: RegisterToolOptions): Promise<void>
  getTools(options?: { fromOrigins?: string[] }): Promise<PublicTool[]>
  executeTool(
    tool: { name: string } | string,
    input?: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
  ontoolchange: ((ev: Event) => void) | null
}

interface StoredTool extends ToolRegistration {
  annotations: Required<ToolAnnotationsInput>
}

function defaultAnnotations(input: ToolAnnotationsInput | undefined): Required<ToolAnnotationsInput> {
  return {
    readOnlyHint: input?.readOnlyHint ?? false,
    untrustedContentHint: input?.untrustedContentHint ?? false,
    consequentialHint: input?.consequentialHint ?? false,
    debugging: input?.debugging ?? false,
  }
}

export function createModelContext(origin = 'null'): ModelContext {
  const tools = new Map<string, StoredTool>()
  const target = new EventTarget()
  let ontoolchange: ((ev: Event) => void) | null = null

  target.addEventListener('toolchange', (event) => {
    ontoolchange?.call(context, event)
  })

  function emit(): void {
    target.dispatchEvent(new Event('toolchange'))
  }

  const context: ModelContext = {
    get ontoolchange() {
      return ontoolchange
    },
    set ontoolchange(value) {
      ontoolchange = value
    },
    addEventListener(type, listener) {
      target.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      target.removeEventListener(type, listener)
    },
    async registerTool(tool, options) {
      if (!tool || typeof tool.name !== 'string' || !TOOL_NAME_PATTERN.test(tool.name)) {
        throw new DOMException(
          'Tool name must be 1-128 characters of ASCII letters, digits, "_", "-", or ".".',
          'SyntaxError',
        )
      }
      if (typeof tool.description !== 'string' || tool.description.trim() === '') {
        throw new DOMException('Tool description is required.', 'SyntaxError')
      }
      if (typeof tool.execute !== 'function') {
        throw new DOMException('Tool execute callback is required.', 'SyntaxError')
      }
      if (options?.exposedTo && options.exposedTo.length > 0) {
        throw new DOMException(
          'Cross-origin exposedTo is not supported by this local polyfill.',
          'NotSupportedError',
        )
      }
      if (options?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      if (tools.has(tool.name)) {
        throw new DOMException(`Tool ${tool.name} is already registered.`, 'InvalidStateError')
      }
      const stored: StoredTool = {
        ...tool,
        annotations: defaultAnnotations(tool.annotations),
      }
      tools.set(tool.name, stored)
      if (options?.signal) {
        options.signal.addEventListener(
          'abort',
          () => {
            if (tools.get(tool.name) === stored) {
              tools.delete(tool.name)
              emit()
            }
          },
          { once: true },
        )
      }
      emit()
    },
    async getTools(options) {
      if (options?.fromOrigins && options.fromOrigins.length > 0) {
        throw new DOMException(
          'Cross-origin fromOrigins is not supported by this local polyfill.',
          'NotSupportedError',
        )
      }
      return [...tools.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tool) => ({
          name: tool.name,
          title: tool.title ?? '',
          description: tool.description,
          inputSchema: tool.inputSchema
            ? (structuredClone(tool.inputSchema) as Record<string, unknown>)
            : undefined,
          annotations: { ...tool.annotations },
          origin,
          window: globalThis,
        }))
    },
    async executeTool(tool, input, options) {
      if (options?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      const name = typeof tool === 'string' ? tool : tool?.name
      const stored = name ? tools.get(name) : undefined
      if (!stored) {
        throw new DOMException(`No registered tool named ${String(name)}.`, 'NotFoundError')
      }
      let args: unknown = input ?? {}
      if (typeof args === 'string') {
        args = JSON.parse(args) as unknown
      }
      return await stored.execute(args, { signal: options?.signal })
    },
  }

  return context
}

export function installDocumentModelContext(doc: {
  modelContext?: ModelContext
  location?: { origin?: string }
}): ModelContext {
  if (doc.modelContext) return doc.modelContext
  const origin = doc.location?.origin ?? 'null'
  const created = createModelContext(origin)
  Object.defineProperty(doc, 'modelContext', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: created,
  })
  return created
}
