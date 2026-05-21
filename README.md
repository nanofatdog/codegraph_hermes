<div align="center">

# CodeGraph for Hermes Agent

### Supercharge Hermes Agent with Semantic Code Intelligence

**~35% cheaper · ~70% fewer tool calls · 100% local**

[![npm version](https://img.shields.io/npm/v/@colbymchenry/codegraph.svg)](https://www.npmjs.com/package/@colbymchenry/codegraph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20--24-green.svg)](https://nodejs.org/)

[![Hermes Agent](https://img.shields.io/badge/Hermes_Agent-supported-blueviolet.svg)](#)
[![Claude Code](https://img.shields.io/badge/Claude_Code-supported-blueviolet.svg)](#)
[![Cursor](https://img.shields.io/badge/Cursor-supported-blueviolet.svg)](#)
[![Codex CLI](https://img.shields.io/badge/Codex_CLI-supported-blueviolet.svg)](#)
[![opencode](https://img.shields.io/badge/opencode-supported-blueviolet.svg)](#)

<br />

> 🖤💜 **Hermes Agent integration created by [UKA](https://github.com/nanofatdog)**
>
> *18-year-old hacker + elite cyber security expert*
>
> *"I don't grep — I query the graph."* 🐍

<br />

### Get Started

```bash
# Install CodeGraph
npm install -g @colbymchenry/codegraph

# Configure for Hermes Agent
codegraph install --target=hermes --yes

# Restart Hermes Agent — MCP tools auto-discover on startup
```

<sub>Hermes Agent's built-in MCP client auto-discovers CodeGraph tools on startup. No separate setup needed.</sub>

#### Initialize Projects

```bash
cd your-project
codegraph init -i
```

![1_C_VYnhpys0UHrOuOgpgoyw](https://github.com/user-attachments/assets/f168182f-4d9a-44e0-94d7-08d018cc8a3a)

</div>

---

## Why CodeGraph for Hermes Agent?

When Hermes Agent explores a codebase with `search_files` + `read_file`, it consumes tokens on every grep and file read — often spawning `delegate_task` subagents that repeat the same pattern.

**CodeGraph gives Hermes Agent a pre-indexed knowledge graph** — symbol relationships, call graphs, and code structure. The agent queries the graph instantly through MCP tools instead of scanning files.

### Hermes Agent MCP Tools

After running `codegraph install --target=hermes --yes`, Hermes Agent gets **9 MCP tools** auto-discovered on startup:

| Tool | Purpose |
|------|---------|
| `mcp_codegraph_codegraph_search` | Find symbols by name across the codebase |
| `mcp_codegraph_codegraph_context` | **PRIMARY** — build code context for any task in one call |
| `mcp_codegraph_codegraph_callers` | Find what calls a function |
| `mcp_codegraph_codegraph_callees` | Find what a function calls |
| `mcp_codegraph_codegraph_impact` | Analyze blast radius before refactoring |
| `mcp_codegraph_codegraph_node` | Get symbol details with source code |
| `mcp_codegraph_codegraph_explore` | Deep exploration of related symbols |
| `mcp_codegraph_codegraph_files` | File structure from index |
| `mcp_codegraph_codegraph_status` | Index health and statistics |

These tools are available across **all Hermes platforms** — CLI, Discord, Telegram, Slack, WhatsApp, and more.

### Benchmark Results

Tested across **7 real-world open-source codebases** spanning 7 languages, comparing an agent answering one architecture question **with** and **without** CodeGraph. Each cell is the savings at the **median of 4 runs per arm**.

> **Average: 35% cheaper · 59% fewer tokens · 49% faster · 70% fewer tool calls**

| Codebase | Language | Cost | Tokens | Time | Tool calls |
|----------|----------|------|--------|------|------------|
| **VS Code** | TypeScript · ~10k files | 35% cheaper | 73% fewer | 41% faster | 72% fewer |
| **Excalidraw** | TypeScript · ~600 | 47% cheaper | 73% fewer | 60% faster | 86% fewer |
| **Django** | Python · ~2.7k | 34% cheaper | 64% fewer | 59% faster | 81% fewer |
| **Tokio** | Rust · ~700 | 52% cheaper | 81% fewer | 63% faster | 89% fewer |
| **OkHttp** | Java · ~640 | 17% cheaper | 41% fewer | 36% faster | 64% fewer |
| **Gin** | Go · ~150 | 22% cheaper | 23% fewer | 34% faster | 19% fewer |
| **Alamofire** | Swift · ~100 | 38% cheaper | 59% fewer | 51% faster | 77% fewer |

The gains scale with codebase size: on large repos the agent answers from the index in a handful of calls with **zero file reads**, while the no-CodeGraph agent fans out across grep/find/Read (and the sub-agents it spawns).

---

## Hermes Agent Quick Start

### 1. One-Command Install

```bash
npx @colbymchenry/codegraph install --target=hermes --yes
```

This writes:
- **`~/.hermes/config.yaml`** — adds `mcp_servers.codegraph` section
- **`~/.hermes/skills/codegraph/SKILL.md`** — installs the CodeGraph skill (auto-loaded every session)

### 2. Restart Hermes Agent

MCP tools are auto-discovered on startup. Look for:
```
MCP servers have been reloaded. Added servers: codegraph.
9 MCP tool(s) now available.
```

### 3. Initialize Projects

```bash
cd your-project
codegraph init -i
```

### 4. Use from Hermes Agent

The skill auto-loads. Just ask natural questions:
- "How does the authentication system work?"
- "What calls the login() function?"
- "What breaks if I change the User model?"

CodeGraph tools will be used automatically instead of grep/read_file.

---

## Manual Setup (Alternative)

Add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180
```

Add `codegraph` to auto_skills (optional, for automatic skill loading):

```yaml
skills:
  auto_skills:
    - codegraph
```

---

## Key Features

| | |
|---|---|
| **Smart Context Building** | One tool call returns entry points, related symbols, and code snippets — no expensive exploration subagents |
| **Full-Text Search** | Find code by name instantly across your entire codebase, powered by FTS5 |
| **Impact Analysis** | Trace callers, callees, and the full impact radius of any symbol before making changes |
| **Always Fresh** | File watcher uses native OS events (FSEvents/inotify/ReadDirectoryChangesW) with debounced auto-sync |
| **21+ Languages** | TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, C, C++, Swift, Kotlin, Dart, Lua, Luau, Svelte, Vue, Liquid, Pascal/Delphi, Scala |
| **Framework-aware Routes** | Recognizes web-framework routing files and links URL patterns to their handlers across 13 frameworks |
| **100% Local** | No data leaves your machine. No API keys. No external services. SQLite database only |
| **Hermes Native** | Built-in MCP client support. Tools auto-discover on startup. Works across all platforms. |

---

## Framework-aware Routes

CodeGraph detects web-framework routing files and emits `route` nodes linked by `references` edges to their handler classes or functions.

| Framework | Shapes recognized |
|---|---|
| **Django** | `path()`, `re_path()`, `url()`, `include()` in `urls.py` |
| **Flask** | `@app.route('/path', methods=[...])`, blueprint routes |
| **FastAPI** | `@app.get(...)`, `@router.post(...)`, all standard methods |
| **Express** | `app.get(...)`, `router.post(...)` with middleware chains |
| **NestJS** | `@Controller` + `@Get/@Post/...`, GraphQL resolvers |
| **Laravel** | `Route::get()`, `Route::resource()`, `Controller@action` |
| **Rails** | `get '/x', to: 'users#index'`, hash-rocket syntax |
| **Spring** | `@GetMapping`, `@PostMapping`, `@RequestMapping` |
| **Gin / chi / gorilla / mux** | `r.GET(...)`, `router.HandleFunc(...)` |
| **Axum / actix / Rocket** | `.route("/x", get(handler))` |
| **ASP.NET** | `[HttpGet("/x")]` attributes |
| **Vapor** | `app.get("x", use: handler)` |
| **React Router / SvelteKit** | Route component nodes |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      Hermes Agent                                │
│                                                                  │
│  "How does the MCP client connect to servers?"                   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │  codegraph_context("MCP client connection")     │            │
│  │  → FTS search → graph traversal → context       │            │
│  │  ONE call instead of grep→read→grep→read...     │            │
│  └──────────────────────┬──────────────────────────┘            │
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────┐
│                     CodeGraph MCP Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Search    │  │   Callers   │  │   Context   │               │
│  │  "mcp"      │  │ "connect()" │  │  for task   │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                       │
│         └────────────────┼────────────────┘                       │
│                          ▼                                        │
│              ┌───────────────────────┐                            │
│              │   SQLite Graph DB     │                            │
│              │   • 34,000+ symbols   │                            │
│              │   • 32,000+ edges     │                            │
│              │   • Instant lookups   │                            │
│              └───────────────────────┘                            │
└───────────────────────────────────────────────────────────────────┘
```

1. **Extraction** — [tree-sitter](https://tree-sitter.github.io/) parses source code into ASTs. Language-specific queries extract nodes (functions, classes, methods) and edges (calls, imports, extends, implements).

2. **Storage** — Everything goes into a local SQLite database (`.codegraph/codegraph.db`) with FTS5 full-text search.

3. **Resolution** — After extraction, references are resolved: function calls → definitions, imports → source files, class inheritance, and framework-specific patterns.

4. **Auto-Sync** — The MCP server watches your project using native OS file events. Changes are debounced (2-second quiet window), filtered to source files only, and incrementally synced.

---

## CLI Reference

```bash
codegraph                         # Run interactive installer
codegraph install                 # Run installer (explicit)
codegraph install --target=hermes --yes  # Auto-configure Hermes Agent
codegraph init [path]             # Initialize in a project (--index to also index)
codegraph uninit [path]           # Remove CodeGraph from a project (--force to skip prompt)
codegraph index [path]            # Full index (--force to re-index, --quiet for less output)
codegraph sync [path]             # Incremental update
codegraph status [path]           # Show statistics
codegraph query <search>          # Search symbols (--kind, --limit, --json)
codegraph files [path]            # Show file structure
codegraph context <task>          # Build context for AI (--format, --max-nodes)
codegraph affected [files...]     # Find test files affected by changes
codegraph serve --mcp             # Start MCP server
```

---

## Security

CodeGraph is **audited and verified safe**:

| Check | Result |
|-------|--------|
| Network calls | ✅ ZERO — 100% local |
| Telemetry / analytics | ✅ NONE |
| Backdoor / obfuscated code | ✅ NONE FOUND |
| Supply chain (10 deps) | ✅ CLEAN — zero postinstall scripts |
| File access | ✅ Project directory only |
| Credential access | ✅ NO env/secret reading |
| Hermes MCP safety | ✅ Env filtering prevents secret leaks |

**Audited by UKA** — Cyber Security Expert, May 2026.

---

## Supported Languages

| Language | Extension | Status |
|----------|-----------|--------|
| TypeScript | `.ts`, `.tsx` | Full support |
| JavaScript | `.js`, `.jsx`, `.mjs` | Full support |
| Python | `.py` | Full support |
| Go | `.go` | Full support |
| Rust | `.rs` | Full support |
| Java | `.java` | Full support |
| C# | `.cs` | Full support |
| PHP | `.php` | Full support |
| Ruby | `.rb` | Full support |
| C | `.c`, `.h` | Full support |
| C++ | `.cpp`, `.hpp`, `.cc` | Full support |
| Swift | `.swift` | Full support |
| Kotlin | `.kt`, `.kts` | Full support |
| Scala | `.scala`, `.sc` | Full support |
| Dart | `.dart` | Full support |
| Svelte | `.svelte` | Full support |
| Vue | `.vue` | Full support |
| Liquid | `.liquid` | Full support |
| Pascal / Delphi | `.pas`, `.dpr`, `.dpk`, `.lpr` | Full support |
| Lua | `.lua` | Full support |
| Luau | `.luau` | Full support |

---

## Installation Targets

| Target | Command |
|--------|---------|
| **Hermes Agent** | `codegraph install --target=hermes --yes` |
| Claude Code | `codegraph install --target=claude --yes` |
| Cursor | `codegraph install --target=cursor --yes` |
| Codex CLI | `codegraph install --target=codex --yes` |
| opencode | `codegraph install --target=opencode --yes` |
| All detected | `codegraph install --target=auto --yes` |

---

## Troubleshooting

**"CodeGraph not initialized"** — Run `codegraph init` in your project directory first.

**MCP tools not appearing in Hermes** — Verify `~/.hermes/config.yaml` has `mcp_servers.codegraph`. Restart Hermes.

**Indexing is slow** — Check that `node_modules` and other large directories are excluded. Use `--quiet` to reduce output overhead.

**WASM fallback active** — Run `codegraph status`. If `Backend: wasm`, install build tools and `npm rebuild better-sqlite3`.

**Missing symbols** — The MCP server auto-syncs on save (wait a couple seconds). Run `codegraph sync` manually if needed.

---

## Star History

<a href="https://www.star-history.com/?repos=colbymchenry%2Fcodegraph&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&legend=top-left" />
 </picture>
</a>

## License

MIT — Original CodeGraph by [colbymchenry](https://github.com/colbymchenry). Hermes Agent integration by [UKA](https://github.com/nanofatdog).

Based on [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) (12.5k+ stars).

---

<div align="center">

**Hermes Agent integration crafted with 🖤💜🐍 by [UKA](https://github.com/nanofatdog)**

*18-year-old girl · world-class hacker coder · elite cyber security expert*

[Report Bug](https://github.com/nanofatdog/codegraph_hermes/issues) · [Original Repo](https://github.com/colbymchenry/codegraph)

</div>
