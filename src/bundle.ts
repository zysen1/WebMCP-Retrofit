// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import * as esbuild from 'esbuild'
import { WEBMCP_PIN } from './spec-pin.ts'

export async function bundleSnippet(sourcePath: string): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [sourcePath],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    target: 'es2022',
    define: {
      __RETROFIT_AUTO_INSTALL__: 'true',
    },
    banner: {
      js: `/* webmcp-retrofit injectable snippet. ${WEBMCP_PIN.api} @ ${WEBMCP_PIN.specCommit} */`,
    },
  })
  const output = result.outputFiles[0]
  if (!output) throw new Error(`Failed to bundle ${sourcePath}`)
  return output.text
}
