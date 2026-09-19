# Contributing

[简体中文](CONTRIBUTING.md)

learn-pi teaches extension of real Pi through one TypeScript implementation. A change should make a behavior more explainable, executable, or verifiable rather than add unrelated demonstrations.

## Local development

Use Node >=22.19.0 and `npm ci --ignore-scripts`. `npm run verify` checks types, tests, and bilingual documentation; `npm run test:integration` exercises real Pi/MCP wiring; `npm run demo` reproduces the actual tool workflow with scripted model responses. `npm run docs:dev` starts a loopback-only preview.

## Change conventions

- Main code lives in `src/`; copy disposable exercises from `examples/fixtures/` instead of modifying the baseline fixture during an experiment.
- Chinese chapters live in `docs/chapters/`, English in `docs/en/chapters/`; matching routes must preserve content and navigation parity.
- Tool contract changes require aligned schemas, policy classification, failure tests, bilingual commands, and boundary explanations.
- Assert observable behavior rather than implementation strings. Mocks control model input or failures; they do not replace actual Pi/MCP integration.
- Before dependency changes, verify published versions, npm `gitHead`, matching source, and licenses; update lockfiles and the source page. Do not mix `main` APIs with released packages.
- Treat extensions as host code. Explain credentials, network, files, and execution permissions. Application hooks are not sandboxes.

## Commits and review

Keep changes focused on a reviewable problem. Explain the trigger, resulting behavior, validation, and unverified boundaries. Copy changes and low-impact styling need no mirrored implementation tests, but build and inspect affected pages. Never commit auth data, `.cache/`, generated exercise workspaces, or `node_modules/`.

Local Git commits may record progress. Public repositories, remote pushes, deployment, and social publishing require separate authorization; the current delivery scope is local acceptance.

## Attribution and licensing

New project code and prose use MIT. Preserve third-party notices and update `THIRD_PARTY_NOTICES.md` when reusing material. Distinguish native Pi capabilities, official examples, and course additions. Do not present guesses about product behavior as source-level facts.
