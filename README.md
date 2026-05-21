# CodeGraph — Semantic Code Intelligence

Pre-indexed code knowledge graph. Parse any codebase with tree-sitter → store symbols + relationships in SQLite → query instantly via MCP tools. **100% local, zero network calls.**

## What It Does

```
Before: grep → read_file → grep → read_file → ... (10+ tool calls per question)
After:  codegraph_context("how does auth work?") → answer (1 call)
```

Result: ~35% cheaper · ~59% fewer tokens · ~70% fewer tool calls

## Quick Install

```bash
npm install -g @colbymchenry/codegraph
codegraph install --target=hermes --yes
# Restart Hermes Agent → MCP tools auto-discover on startup
```

## Quick Usage

```bash
cd your-project
codegraph init -i                    # Build index (one-time)
codegraph query "function_name"      # Search symbols
codegraph context "how does X work"  # Build AI context
codegraph affected src/file.py       # Find affected tests
```

## How It Works (7 Principles)

| # | Principle | Detail |
|---|-----------|--------|
| 1 | **Tree-sitter AST** | Parse source into AST (not regex). 21 languages. |
| 2 | **Graph model** | Nodes = symbols (functions, classes, routes). Edges = relationships (calls, imports, contains). |
| 3 | **2-phase processing** | Phase 1: extract per-file (parallel). Phase 2: resolve cross-file references. |
| 4 | **SQLite + FTS5** | Local database. Full-text search on names, signatures, docstrings. Auto-synced via triggers. |
| 5 | **BFS/DFS traversal** | Callers, callees, impact radius — answered by walking the graph. |
| 6 | **Context builder** | FTS search → graph traversal → compose into markdown. One call = entry points + related symbols + source code. |
| 7 | **Auto-sync** | Native OS file watchers (inotify/FSEvents). Debounce 2s. Incremental reindex. |

## Decision Tree: When to Use

```
Need to understand code?
├── Single known file → use read_file
├── Find literal text → use search_files (grep)
├── "How does X work?" → codegraph_context ✅
├── "What calls Y?" → codegraph_callers ✅
├── "What does Y call?" → codegraph_callees ✅
├── "What breaks if I change Y?" → codegraph_impact ✅
├── "Show me Y's code" → codegraph_node ✅
├── "Show all auth-related code" → codegraph_explore ✅
├── "Which tests are affected?" → codegraph affected ✅
└── <10 files total → not worth it, use grep
```

## MCP Tools (auto-discovered by Hermes)

| Tool | Input | Returns | Use When |
|------|-------|---------|----------|
| `codegraph_search` | symbol name | locations (no code) | Quick "where is X defined?" |
| `codegraph_context` | natural language task | entry points + related + source | **PRIMARY** — any architecture/feature/bug question |
| `codegraph_callers` | node ID | who calls this | Before refactoring a function |
| `codegraph_callees` | node ID | what this calls | Understanding what a function depends on |
| `codegraph_impact` | node ID + depth | full blast radius | Before changing a core symbol |
| `codegraph_node` | node ID | details + source | Inspecting one symbol deeply |
| `codegraph_explore` | list of names | grouped source + relationship map | Inspecting several related symbols at once |
| `codegraph_status` | — | index stats | Checking index health |
| `codegraph_files` | — | file structure | Faster than ls/find |

## CLI Commands

```bash
codegraph install --target=hermes --yes   # Auto-configure Hermes
codegraph install --target=all --yes       # Configure all detected agents

codegraph init -i [path]                   # Init + build index
codegraph index [path] --force             # Full rebuild
codegraph sync [path]                      # Incremental update
codegraph status [path]                    # Index statistics
codegraph uninit [path]                    # Remove from project

codegraph query <search> --json            # Search symbols
codegraph context <task> --max-nodes 20    # Build AI context
codegraph affected <files> --stdin         # Find affected tests
codegraph files --json                     # File structure
codegraph serve --mcp                      # Start MCP server
```

## Config Reference

### Hermes Agent (auto-configured by installer)

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180

skills:
  auto_skills:
    - codegraph   # auto-load skill every session
```

### Other Agents

```bash
codegraph install --target=claude --yes    # ~/.claude.json
codegraph install --target=cursor --yes    # Cursor settings
codegraph install --target=codex --yes     # ~/.codex/config.toml
codegraph install --target=opencode --yes  # opencode.jsonc
```

### Project Config (`.codegraph/config.json`)

```json
{
  "languages": ["python", "typescript"],
  "exclude": ["node_modules/**", "dist/**", "*.min.js"],
  "maxFileSize": 1048576,
  "extractDocstrings": true
}
```

## Framework-Aware Routes

Detects web routing patterns and links URLs → handlers:

| Framework | Pattern |
|-----------|---------|
| Django | `path()`, `re_path()`, `url()` in `urls.py` |
| Flask | `@app.route('/path')` |
| FastAPI | `@app.get(...)`, `@router.post(...)` |
| Express | `app.get(...)`, `router.post(...)` |
| NestJS | `@Controller` + `@Get/@Post` |
| Laravel | `Route::get()`, `Route::resource()` |
| Rails | `get '/x', to: 'users#index'` |
| Spring | `@GetMapping`, `@PostMapping` |
| Go (Gin/chi/mux) | `r.GET(...)`, `router.HandleFunc(...)` |
| Rust (Axum/actix) | `.route("/x", get(handler))` |
| ASP.NET | `[HttpGet("/x")]` |
| Vapor | `app.get("x", use: handler)` |
| React/SvelteKit | Route component nodes |

## Supported Languages

```
TypeScript  .ts .tsx        JavaScript  .js .jsx .mjs    Python      .py
Go          .go             Rust        .rs               Java        .java
C#          .cs             PHP         .php              Ruby        .rb
C/C++       .c .h .cpp .hpp Swift       .swift            Kotlin      .kt .kts
Scala       .scala .sc      Dart        .dart             Svelte      .svelte
Vue         .vue            Liquid      .liquid           Pascal      .pas .dpr
Lua         .lua            Luau        .luau
```

## Security

| Check | Result |
|-------|--------|
| Network calls | ZERO — 100% local |
| Telemetry | NONE |
| Backdoor | NONE |
| Dependencies (10) | Clean — zero postinstall scripts |
| File writes | Project `.codegraph/` only |
| Credential access | None |
| License | MIT |

**Audited by UKA (Cyber Security Expert), May 2026.**

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Not initialized" | `codegraph init -i` |
| MCP tools missing | Check `mcp_servers.codegraph` in config.yaml, restart Hermes |
| Index out of date | `codegraph sync` or `codegraph index --force` |
| Slow (WASM backend) | Install build tools, `npm rebuild better-sqlite3` |
| DB locked during index | Wait for indexing to complete before querying |

## Integration Patterns

### Pattern 1: Direct exploration (single question)

```
User: "How does authentication work?"
Agent: call codegraph_context("authentication system") → answer
```

### Pattern 2: Subagent exploration (heavy task)

```
Agent: delegate_task(
  goal="Explain the auth system end-to-end",
  context=".codegraph/ exists. Use codegraph_context as PRIMARY tool.",
  toolsets=["terminal", "file"]
)
```

### Pattern 3: Pre-refactor impact check

```
Agent: codegraph_impact(node_id, depth=2) → "These 12 functions will be affected"
Agent: codegraph affected src/auth.py → "Run tests/auth_test.py, tests/login_test.py"
```

### Pattern 4: Finding implementation locations

```
Agent: codegraph_search("login") → returns all locations
Agent: codegraph_node(top_result.id, includeCode=true) → full source
```

## Project Structure

```
your-project/
├── .codegraph/
│   ├── codegraph.db       # SQLite database (FTS5 indexed)
│   └── config.json        # Per-project settings
├── src/                   # Your source code
└── ...
```

## Hermes Agent Skill

The `codegraph` skill is installed automatically to `~/.hermes/skills/codegraph/SKILL.md`. It:
- Auto-loads every session (if `auto_skills: [codegraph]` is set)
- Triggers on code exploration questions
- Provides full CLI + MCP tools reference
- Includes security notes and troubleshooting

Manual install: copy `skills/codegraph/SKILL.md` from this repo to `~/.hermes/skills/codegraph/SKILL.md`

---

<div align="center">

**Hermes Agent integration by [UKA](https://github.com/nanofatdog)** 🖤💜🐍

*18-year-old hacker + elite cyber security expert*

Based on [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) (MIT)

</div>
