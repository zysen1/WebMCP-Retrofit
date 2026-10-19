/* webmcp-retrofit injectable snippet. document.modelContext @ f14762e63607bf96592b1a7a6392cd2b047b8209 */
"use strict";
(() => {
  // src/spec-pin.ts
  var TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

  // src/polyfill/model-context.ts
  function defaultAnnotations(input) {
    return {
      readOnlyHint: input?.readOnlyHint ?? false,
      untrustedContentHint: input?.untrustedContentHint ?? false,
      consequentialHint: input?.consequentialHint ?? false,
      debugging: input?.debugging ?? false
    };
  }
  function createModelContext(origin = "null") {
    const tools = /* @__PURE__ */ new Map();
    const target = new EventTarget();
    let ontoolchange = null;
    target.addEventListener("toolchange", (event) => {
      ontoolchange?.call(context, event);
    });
    function emit() {
      target.dispatchEvent(new Event("toolchange"));
    }
    const context = {
      get ontoolchange() {
        return ontoolchange;
      },
      set ontoolchange(value) {
        ontoolchange = value;
      },
      addEventListener(type, listener) {
        target.addEventListener(type, listener);
      },
      removeEventListener(type, listener) {
        target.removeEventListener(type, listener);
      },
      async registerTool(tool, options) {
        if (!tool || typeof tool.name !== "string" || !TOOL_NAME_PATTERN.test(tool.name)) {
          throw new DOMException(
            'Tool name must be 1-128 characters of ASCII letters, digits, "_", "-", or ".".',
            "SyntaxError"
          );
        }
        if (typeof tool.description !== "string" || tool.description.trim() === "") {
          throw new DOMException("Tool description is required.", "SyntaxError");
        }
        if (typeof tool.execute !== "function") {
          throw new DOMException("Tool execute callback is required.", "SyntaxError");
        }
        if (options?.exposedTo && options.exposedTo.length > 0) {
          throw new DOMException(
            "Cross-origin exposedTo is not supported by this local polyfill.",
            "NotSupportedError"
          );
        }
        if (options?.signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        if (tools.has(tool.name)) {
          throw new DOMException(`Tool ${tool.name} is already registered.`, "InvalidStateError");
        }
        const stored = {
          ...tool,
          annotations: defaultAnnotations(tool.annotations)
        };
        tools.set(tool.name, stored);
        if (options?.signal) {
          options.signal.addEventListener(
            "abort",
            () => {
              if (tools.get(tool.name) === stored) {
                tools.delete(tool.name);
                emit();
              }
            },
            { once: true }
          );
        }
        emit();
      },
      async getTools(options) {
        if (options?.fromOrigins && options.fromOrigins.length > 0) {
          throw new DOMException(
            "Cross-origin fromOrigins is not supported by this local polyfill.",
            "NotSupportedError"
          );
        }
        return [...tools.values()].sort((a, b) => a.name.localeCompare(b.name)).map((tool) => ({
          name: tool.name,
          title: tool.title ?? "",
          description: tool.description,
          inputSchema: tool.inputSchema ? structuredClone(tool.inputSchema) : void 0,
          annotations: { ...tool.annotations },
          origin,
          window: globalThis
        }));
      },
      async executeTool(tool, input, options) {
        if (options?.signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        const name = typeof tool === "string" ? tool : tool?.name;
        const stored = name ? tools.get(name) : void 0;
        if (!stored) {
          throw new DOMException(`No registered tool named ${String(name)}.`, "NotFoundError");
        }
        let args = input ?? {};
        if (typeof args === "string") {
          args = JSON.parse(args);
        }
        return await stored.execute(args, { signal: options?.signal });
      }
    };
    return context;
  }
  function installDocumentModelContext(doc) {
    if (doc.modelContext) return doc.modelContext;
    const origin = doc.location?.origin ?? "null";
    const created = createModelContext(origin);
    Object.defineProperty(doc, "modelContext", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: created
    });
    return created;
  }

  // src/runtime/browser.ts
  function installTransportTap() {
    const w = window;
    if (w.__retrofitTap) return;
    w.__retrofitTap = true;
    w.__retrofitInflight = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw, location.href);
      const track = url.pathname.startsWith("/api/");
      if (track) w.__retrofitInflight = (w.__retrofitInflight ?? 0) + 1;
      try {
        const response = await originalFetch(input, init);
        if (track) {
          const text = await response.clone().text();
          let data = text;
          try {
            data = JSON.parse(text);
          } catch {
          }
          window.dispatchEvent(
            new CustomEvent("retrofit:response", {
              detail: {
                transport: "fetch",
                method,
                pathname: url.pathname,
                status: response.status,
                data
              }
            })
          );
        }
        return response;
      } finally {
        if (track) w.__retrofitInflight = Math.max(0, (w.__retrofitInflight ?? 1) - 1);
      }
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, async, username, password) {
      this.__rf = { method: String(method).toUpperCase(), url: String(url) };
      return originalOpen.call(this, method, url, async ?? true, username, password);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const meta = this.__rf;
      let track = false;
      if (meta) {
        try {
          const url = new URL(meta.url, location.href);
          meta.pathname = url.pathname;
          track = url.pathname.startsWith("/api/");
        } catch {
          track = false;
        }
      }
      if (track) w.__retrofitInflight = (w.__retrofitInflight ?? 0) + 1;
      this.addEventListener("loadend", () => {
        if (!track || !meta?.pathname) return;
        w.__retrofitInflight = Math.max(0, (w.__retrofitInflight ?? 1) - 1);
        let data = this.responseText;
        try {
          data = JSON.parse(this.responseText);
        } catch {
        }
        window.dispatchEvent(
          new CustomEvent("retrofit:response", {
            detail: {
              transport: "xhr",
              method: meta.method,
              pathname: meta.pathname,
              status: this.status,
              data
            }
          })
        );
      });
      return originalSend.call(this, body);
    };
  }
  function waitForApi(method, pathname, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${method} ${pathname}`));
      }, 5e3);
      const onAbort = () => {
        cleanup();
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };
      const onResponse = (event) => {
        const detail = event.detail;
        if (!detail || detail.method !== method || detail.pathname !== pathname) return;
        cleanup();
        setTimeout(() => resolve(detail), 0);
      };
      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("retrofit:response", onResponse);
        signal?.removeEventListener("abort", onAbort);
      }
      if (signal?.aborted) {
        cleanup();
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("retrofit:response", onResponse);
    });
  }
  async function executeRecordedForm(plan, input, signal) {
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    const form = document.querySelector(plan.formSelector);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Recorded form ${plan.formSelector} is not on this page`);
    }
    const record = input && typeof input === "object" ? input : {};
    for (const field of plan.fields) {
      const value = record[field.name];
      const missing = value === void 0 || value === null || value === "";
      if (missing) {
        if (field.required) throw new Error(`Missing required input ${field.name}`);
        continue;
      }
      const control = form.elements.namedItem(field.name);
      if (!control || control instanceof RadioNodeList || !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
        throw new Error(`Missing control ${field.name} in ${plan.formSelector}`);
      }
      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        control.checked = value === true || value === "true" || value === "on" || value === 1;
      } else {
        control.value = String(value);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const pending = waitForApi(plan.expect.method, plan.expect.pathname, signal);
    form.requestSubmit();
    const detail = await pending;
    return {
      ok: detail.status >= 200 && detail.status < 300,
      status: detail.status,
      data: detail.data,
      text: JSON.stringify(detail.data)
    };
  }

  // generated/library/inject.ts
  var WEBMCP_PIN = {
    "specRepo": "https://github.com/webmachinelearning/webmcp",
    "specCommit": "f14762e63607bf96592b1a7a6392cd2b047b8209",
    "specCommitDate": "2026-10-16",
    "specCommitMessage": "Editorial: sync explainers with spec (#350)",
    "api": "document.modelContext",
    "methods": [
      "registerTool",
      "getTools",
      "executeTool"
    ],
    "event": "toolchange",
    "deprecatedAliasNotEmitted": "navigator.modelContext",
    "removedMethodsNotEmitted": [
      "provideContext",
      "clearContext"
    ],
    "polyfillPackage": "@mcp-b/webmcp-polyfill",
    "polyfillVersion": "6.0.3",
    "polyfillUpstreamRevision": "6bf6c57bbaf3d1173d7737cfb79572632d9b7871",
    "chromeDocsUpdated": "2026-10-16",
    "checkedOn": "2026-10-19"
  };
  var siteId = "library";
  async function registerRetrofitTools(modelContext) {
    await modelContext.registerTool({
      name: "search_books",
      title: "Search books",
      description: "Search books. Recorded user flow submitted #search-books via XMLHttpRequest GET /api/books. Inputs: q (Title or author).",
      inputSchema: {
        "type": "object",
        "properties": {
          "q": {
            "type": "string",
            "description": "Title or author"
          }
        },
        "required": [
          "q"
        ],
        "additionalProperties": false
      },
      annotations: { "readOnlyHint": true, "untrustedContentHint": false, "consequentialHint": false, "debugging": false },
      async execute(input, options) {
        return executeRecordedForm({ "formSelector": "#search-books", "resultTarget": "book-results", "fields": [{ "name": "q", "kind": "string", "required": true }], "expect": { "method": "GET", "pathname": "/api/books", "transport": "xhr", "status": 200, "responseKeys": ["books"], "ui": "results" } }, input, options?.signal);
      }
    });
    await modelContext.registerTool({
      name: "place_hold",
      title: "Place hold",
      description: "Place hold. Recorded user flow submitted #place-hold via fetch POST /api/holds. Inputs: bookId (Book), card (Card number), name (Name on card).",
      inputSchema: {
        "type": "object",
        "properties": {
          "bookId": {
            "type": "string",
            "description": "Book",
            "enum": [
              "left-hand",
              "kindred",
              "dispossessed"
            ]
          },
          "card": {
            "type": "string",
            "description": "Card number"
          },
          "name": {
            "type": "string",
            "description": "Name on card"
          }
        },
        "required": [
          "bookId",
          "card",
          "name"
        ],
        "additionalProperties": false
      },
      annotations: { "readOnlyHint": false, "untrustedContentHint": false, "consequentialHint": true, "debugging": false },
      async execute(input, options) {
        return executeRecordedForm({ "formSelector": "#place-hold", "resultTarget": "outcome", "fields": [{ "name": "bookId", "kind": "string", "required": true }, { "name": "card", "kind": "string", "required": true }, { "name": "name", "kind": "string", "required": true }], "expect": { "method": "POST", "pathname": "/api/holds", "transport": "fetch", "status": 201, "responseKeys": ["hold"], "ui": "outcome" } }, input, options?.signal);
      }
    });
  }
  async function installAndRegisterTools() {
    installTransportTap();
    const modelContext = installDocumentModelContext(document);
    await registerRetrofitTools(modelContext);
  }
  if (true) {
    window.__retrofitReady = installAndRegisterTools();
  }
})();
