# CodeGraph Hermes — Development Guide

Instructions for AI coding agents (Hermes Agent, Claude Code, Cursor) working on this codebase.

## What This Repo Is

A fork of [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) optimized for **Hermes Agent** (https://github.com/nousresearch/hermes-agent). Adds Hermes installer target, skill file, and Hermes-aware MCP server instructions.

## Quick Dev Setup

```bash
git clone git@github.com:nanofatdog/codegraph_hermes.git
cd codegraph_hermes
npm install
npm run build        # tsc + copy schema.sql + wasm files into dist/
```

## Project Structure

```
codegraph_hermes/
├── src/
│   ├── bin/codegraph.ts          # CLI entry (commander)
│   ├── index.ts                  # CodeGraph class — public API surface
│   ├── types.ts                  # NodeKind, EdgeKind, Language types
│   ├── config.ts                 # .codegraph/config.json handling
│   ├── directory.ts              # .codegraph/ dir init/uninit
│   ├── db/                       # SQLite + FTS5 layer
│   │   ├── schema.sql            # Database schema
│   │   ├── index.ts              # DatabaseConnection
│   │   ├── queries.ts            # Prepared statements
│   │   └── sqlite-adapter.ts     # native (better-sqlite3) vs WASM fallback
│   ├── extraction/               # Tree-sitter parsing
│   │   ├── index.ts              # ExtractionOrchestrator
│   │   ├── languages/            # Per-language extractors (python.ts, rust.ts, ...)
│   │   └── parse-worker.ts       # Worker thread for heavy parsing
│   ├── resolution/               # Cross-file reference resolution
│   │   ├── index.ts              # ReferenceResolver
│   │   ├── frameworks/           # Web framework route detection
│   │   ├── import-resolver.ts    # Import chain following
│   │   └── name-matcher.ts       # Fuzzy name matching
│   ├── graph/                    # Graph traversal
│   │   ├── traversal.ts          # GraphTraverser (BFS/DFS)
│   │   └── queries.ts            # GraphQueryManager
│   ├── context/                  # Context builder for AI
│   │   ├── index.ts              # ContextBuilder
│   │   └── formatter.ts          # Markdown/JSON output
│   ├── search/                   # FTS5 query parser
│   ├── sync/                     # File watcher + incremental sync
│   ├── mcp/                      # MCP server
│   │   ├── index.ts              # MCPServer
│   │   ├── tools.ts              # Tool definitions (9 tools)
│   │   ├── server-instructions.ts # Initialize response instructions
│   │   └── transport.ts          # JSON-RPC over stdio
│   ├── installer/                # Multi-agent installer
│   │   ├── index.ts              # Orchestrator
│   │   └── targets/              # Per-agent targets
│   │       ├── hermes.ts         # ★ Hermes Agent target
│   │       ├── claude.ts         # Claude Code target
│   │       ├── cursor.ts         # Cursor target
│   │       ├── codex.ts          # Codex CLI target
│   │       ├── opencode.ts       # opencode target
│   │       ├── types.ts          # AgentTarget interface
│   │       ├── registry.ts       # ALL_TARGETS registry
│   │       ├── shared.ts         # JSON helpers, atomic writes
│   │       └── toml.ts           # TOML serializer (Codex)
│   └── ui/                       # Terminal UI (shimmer, glyphs)
├── skills/
│   └── codegraph/
│       └── SKILL.md              # ★ Hermes Agent skill
├── scripts/
│   └── hermes-setup.sh           # ★ One-command Hermes setup
├── __tests__/                    # Vitest test suite
├── AGENTS.md                     # This file (auto-read by Hermes)
└── README.md                     # User-facing docs
```

## Hermes-Specific Files (★)

| File | Purpose |
|------|---------|
| `src/installer/targets/hermes.ts` | Hermes Agent installer target — writes `~/.hermes/config.yaml` + installs skill |
| `skills/codegraph/SKILL.md` | Auto-skill for Hermes Agent — triggers on code exploration |
| `scripts/hermes-setup.sh` | One-command: install codegraph, configure Hermes, build index |
| `AGENTS.md` | This file — auto-read by Hermes as subdirectory context |

## Architecture Principles

### Data Flow

```
source files → tree-sitter parse → nodes + edges + unresolved_refs → SQLite
                                          ↓
                                   ReferenceResolver (cross-file)
                                          ↓
                                   SQLite (FTS5 indexed)
                                          ↓
                              MCP tools ← GraphTraverser ← GraphQueryManager
```

### Key Design Decisions

1. **Two-phase indexing**: Extract (per-file, parallel) → Resolve (global). Why? Per-file extraction is I/O-bound so batching helps. Resolution needs global view.

2. **Worker thread for parsing**: WASM linear memory grows but never shrinks. Worker is recycled every 250 files to reclaim memory.

3. **FTS5 with triggers**: Auto-syncs FTS index on INSERT/UPDATE/DELETE. No manual rebuild needed.

4. **Hand-rolled TOML/YAML writers**: No extra dependencies. Only write the specific config blocks needed.

5. **Atomic writes**: Write to `.tmp.<pid>`, then rename. Prevents corruption on crash.

## Adding a New Agent Target

1. Create `src/installer/targets/<name>.ts` implementing `AgentTarget`
2. Add to `TargetId` union in `types.ts`
3. Add to `ALL_TARGETS` array in `registry.ts`
4. Add test coverage in `__tests__/installer-targets.test.ts`

Interface:
```typescript
interface AgentTarget {
  readonly id: TargetId;
  readonly displayName: string;
  supportsLocation(loc: Location): boolean;
  detect(loc: Location): DetectionResult;
  install(loc: Location, opts: InstallOptions): WriteResult;
  uninstall(loc: Location): WriteResult;
  printConfig(loc: Location): string;
  describePaths(loc: Location): string[];
  wireProjectSurfaces?(): WriteResult;
}
```

## Adding a New Language

1. Create `src/extraction/languages/<lang>.ts`
2. Define extractor with: `functionTypes`, `classTypes`, `importTypes`, `callTypes`, etc.
3. Add to `LANGUAGES` array in `src/types.ts`
4. Register grammar in `src/extraction/grammars.ts`
5. Add to `languageExtractors` map in `src/extraction/languages/index.ts`
6. If language needs WASM grammar: add to `src/extraction/wasm/`
7. Update README language table

## Build & Test

```bash
npm run build           # tsc + copy-assets
npm test                # vitest run
npm run test:watch      # vitest --watch
npx vitest run __tests__/installer-targets.test.ts  # Single file
```

## MCP Server Instructions

The `SERVER_INSTRUCTIONS` constant in `src/mcp/server-instructions.ts` is sent in the MCP `initialize` response. It teaches the agent:
- Which tool for which question
- Common chains (onboarding, refactor, debug)
- Anti-patterns (don't grep, don't chain search+node)

Hermes Agent receives this automatically on MCP connection. Keep it tight — every byte burns tokens.

## Releasing

```bash
npm version patch/minor/major
npm publish
git push --tags
```

## Credits

- Original: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
- Hermes integration: [UKA](https://github.com/nanofatdog) — 18yo hacker + cyber security expert
