// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { escapeHtml } from './html.ts'
import { getSite, type SiteDefinition } from './definitions.ts'

const clientJs = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
const stylesCss = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

export interface RunningSite {
  site: SiteDefinition
  url: string
  close: () => Promise<void>
}

function pageHtml(site: SiteDefinition): string {
  const nav = site.nav
    .map(
      (item) =>
        `<a href="#${item.id}" data-nav="${item.id}">${escapeHtml(item.label)}</a>`,
    )
    .join('')
  const views = site.views
    .map((view) => `<section data-view="${view.id}">${view.html}</section>`)
    .join('\n')
  const config = JSON.stringify({ id: site.id, initialView: site.initialView })
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body style="--accent: ${site.accent}">
  <header>
    <p class="kicker">${escapeHtml(site.kicker)}</p>
    <h1>${escapeHtml(site.title)}</h1>
    <p class="intro">${escapeHtml(site.intro)}</p>
    <nav>${nav}</nav>
  </header>
  <main>${views}</main>
  <script id="site-config" type="application/json">${config}</script>
  <script src="/client.js"></script>
</body>
</html>`
}

function send(res: ServerResponse, status: number, body: string, type: string): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8')
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed as Record<string, unknown>
}

export function startSite(site: SiteDefinition): Promise<RunningSite> {
  const state = { seq: 1 }
  const html = pageHtml(site)
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (req.method === 'GET' && url.pathname === '/') {
        send(res, 200, html, 'text/html; charset=utf-8')
        return
      }
      if (req.method === 'GET' && url.pathname === '/styles.css') {
        send(res, 200, stylesCss, 'text/css; charset=utf-8')
        return
      }
      if (req.method === 'GET' && url.pathname === '/client.js') {
        send(res, 200, clientJs, 'text/javascript; charset=utf-8')
        return
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') {
        res.writeHead(204)
        res.end()
        return
      }
      const key = `${req.method ?? 'GET'} ${url.pathname}`
      const handler = site.handlers[key]
      if (!handler) {
        sendJson(res, 404, { error: `No route ${key}` })
        return
      }
      const body = req.method === 'GET' ? {} : await readBody(req)
      const result = handler({ query: url.searchParams, body, state })
      sendJson(res, result.status, result.body)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server error'
      sendJson(res, 500, { error: message })
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({
        site,
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, reject) => {
            server.close((error) => (error ? reject(error) : done()))
          }),
      })
    })
  })
}

export async function startSiteById(id: string): Promise<RunningSite> {
  return startSite(getSite(id))
}
