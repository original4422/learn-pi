# Third-party notices / 第三方来源说明

The course is independently authored and is not affiliated with Pi, OpenAI, or Anthropic. Product names identify comparison subjects. Native runtime capabilities and official extension patterns are attributed throughout the course.

## Pi

- Repository: https://github.com/earendil-works/pi
- Release: `@earendil-works/pi-coding-agent@0.85.1`, `@earendil-works/pi-ai@0.85.1`
- Source commit: `d981de1229ef899957bbe968bc8dcda02a21f477`
- License: MIT
- Official extension patterns consulted: `plan-mode/`, `todo.ts`, `permission-gate.ts`, `protected-paths.ts`, `subagent/`, `git-checkpoint.ts` under `packages/coding-agent/examples/extensions/`.
- The course's policy, persistence, bounded SDK child sessions, and disposable checkpoint modules are organized for this curriculum. Their underlying extension mechanisms are supplied by Pi. Small API illustrations follow its documentation; no claim of inventing these mechanisms is made.

Pi's applicable upstream notice follows:

MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Other direct dependencies

| Dependency | License | Use |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | MIT | Real local MCP client/server transport |
| `typebox` | MIT | Runtime tool parameter schemas |
| `zod` | MIT | MCP server input schema |
| `typescript` | Apache-2.0 | Type checking |
| `tsx` | MIT | TypeScript execution |
| `vitepress` | MIT | Documentation build and theme foundation |
| `@types/node` | MIT | Node type declarations |

The exact dependency tree and integrity hashes are in `package-lock.json`. Transitive dependencies retain their own licenses and notices in installed packages; this table is not an exhaustive dependency license inventory. We do not vendor their sources into the course.

## Documentation and visuals

Bilingual explanations and source-controlled SVG/CSS visuals are created for learn-pi. Public product documentation is linked and narrowly paraphrased, not copied as course chapters. The local `learn-claude-code` repository was not copied into this implementation. All external links and comparison dates appear on the bilingual source pages.
