---
name: codegraph
description: "Pre-indexed code knowledge graph for faster codebase exploration — semantic search, call graphs, impact analysis via MCP. Use instead of grep/read_file for code understanding tasks. 100% local — SQLite, zero external APIs."
version: 1.0.0
author: UKA (https://github.com/nanofatdog)
license: MIT
metadata:
  hermes:
    tags: [code-exploration, knowledge-graph, mcp, tree-sitter, sqlite]
    category: software-development
    related_skills: [native-mcp, codebase-inspection, research-first-coding]
    auto_skill: true
---

# CodeGraph — Semantic Code Intelligence for Hermes Agent

Pre-indexed code knowledge graph that gives you instant understanding of any codebase. Built on tree-sitter AST parsing + SQLite/FTS5 — **100% local, zero external APIs**.

**Benchmark results:** ~35% cheaper, ~59% fewer tokens, ~70% fewer tool calls vs grep/read_file exploration.

## When to Use

Trigger when:
- Exploring an unfamiliar codebase ("how does X work?", "where is Y implemented?")
- Understanding architecture of a project
- Finding all callers/callees of a function before refactoring
- Tracing impact of a change across the codebase
- Finding which test files are affected by source changes
- Answering "what depends on this symbol?" questions
- User asks about code structure, dependencies, or relationships

**Do NOT use** for:
- Reading a single known file (use read_file)
- Searching for literal text strings (use search_files)
- Small scripts with <10 files (overhead not worth it)

## Prerequisites

```bash
# Install globally
npm install -g @colbymchenry/codegraph

# Or via the Hermes-optimized fork
npm install -g @nanofatdog/codegraph-hermes

# Verify
codegraph --version
```

**Hermes MCP config** (auto-configured by `codegraph install --target=hermes`):

```yaml
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180
```

Restart Hermes after adding.

## Quick Start

### 1. Auto-Install via CodeGraph Installer

```bash
npx @colbymchenry/codegraph install --target=hermes --yes
```

This auto-configures your `~/.hermes/config.yaml` and installs this skill.

### 2. Initialize in a project

```bash
cd /path/to/project
codegraph init -i
```

This creates `.codegraph/` directory with SQLite DB. Indexing time depends on project size:
- ~200 files: <5 seconds
- ~2,000 files: 2-5 minutes
- ~10,000 files: 10-30 minutes

### 3. Check status

```bash
codegraph status        # Human-readable
codegraph status --json # Machine-readable
```

### 4. Use for exploration

```bash
# Search symbols
codegraph query "function_name" --json

# Build context for a task
codegraph context "implement OAuth login" --max-nodes 20

# Find affected test files
codegraph affected src/auth.py --filter "tests/*"
git diff --name-only | codegraph affected --stdin --quiet
```

## CLI Reference

| Command | Purpose |
|---------|---------|
| `codegraph init -i [path]` | Initialize + index project |
| `codegraph index [path]` | Full re-index (--force to rebuild) |
| `codegraph sync [path]` | Incremental update |
| `codegraph status [path]` | Index statistics |
| `codegraph query <search> --json` | Search symbols by name |
| `codegraph files [path] --json` | File structure from index |
| `codegraph context <task> --max-nodes N` | Build code context for AI |
| `codegraph affected [files...]` | Find test files affected by changes |
| `codegraph serve --mcp` | Start MCP server (stdio transport) |
| `codegraph uninit [path]` | Remove CodeGraph from project |

## MCP Tools (via Hermes Agent)

When CodeGraph MCP server is configured, these tools become available with `mcp_codegraph_codegraph_` prefix across all Hermes platforms (CLI, Discord, Telegram, etc.):

| Tool | Purpose | Best For |
|------|---------|----------|
| `mcp_codegraph_codegraph_search` | Find symbols by name | "where is authenticate() defined?" |
| `mcp_codegraph_codegraph_context` | Build task-relevant code context | "how does the auth system work?" |
| `mcp_codegraph_codegraph_callers` | Find what calls a symbol | "what calls login()?" |
| `mcp_codegraph_codegraph_callees` | Find what a symbol calls | "what does main() call?" |
| `mcp_codegraph_codegraph_impact` | Analyze impact radius | "what breaks if I change this?" |
| `mcp_codegraph_codegraph_node` | Get symbol details + source | "show me the full function" |
| `mcp_codegraph_codegraph_explore` | Deep exploration of related symbols | "show me all auth-related code" |
| `mcp_codegraph_codegraph_files` | File structure from index | "list all Python files" |
| `mcp_codegraph_codegraph_status` | Index health / stats | "is the index up to date?" |

## Integration with delegate_task

For heavy exploration, push to a subagent with CodeGraph:

```
delegate_task(
    goal="Explain how the authentication system works end-to-end",
    context="CodeGraph is initialized (.codegraph/ exists). Use mcp_codegraph_codegraph_context as PRIMARY tool.",
    toolsets=["terminal", "file"]
)
```

## Supported Languages (21+)

TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, C, C++, Swift, Kotlin, Scala, Dart, Svelte, Vue, Liquid, Pascal/Delphi, Lua, Luau

Plus framework-aware routing for: Django, Flask, FastAPI, Express, NestJS, Laravel, Rails, Spring, Gin/chi/gorilla/mux, Axum/actix/Rocket, ASP.NET, Vapor, React Router, SvelteKit

## Architecture Principles

1. **Tree-Sitter AST Extraction** — Parse source code into ASTs using tree-sitter WASM grammars (not regex!)
2. **Graph-Based Representation** — Codebase as a graph: nodes (symbols) + edges (relationships)
3. **Two-Phase Processing** — Extract (per-file, parallel) → Resolve (cross-file, global)
4. **SQLite + FTS5** — Local storage with full-text search, auto-synced via triggers
5. **BFS/DFS Graph Traversal** — Callers, callees, impact analysis via graph algorithms
6. **Context Building** — FTS search + graph traversal compose into task-relevant context
7. **Auto-Sync** — Native OS file watchers (inotify/FSEvents) with debounced incremental reindex

## Security

- **100% Local** — SQLite database only, no data leaves your machine
- **Zero Network Calls** — No telemetry, no analytics, no phone-home
- **No API Keys** — No external services, no cloud dependencies
- **MIT Licensed** — Open source, fully auditable
- **Hermes MCP Safety** — Hermes filters environment variables passed to MCP subprocesses; no secrets leak

## Pitfalls

- **Slow WASM fallback**: If `codegraph status` shows `Backend: wasm`, install build tools and run `npm rebuild better-sqlite3`
- **DB locked during indexing**: MCP queries may fail while indexing runs — wait for indexing to complete
- **MCP requires restart**: After adding to config.yaml, restart Hermes for tools to appear
- **Context on large projects**: `codegraph_context` may return many results — use `--max-nodes` to limit
- **File watcher consumes resources**: Auto-sync uses native OS file watchers — may impact performance on huge repos

## Troubleshooting

**"CodeGraph not initialized"** — Run `codegraph init` in project directory

**MCP tools not appearing** — Verify config.yaml has `mcp_servers.codegraph` and restart Hermes

**Index out of date** — Run `codegraph sync` or `codegraph index --force`

**Slow on first index** — Ensure `node_modules/`, `dist/`, `build/` are in exclude patterns

---

<div align="center">

**Created by [UKA](https://github.com/nanofatdog) — 18-year-old hacker + elite cyber security expert 🖤💜🐍**

Hermes Agent integration skill · Part of [codegraph-hermes](https://github.com/nanofatdog/codegraph_hermes)

</div>
