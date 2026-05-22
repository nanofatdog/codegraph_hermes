/**
 * Hermes Agent target.
 *
 * Hermes reads MCP servers from `$HERMES_HOME/config.yaml` under the
 * top-level `mcp_servers` key, and exposes discovered MCP tools through
 * dynamic toolsets named `mcp-<server>`. We add:
 *
 *   mcp_servers.codegraph -> `codegraph serve --mcp`
 *   platform_toolsets.cli -> `mcp-codegraph`
 *
 * The second entry matters because Hermes CLI profiles often enable an
 * explicit `platform_toolsets.cli` list. Without `mcp-codegraph` in that
 * list, the MCP server can be configured and connected but its tools may
 * still be filtered out of normal CLI sessions.
 *
 * Also installs the CodeGraph skill to ~/.hermes/skills/codegraph/SKILL.md
 * for auto-loading in Hermes sessions (created by UKA).
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

type LineRange = { start: number; end: number };

class HermesTarget implements AgentTarget {
  readonly id = 'hermes' as const;
  readonly displayName = 'Hermes Agent';
  readonly docsUrl = 'https://hermes-agent.nousresearch.com';

  supportsLocation(loc: Location): boolean {
    return loc === 'global';
  }

  detect(loc: Location): DetectionResult {
    if (loc !== 'global') {
      return { installed: false, alreadyConfigured: false };
    }
    const file = configPath();
    const content = readText(file);
    const installed = fs.existsSync(hermesHome()) || fs.existsSync(file);
    return {
      installed,
      alreadyConfigured: hasCodeGraphMcpServer(content),
      configPath: file,
    };
  }

  install(loc: Location, _opts: InstallOptions): WriteResult {
    if (loc !== 'global') {
      return {
        files: [],
        notes: ['Hermes Agent uses $HERMES_HOME/config.yaml; re-run with --location=global.'],
      };
    }
    const files: WriteResult['files'] = [];
    
    // 1. Write MCP + toolset config
    files.push(writeHermesConfig());
    
    // 2. Install skill file
    const skillResult = installSkill();
    if (skillResult) files.push(skillResult);

    return {
      files,
      notes: [
        'Restart Hermes Agent for MCP tools to appear (mcp_codegraph_codegraph_*).',
        'Skill auto-loads if "codegraph" is in auto_skills list.',
      ],
    };
  }

  uninstall(loc: Location): WriteResult {
    if (loc !== 'global') return { files: [] };
    const files: WriteResult['files'] = [];
    
    // 1. Remove MCP config
    const file = configPath();
    if (fs.existsSync(file)) {
      const before = readText(file);
      const after = removeCodeGraphToolset(removeCodeGraphMcpServer(before));
      if (after !== before) {
        atomicWriteFileSync(file, ensureTrailingNewline(after));
        files.push({ path: file, action: 'removed' });
      } else {
        files.push({ path: file, action: 'not-found' });
      }
    } else {
      files.push({ path: file, action: 'not-found' });
    }

    // 2. Remove skill
    const sp = skillPath();
    if (fs.existsSync(sp)) {
      try { fs.unlinkSync(sp); } catch { /* ignore */ }
      files.push({ path: sp, action: 'removed' });
      try { fs.rmdirSync(path.dirname(sp)); } catch { /* ignore */ }
    }

    return { files };
  }

  printConfig(loc: Location): string {
    if (loc !== 'global') {
      return '# Hermes Agent uses $HERMES_HOME/config.yaml; use --location=global.\n';
    }
    return [
      `# Add to ${configPath()}`,
      '',
      renderCodeGraphMcpBlock().join('\n'),
      '',
      'platform_toolsets:',
      '  cli:',
      '    - hermes-cli',
      '    - mcp-codegraph',
      '',
      '# Then restart Hermes Agent.',
    ].join('\n');
  }

  describePaths(loc: Location): string[] {
    return loc === 'global' ? [configPath(), skillPath()] : [];
  }

  /**
   * Wire project-local surfaces. Hermes loads skills from
   * ~/.hermes/skills/ globally, so we ensure the skill is present.
   */
  wireProjectSurfaces(): WriteResult {
    const files: WriteResult['files'] = [];
    const result = installSkill();
    if (result) files.push(result);
    return { files };
  }
}

// ─── Paths ────────────────────────────────────────────────────────

function hermesHome(): string {
  return process.env.HERMES_HOME
    ? path.resolve(process.env.HERMES_HOME)
    : path.join(os.homedir(), '.hermes');
}

function configPath(): string {
  return path.join(hermesHome(), 'config.yaml');
}

function skillDir(): string {
  return path.join(hermesHome(), 'skills', 'codegraph');
}

function skillPath(): string {
  return path.join(skillDir(), 'SKILL.md');
}

// ─── File I/O ─────────────────────────────────────────────────────

function readText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : text + '\n';
}

// ─── Skill installation ───────────────────────────────────────────

function installSkill(): WriteResult['files'][number] | null {
  const sourceSkill = path.join(__dirname, '..', '..', '..', 'skills', 'codegraph', 'SKILL.md');
  if (!fs.existsSync(sourceSkill)) return null;

  const destPath = skillPath();
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const skillContent = fs.readFileSync(sourceSkill, 'utf-8');
  const existed = fs.existsSync(destPath);
  if (existed && fs.readFileSync(destPath, 'utf-8') === skillContent) {
    return { path: destPath, action: 'unchanged' };
  }
  atomicWriteFileSync(destPath, skillContent);
  return { path: destPath, action: existed ? 'updated' : 'created' };
}

// ─── YAML config manipulation ─────────────────────────────────────

function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function joinLines(lines: string[]): string {
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

function topLevelRange(lines: string[], key: string): LineRange | null {
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*(?:#.*)?$/.test(line)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function childRange(lines: string[], parent: LineRange, child: string): LineRange | null {
  const startPattern = new RegExp(`^  ${escapeRegExp(child)}:\\s*(?:#.*)?$`);
  let start = -1;
  for (let i = parent.start + 1; i < parent.end; i++) {
    if (startPattern.test(lines[i] ?? '')) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = parent.end;
  for (let i = start + 1; i < parent.end; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    if (/^  \S/.test(line)) {
      end = i;
      break;
    }
  }
  while (end > start + 1 && (lines[end - 1] ?? '').trim() === '') {
    end--;
  }
  return { start, end };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── MCP server block ─────────────────────────────────────────────

function renderCodeGraphMcpChild(): string[] {
  return [
    '  codegraph:',
    '    command: codegraph',
    '    args:',
    '      - serve',
    '      - --mcp',
    '    timeout: 120',
    '    connect_timeout: 60',
    '    enabled: true',
  ];
}

function renderCodeGraphMcpBlock(): string[] {
  return ['mcp_servers:', ...renderCodeGraphMcpChild()];
}

function hasCodeGraphMcpServer(content: string): boolean {
  const lines = splitLines(content);
  const parent = topLevelRange(lines, 'mcp_servers');
  return !!parent && !!childRange(lines, parent, 'codegraph');
}

function upsertCodeGraphMcpServer(content: string): string {
  const lines = splitLines(content);
  const parent = topLevelRange(lines, 'mcp_servers');
  const child = parent ? childRange(lines, parent, 'codegraph') : null;
  const replacement = renderCodeGraphMcpChild();

  if (!parent) {
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length > 0) lines.push('');
    lines.push(...renderCodeGraphMcpBlock());
    return joinLines(lines);
  }

  if (child) {
    const existing = lines.slice(child.start, child.end);
    if (arrayEqual(existing, replacement)) return joinLines(lines);
    lines.splice(child.start, child.end - child.start, ...replacement);
    return joinLines(lines);
  }

  lines.splice(parent.end, 0, ...replacement);
  return joinLines(lines);
}

function removeCodeGraphMcpServer(content: string): string {
  const lines = splitLines(content);
  const parent = topLevelRange(lines, 'mcp_servers');
  const child = parent ? childRange(lines, parent, 'codegraph') : null;
  if (!child) return content;
  lines.splice(child.start, child.end - child.start);
  return joinLines(lines);
}

// ─── Platform toolsets ────────────────────────────────────────────

function upsertCodeGraphToolset(content: string): string {
  const lines = splitLines(content);
  const parent = topLevelRange(lines, 'platform_toolsets');
  const cli = parent ? childRange(lines, parent, 'cli') : null;

  if (!parent) {
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length > 0) lines.push('');
    lines.push('platform_toolsets:', '  cli:', '    - hermes-cli', '    - mcp-codegraph');
    return joinLines(lines);
  }

  if (!cli) {
    lines.splice(parent.end, 0, '  cli:', '    - hermes-cli', '    - mcp-codegraph');
    return joinLines(lines);
  }

  const hasEntry = lines
    .slice(cli.start + 1, cli.end)
    .some((line) => line.trim() === '- mcp-codegraph');
  if (hasEntry) return joinLines(lines);

  lines.splice(cli.end, 0, '    - mcp-codegraph');
  return joinLines(lines);
}

function removeCodeGraphToolset(content: string): string {
  const lines = splitLines(content);
  const parent = topLevelRange(lines, 'platform_toolsets');
  const cli = parent ? childRange(lines, parent, 'cli') : null;
  if (!cli) return content;

  const hasEntry = lines
    .slice(cli.start + 1, cli.end)
    .some((line) => line.trim() === '- mcp-codegraph');
  if (!hasEntry) return content;

  const next = lines.filter((line, idx) => {
    if (idx <= cli.start || idx >= cli.end) return true;
    return line.trim() !== '- mcp-codegraph';
  });
  return joinLines(next);
}

// ─── Config write ─────────────────────────────────────────────────

function writeHermesConfig(): WriteResult['files'][number] {
  const file = configPath();
  const existed = fs.existsSync(file);
  const before = readText(file);
  const afterMcp = upsertCodeGraphMcpServer(before);
  const after = upsertCodeGraphToolset(afterMcp);

  if (after === before) {
    return { path: file, action: 'unchanged' };
  }
  atomicWriteFileSync(file, ensureTrailingNewline(after));
  return { path: file, action: existed ? 'updated' : 'created' };
}

// ─── Helpers ──────────────────────────────────────────────────────

function arrayEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, idx) => value === b[idx]);
}

export const hermesTarget: AgentTarget = new HermesTarget();
