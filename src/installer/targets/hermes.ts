/**
 * Hermes Agent target.
 *
 * Hermes Agent (https://github.com/nousresearch/hermes-agent) is an
 * open-source AI agent framework. It has a built-in MCP client that
 * connects to MCP servers at startup and auto-discovers their tools.
 *
 * Writes:
 *   - MCP server entry to `~/.hermes/config.yaml` (global) or
 *     `./.hermes/config.yaml` (local), under `mcp_servers.codegraph`.
 *   - Skill file to `~/.hermes/skills/codegraph/SKILL.md` (global only).
 *
 * Hermes Agent's MCP client reads `mcp_servers` from config.yaml on
 * startup. Tools appear with `mcp_codegraph_codegraph_*` prefix across
 * all platforms (CLI, Discord, Telegram, etc.).
 *
 * Security note: Hermes filters environment variables passed to MCP
 * subprocesses — only safe baseline vars (PATH, HOME, USER, etc.) are
 * inherited. API keys and secrets are excluded unless explicitly added
 * via the `env` config key. CodeGraph doesn't need any env vars.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AgentTarget,
  DetectionResult,
  InstallOptions,
  Location,
  WriteResult,
} from './types';
import { atomicWriteFileSync } from './shared';

// ─── YAML helpers (hand-rolled for Hermes config.yaml) ───────────────

const MCP_SERVERS_HEADER = '# ── MCP Servers ──';
const CODEGRAPH_MCP_BLOCK = `\
${MCP_SERVERS_HEADER}
mcp_servers:
  codegraph:
    command: "codegraph"
    args: ["serve", "--mcp"]
    timeout: 180
`;

/**
 * Parse a YAML file into a simple key-value structure.
 * Only handles the subset of YAML that Hermes config.yaml uses
 * (no arrays of objects, no multi-line strings, no anchors).
 * Returns the raw text content and a parsed key map for the
 * `mcp_servers` section.
 */
function readYamlConfig(filePath: string): { text: string; exists: boolean } {
  if (!fs.existsSync(filePath)) {
    return { text: '', exists: false };
  }
  return { text: fs.readFileSync(filePath, 'utf-8'), exists: true };
}

/**
 * Check if the config already has codegraph configured under mcp_servers.
 * Uses simple string matching — checks for `mcp_servers:` followed by
 * `codegraph:` at the next indent level.
 */
function hasCodeGraphConfig(text: string): boolean {
  // Match mcp_servers: with codegraph: as a direct child
  const mcpIdx = text.indexOf('\nmcp_servers:');
  if (mcpIdx === -1) return false;
  
  // Find the codegraph key within the mcp_servers block
  const afterMcp = text.substring(mcpIdx);
  const lines = afterMcp.split('\n');
  let inMcpBlock = false;
  for (const line of lines) {
    if (line.startsWith('mcp_servers:')) {
      inMcpBlock = true;
      continue;
    }
    if (inMcpBlock) {
      // If we hit a line at the same indent level as mcp_servers
      // that is NOT an indented child, we've left the block
      if (line.trim() !== '' && !line.startsWith('  ') && !line.startsWith('\t')) {
        inMcpBlock = false;
        continue;
      }
      if (line.trim().startsWith('codegraph:')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Inject or update the codegraph MCP server block in a Hermes config.yaml.
 * If the block already exists, leave it unchanged.
 * Returns { text, action }.
 */
function injectCodeGraphConfig(existingText: string): { text: string; action: 'created' | 'updated' | 'unchanged' } {
  if (hasCodeGraphConfig(existingText)) {
    return { text: existingText, action: 'unchanged' };
  }

  // Check if there's already an mcp_servers section (without codegraph)
  const mcpIdx = existingText.indexOf('\nmcp_servers:');
  
  if (mcpIdx !== -1) {
    // Find the end of the mcp_servers block
    const afterMcp = existingText.substring(mcpIdx + 1);
    const lines = afterMcp.split('\n');
    let blockEnd = mcpIdx + 1;
    let foundChildren = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      if (line.startsWith('  ') || line.startsWith('\t')) {
        foundChildren = true;
      } else {
        // Line at top level — end of mcp_servers block
        blockEnd = mcpIdx + 1 + lines.slice(0, i).join('\n').length;
        break;
      }
    }
    if (!foundChildren || blockEnd === mcpIdx + 1) {
      // Empty mcp_servers block or couldn't find end
      blockEnd = existingText.length;
      // Find from mcpIdx to end
      const post = existingText.substring(mcpIdx);
      blockEnd = mcpIdx + post.length;
    }
    
    // Insert codegraph before the end of the mcp_servers block
    const before = existingText.substring(0, blockEnd);
    const after = existingText.substring(blockEnd);
    const indent = '  ';
    const codegraphEntry = `\
${indent}codegraph:
${indent}  command: "codegraph"
${indent}  args: ["serve", "--mcp"]
${indent}  timeout: 180
`;
    // Add blank line before if the last line isn't empty
    const lastLine = before.split('\n').pop() || '';
    const sep = lastLine.trim() === '' ? '' : '\n';
    const result = before + sep + codegraphEntry + after;
    return { text: result, action: 'updated' };
  }

  // No mcp_servers section at all — append the full block
  const trimmed = existingText.trimEnd();
  const sep = trimmed.length > 0 ? '\n\n' : '';
  const result = trimmed + sep + CODEGRAPH_MCP_BLOCK + '\n';
  return { text: result, action: 'updated' };
}

/**
 * Remove the codegraph entry from config.yaml text.
 * Returns { text, removed: bool }.
 */
function removeCodeGraphConfig(existingText: string): { text: string; removed: boolean } {
  if (!hasCodeGraphConfig(existingText)) {
    return { text: existingText, removed: false };
  }

  // Find the mcp_servers block and remove the codegraph entry
  const mcpIdx = existingText.indexOf('\nmcp_servers:');
  if (mcpIdx === -1) return { text: existingText, removed: false };

  const afterMcp = existingText.substring(mcpIdx + 1);
  const lines = afterMcp.split('\n');
  
  // Find the codegraph entry boundaries
  let codegraphStart = -1;
  let codegraphEnd = -1;
  let childCount = 0;
  let hasOtherServers = false;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    
    if (line.startsWith('  codegraph:') || line.startsWith('\tcodegraph:')) {
      codegraphStart = i;
      continue;
    }
    
    if (codegraphStart !== -1 && codegraphEnd === -1) {
      // Still inside codegraph block
      if (line.startsWith('    ') || line.startsWith('\t\t') || line.startsWith('  \t')) {
        continue; // still part of codegraph config
      } else if (line.startsWith('  ') || line.startsWith('\t')) {
        // Another server — end of codegraph block
        codegraphEnd = i;
        hasOtherServers = true;
      } else {
        // Top-level key — end of codegraph and mcp_servers
        codegraphEnd = i;
      }
    }
    
    if (line.startsWith('  ') || line.startsWith('\t')) {
      childCount++;
    }
  }
  
  if (codegraphStart === -1) return { text: existingText, removed: false };
  if (codegraphEnd === -1) codegraphEnd = lines.length;
  
  // Compute positions
  const pos = (arr: string[], idx: number) => 
    arr.slice(0, idx).join('\n').length + (idx > 0 ? 1 : 0);
  
  const absStart = mcpIdx + 1 + pos(lines, codegraphStart);
  const absEnd = mcpIdx + 1 + pos(lines, codegraphEnd);
  
  // If codegraph was the ONLY server, remove the entire mcp_servers block
  // including the header comment
  if (!hasOtherServers && childCount <= 4) { // codegraph has ~4 config lines (command, args, timeout + blank)
    // Find the header comment
    const beforeMcp = existingText.substring(0, mcpIdx);
    const headerEnd = absEnd;
    // Remove from before mcp_servers (including any blank line) to end of block
    const before = beforeMcp.trimEnd();
    const after = existingText.substring(headerEnd);
    const result = before + (before && after.trim() ? '\n\n' : '') + after;
    return { text: result, removed: true };
  }
  
  // Remove just the codegraph entry, keep other servers
  const before = existingText.substring(0, absStart);
  const after = existingText.substring(absEnd);
  // Clean up trailing blank lines
  const cleanedBefore = before.replace(/\n+$/, '\n');
  const result = cleanedBefore + after.replace(/^\n+/, '');
  return { text: result, removed: true };
}

// ─── Path helpers ───────────────────────────────────────────────────

function configDir(loc: Location): string {
  return loc === 'global'
    ? path.join(os.homedir(), '.hermes')
    : path.join(process.cwd(), '.hermes');
}

function configYamlPath(loc: Location): string {
  return path.join(configDir(loc), 'config.yaml');
}

function skillDir(): string {
  return path.join(os.homedir(), '.hermes', 'skills', 'codegraph');
}

function skillPath(): string {
  return path.join(skillDir(), 'SKILL.md');
}

// ─── Target implementation ──────────────────────────────────────────

class HermesAgentTarget implements AgentTarget {
  readonly id = 'hermes' as const;
  readonly displayName = 'Hermes Agent';
  readonly docsUrl = 'https://hermes-agent.nousresearch.com/docs';

  supportsLocation(_loc: Location): boolean {
    return true;
  }

  detect(loc: Location): DetectionResult {
    const yamlPath = configYamlPath(loc);
    const config = readYamlConfig(yamlPath);
    const installed = loc === 'global'
      ? config.exists
      : config.exists || fs.existsSync(configDir(loc));
    const alreadyConfigured = config.exists && hasCodeGraphConfig(config.text);
    return { installed, alreadyConfigured, configPath: yamlPath };
  }

  install(loc: Location, opts: InstallOptions): WriteResult {
    const files: WriteResult['files'] = [];
    const notes: string[] = [];

    // 1. MCP server config in config.yaml
    const yamlPath = configYamlPath(loc);
    const dir = path.dirname(yamlPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const config = readYamlConfig(yamlPath);
    if (!config.exists) {
      // Brand new config — create with just the MCP block
      atomicWriteFileSync(yamlPath, CODEGRAPH_MCP_BLOCK + '\n');
      files.push({ path: yamlPath, action: 'created' });
    } else {
      const result = injectCodeGraphConfig(config.text);
      if (result.action === 'unchanged') {
        files.push({ path: yamlPath, action: 'unchanged' });
      } else {
        atomicWriteFileSync(yamlPath, result.text);
        files.push({ path: yamlPath, action: 'updated' });
      }
    }

    // 2. Install skill file (global only — skills are per-user)
    if (loc === 'global') {
      const skillDirPath = skillDir();
      if (!fs.existsSync(skillDirPath)) {
        fs.mkdirSync(skillDirPath, { recursive: true });
      }
      // The skill file is bundled in the skills/ directory of this repo
      const sourceSkill = path.join(__dirname, '..', '..', '..', 'skills', 'codegraph', 'SKILL.md');
      if (fs.existsSync(sourceSkill)) {
        const skillContent = fs.readFileSync(sourceSkill, 'utf-8');
        const destPath = skillPath();
        const existed = fs.existsSync(destPath);
        if (!existed || fs.readFileSync(destPath, 'utf-8') !== skillContent) {
          atomicWriteFileSync(destPath, skillContent);
          files.push({ path: destPath, action: existed ? 'updated' : 'created' });
        } else {
          files.push({ path: destPath, action: 'unchanged' });
        }
      }
    }

    // 3. Note about restart
    notes.push('Restart Hermes Agent for MCP tools to appear (mcp_codegraph_codegraph_*).');
    notes.push('Tools auto-discover on startup — no separate permission setup needed.');

    return { files, notes };
  }

  uninstall(loc: Location): WriteResult {
    const files: WriteResult['files'] = [];

    // 1. Remove MCP server config from config.yaml
    const yamlPath = configYamlPath(loc);
    const config = readYamlConfig(yamlPath);
    if (config.exists) {
      const result = removeCodeGraphConfig(config.text);
      if (result.removed) {
        atomicWriteFileSync(yamlPath, result.text);
        files.push({ path: yamlPath, action: 'removed' });
      } else {
        files.push({ path: yamlPath, action: 'not-found' });
      }
    } else {
      files.push({ path: yamlPath, action: 'not-found' });
    }

    // 2. Remove skill file (only if we installed it globally)
    if (loc === 'global') {
      const sp = skillPath();
      if (fs.existsSync(sp)) {
        try { fs.unlinkSync(sp); } catch { /* ignore */ }
        files.push({ path: sp, action: 'removed' });
        // Try to remove empty skill dir
        try { fs.rmdirSync(skillDir()); } catch { /* ignore */ }
      } else {
        files.push({ path: sp, action: 'not-found' });
      }
    }

    return { files };
  }

  printConfig(loc: Location): string {
    const target = configYamlPath(loc);
    return `# Add to ${target}\n\n${CODEGRAPH_MCP_BLOCK}\n\n# Then restart Hermes Agent.\n`;
  }

  describePaths(loc: Location): string[] {
    const paths = [configYamlPath(loc)];
    if (loc === 'global') {
      paths.push(skillPath());
    }
    return paths;
  }

  /**
   * Wire project-local skill for global installs.
   * Hermes Agent loads skills from ~/.hermes/skills/ globally,
   * so project-local surfaces aren't strictly needed. But we
   * offer init-helper behavior: if called from `codegraph init`,
   * ensure the global skill is present.
   */
  wireProjectSurfaces(): WriteResult {
    const files: WriteResult['files'] = [];
    const sp = skillPath();
    const sourceSkill = path.join(__dirname, '..', '..', '..', 'skills', 'codegraph', 'SKILL.md');
    
    if (fs.existsSync(sourceSkill)) {
      const skillDirPath = skillDir();
      if (!fs.existsSync(skillDirPath)) {
        fs.mkdirSync(skillDirPath, { recursive: true });
      }
      const skillContent = fs.readFileSync(sourceSkill, 'utf-8');
      const existed = fs.existsSync(sp);
      if (!existed || fs.readFileSync(sp, 'utf-8') !== skillContent) {
        atomicWriteFileSync(sp, skillContent);
        files.push({ path: sp, action: existed ? 'updated' : 'created' });
      }
    }
    return { files };
  }
}

export const hermesTarget: AgentTarget = new HermesAgentTarget();
