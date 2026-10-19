// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { WEBMCP_PIN } from '../spec-pin.ts'
import type { AgentTrace } from '../types.ts'

export interface MeasuredResults {
  measuredAt: string
  dataset: string
  specPin: typeof WEBMCP_PIN
  contracts: {
    checks: number
    passed: number
    failed: number
    passRate: number
    bySite: Array<{ siteId: string; tools: number; checks: number; passed: number; failed: number; passRate: number }>
  }
  race: {
    goal: { sku: string; qty: number; email: string }
    counting: string
    tokenModel: string
    screenshot: AgentTrace
    webmcp: AgentTrace
  }
  realLlmComparison: 'WIP'
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function bar(width: number): string {
  return `<span class="bar" style="width:${Math.max(2, Math.round(width))}%"></span>`
}

function stepList(trace: AgentTrace, limit: number): string {
  const shown = trace.steps.slice(0, limit)
  const items = shown
    .map((step, index) => `<li><span>${index + 1}</span> ${step.kind} · ${escape(step.detail)} · ${step.tokens} tok</li>`)
    .join('')
  const more = trace.steps.length > limit ? `<li>… ${trace.steps.length - limit} more steps in results.json</li>` : ''
  return `<ol>${items}${more}</ol>`
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function renderReport(results: MeasuredResults): string {
  const shot = results.race.screenshot
  const mcp = results.race.webmcp
  const maxTokens = Math.max(shot.estimatedTokens, mcp.estimatedTokens, 1)
  const maxTime = Math.max(shot.taskMs, mcp.taskMs, 1)
  const rows = results.contracts.bySite
    .map(
      (site) =>
        `<tr><td>${site.siteId}</td><td>${site.tools}</td><td>${site.passed}/${site.checks}</td><td>${pct(site.passRate)}</td></tr>`,
    )
    .join('')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WebMCP Retrofit race</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; background: #f3ecdf; color: #1d1a16; font: 15px/1.4 "Segoe UI", sans-serif; }
    main { width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }
    h1 { font: 600 36px Georgia, serif; margin: 0 0 6px; }
    .kicker { letter-spacing: 0.08em; text-transform: uppercase; color: #0e6b52; font-size: 12px; margin: 0; }
    .pin { color: #5c564c; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 18px 0; }
    article { background: #fffaf3; border: 1px solid #d9d0c1; border-radius: 14px; padding: 16px; }
    h2 { margin: 0 0 8px; font: 600 22px Georgia, serif; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
    .stat { background: #f6f1e7; border-radius: 10px; padding: 8px; }
    .stat b { display: block; font-size: 22px; }
    .stat span { color: #5c564c; font-size: 12px; }
    .meter { display: grid; grid-template-columns: 72px 1fr; gap: 8px; align-items: center; margin: 6px 0; font-size: 13px; }
    .track { background: #efe6d6; border-radius: 999px; height: 10px; }
    .bar { display: block; height: 10px; border-radius: 999px; background: #0e6b52; }
    article.shot .bar { background: #9a3412; }
    ol { margin: 8px 0 0; padding: 0; list-style: none; max-height: 220px; overflow: auto; }
    li { display: flex; gap: 8px; font-size: 12px; padding: 3px 0; border-top: 1px solid #efe6d6; }
    li span { color: #5c564c; width: 1.5em; }
    table { width: 100%; border-collapse: collapse; background: #fffaf3; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #d9d0c1; }
    .note { color: #5c564c; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <p class="kicker">Offline demo · mock policies · no API key</p>
    <h1>Same order, two agents</h1>
    <p class="pin">WebMCP pin <code>${WEBMCP_PIN.specCommit.slice(0, 12)}</code> · <code>${WEBMCP_PIN.api}</code> · polyfill consulted ${WEBMCP_PIN.polyfillPackage}@${WEBMCP_PIN.polyfillVersion}</p>
    <p>Northwind Nook: 2 × Cedar Camp Mug, ash glaze, size M, standard shipping, for ${results.race.goal.email}. Contract pass rate on the local demo set: <strong>${pct(results.contracts.passRate)}</strong> (${results.contracts.passed}/${results.contracts.checks}).</p>
    <div class="grid">
      <article class="shot">
        <h2>Screenshot and click</h2>
        <div class="stats">
          <div class="stat"><b>${shot.steps.length}</b><span>steps</span></div>
          <div class="stat"><b>${shot.estimatedTokens.toLocaleString('en-US')}</b><span>estimated tokens</span></div>
          <div class="stat"><b>${(shot.taskMs / 1000).toFixed(2)}s</b><span>task time</span></div>
        </div>
        <div class="meter"><span>tokens</span><div class="track">${bar((shot.estimatedTokens / maxTokens) * 100)}</div></div>
        <div class="meter"><span>time</span><div class="track">${bar((shot.taskMs / maxTime) * 100)}</div></div>
        <p class="note">${shot.screenshots} screenshots · ${shot.uiActions} UI actions · 0 tool calls · order ${shot.order?.id ?? 'missing'}</p>
        ${stepList(shot, 8)}
      </article>
      <article>
        <h2>WebMCP</h2>
        <div class="stats">
          <div class="stat"><b>${mcp.toolCalls}</b><span>tool calls</span></div>
          <div class="stat"><b>${mcp.estimatedTokens.toLocaleString('en-US')}</b><span>estimated tokens</span></div>
          <div class="stat"><b>${(mcp.taskMs / 1000).toFixed(2)}s</b><span>task time</span></div>
        </div>
        <div class="meter"><span>tokens</span><div class="track">${bar((mcp.estimatedTokens / maxTokens) * 100)}</div></div>
        <div class="meter"><span>time</span><div class="track">${bar((mcp.taskMs / maxTime) * 100)}</div></div>
        <p class="note">${mcp.catalogTokens.toLocaleString('en-US')} catalog tokens included · 0 screenshots · order ${mcp.order?.id ?? 'missing'}</p>
        ${stepList(mcp, 8)}
      </article>
    </div>
    <h2>Contract tests on the local demo sites</h2>
    <table>
      <thead><tr><th>Site</th><th>Tools</th><th>Checks</th><th>Pass rate</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">${results.race.counting} ${results.race.tokenModel} Real-LLM comparison: WIP. Dataset: ${results.dataset}. Measured ${results.measuredAt}.</p>
  </main>
</body>
</html>`
}
