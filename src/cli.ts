// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import { repoRootFrom, runPipeline } from './pipeline.ts'
import { startSiteById } from './sites/server.ts'

const command = process.argv[2] ?? 'demo'

if (command === 'serve') {
  const id = process.argv[3] ?? 'shop'
  const running = await startSiteById(id)
  console.log(`${running.site.title} at ${running.url}`)
  await new Promise(() => {})
} else if (command === 'demo') {
  const root = repoRootFrom(import.meta.url)
  const output = await runPipeline(root)
  const { contracts, race } = output.results
  console.log(
    JSON.stringify(
      {
        dataset: output.results.dataset,
        measuredAt: output.results.measuredAt,
        contractPassRate: contracts.passRate,
        checks: `${contracts.passed}/${contracts.checks}`,
        bySite: contracts.bySite,
        screenshot: {
          steps: race.screenshot.steps.length,
          screenshots: race.screenshot.screenshots,
          uiActions: race.screenshot.uiActions,
          estimatedTokens: race.screenshot.estimatedTokens,
          taskMs: race.screenshot.taskMs,
          order: race.screenshot.order,
        },
        webmcp: {
          toolCalls: race.webmcp.toolCalls,
          estimatedTokens: race.webmcp.estimatedTokens,
          catalogTokens: race.webmcp.catalogTokens,
          taskMs: race.webmcp.taskMs,
          order: race.webmcp.order,
        },
        realLlmComparison: 'WIP',
      },
      null,
      2,
    ),
  )
  if (contracts.failed > 0) process.exitCode = 1
} else {
  console.error('Usage: tsx src/cli.ts demo | tsx src/cli.ts serve [site]')
  process.exitCode = 1
}
