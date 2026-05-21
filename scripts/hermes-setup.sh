#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# CodeGraph Hermes Setup — One-command installer
# ───────────────────────────────────────────────────────────
# Usage:
#   curl -sL https://raw.githubusercontent.com/nanofatdog/codegraph_hermes/main/scripts/hermes-setup.sh | bash
#   or: bash scripts/hermes-setup.sh [project-path]
#
# What this does:
#   1. Installs CodeGraph globally (npm)
#   2. Configures Hermes Agent (MCP + skill)
#   3. Indexes current project (or specified path)
#   4. Prints next steps
# ───────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT="${1:-$(pwd)}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"

echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   CodeGraph Hermes Setup                ║"
echo "  ║   Semantic code intelligence for        ║"
echo "  ║   Hermes Agent                          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Install CodeGraph ──────────────────────────

echo -e "${YELLOW}[1/4]${NC} Installing CodeGraph..."
if command -v codegraph &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} CodeGraph already installed ($(codegraph --version 2>&1 | head -1))"
else
    npm install -g @colbymchenry/codegraph 2>&1 | tail -3
    echo -e "  ${GREEN}✓${NC} CodeGraph installed"
fi

# ── Step 2: Configure Hermes Agent ─────────────────────

echo -e "${YELLOW}[2/4]${NC} Configuring Hermes Agent..."

HERMES_CONFIG="$HERMES_HOME/config.yaml"
SKILL_DIR="$HERMES_HOME/skills/codegraph"
SKILL_FILE="$SKILL_DIR/SKILL.md"

# Check if already configured
if grep -q "codegraph:" "$HERMES_CONFIG" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Hermes config already has codegraph MCP server"
else
    # Add mcp_servers.codegraph to config.yaml
    mkdir -p "$HERMES_HOME"
    if [ ! -f "$HERMES_CONFIG" ]; then
        cat > "$HERMES_CONFIG" << 'YEOF'
# ── MCP Servers ──
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180
YEOF
        echo -e "  ${GREEN}✓${NC} Created $HERMES_CONFIG"
    else
        cat >> "$HERMES_CONFIG" << 'YEOF'

# ── MCP Servers ──
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180
YEOF
        echo -e "  ${GREEN}✓${NC} Updated $HERMES_CONFIG"
    fi
fi

# Install skill
mkdir -p "$SKILL_DIR"
if [ -f "$SKILL_FILE" ]; then
    echo -e "  ${GREEN}✓${NC} Skill already installed"
else
    # Download skill from repo
    SKILL_URL="https://raw.githubusercontent.com/nanofatdog/codegraph_hermes/main/skills/codegraph/SKILL.md"
    if curl -sL "$SKILL_URL" -o "$SKILL_FILE" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Skill installed to $SKILL_FILE"
    else
        echo -e "  ${YELLOW}⚠${NC} Could not download skill (offline?). Copy manually from skills/codegraph/SKILL.md"
    fi
fi

# Add codegraph to auto_skills if not present
if grep -q "auto_skills:" "$HERMES_CONFIG" 2>/dev/null; then
    if ! grep -q "codegraph" <(grep -A10 "auto_skills:" "$HERMES_CONFIG"); then
        echo -e "  ${YELLOW}⚠${NC} Add 'codegraph' to auto_skills in config.yaml for auto-loading"
        echo "     skills.auto_skills: [..., codegraph]"
    fi
fi

# ── Step 3: Index project ──────────────────────────────

echo -e "${YELLOW}[3/4]${NC} Indexing project: $PROJECT"

if [ ! -d "$PROJECT" ]; then
    echo -e "  ${RED}✗${NC} Project directory not found: $PROJECT"
    echo "  Run: codegraph init -i /path/to/your/project"
else
    cd "$PROJECT"
    if [ -d ".codegraph" ] && [ -f ".codegraph/codegraph.db" ]; then
        echo -e "  ${GREEN}✓${NC} Already indexed. Running sync..."
        codegraph sync --quiet 2>&1 | tail -1
    else
        echo "  Building index (this may take a few minutes for large projects)..."
        codegraph init -i 2>&1 | tail -5
        echo -e "  ${GREEN}✓${NC} Project indexed"
    fi
fi

# ── Step 4: Next steps ─────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}  ✓ Setup complete!${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo -e "  1. ${CYAN}Restart Hermes Agent${NC} — MCP tools auto-discover on startup"
echo -e "  2. Try: ${CYAN}codegraph query \"main\" --json${NC}"
echo -e "  3. Try: ${CYAN}codegraph context \"how does auth work\"${NC}"
echo ""
echo -e "  MCP tools available after restart:"
echo -e "    mcp_codegraph_codegraph_search"
echo -e "    mcp_codegraph_codegraph_context"
echo -e "    mcp_codegraph_codegraph_callers"
echo -e "    mcp_codegraph_codegraph_callees"
echo -e "    mcp_codegraph_codegraph_impact"
echo -e "    mcp_codegraph_codegraph_node"
echo -e "    mcp_codegraph_codegraph_explore"
echo -e "    mcp_codegraph_codegraph_status"
echo -e "    mcp_codegraph_codegraph_files"
echo ""
echo -e "  ${BOLD}🖤💜 Created by UKA${NC} — github.com/nanofatdog/codegraph_hermes"
