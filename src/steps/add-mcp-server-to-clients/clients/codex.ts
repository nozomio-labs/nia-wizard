import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class CodexMCPClient extends MCPClient {
  name = 'Codex CLI';
  docsUrl = 'https://developers.openai.com/codex/mcp/';
  usesCLI = true;
  note = 'Only supports local mode, uses CLI configuration';
  private codexBinaryPath: string | null = null;

  private findCodexBinary(): string | null {
    if (this.codexBinaryPath) return this.codexBinaryPath;

    const possiblePaths = [
      path.join(os.homedir(), '.bun', 'bin', 'codex'),
      path.join(os.homedir(), '.npm', 'bin', 'codex'),
      path.join(os.homedir(), '.yarn', 'bin', 'codex'),
      '/usr/local/bin/codex',
      '/opt/homebrew/bin/codex',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.codexBinaryPath = p;
        return p;
      }
    }

    try {
      execSync('command -v codex', { stdio: 'pipe' });
      this.codexBinaryPath = 'codex';
      return 'codex';
    } catch {
      return null;
    }
  }

  async isClientSupported(): Promise<boolean> {
    const binary = this.findCodexBinary();
    if (!binary) return false;
    try {
      execSync(`${binary} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getConfigPath(): Promise<string> {
    throw new Error('Codex CLI uses command-line configuration');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    const binary = this.findCodexBinary();
    if (!binary) return false;
    try {
      const result = spawnSync(binary, ['mcp', 'list', '--json'], {
        encoding: 'utf-8',
      });

      if (result.error || result.status !== 0) {
        return false;
      }

      const stdout = result.stdout?.trim();
      if (!stdout) return false;

      const servers = JSON.parse(stdout) as Array<{ name: string }>;
      return servers.some((server) => server.name === SERVER_NAME);
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    _mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    const binary = this.findCodexBinary();
    if (!binary) return { success: false, error: 'Codex CLI not found' };

    // Codex only supports local mode
    const args = [
      'mcp',
      'add',
      SERVER_NAME,
      '--env',
      `NIA_API_KEY=${apiKey}`,
      '--env',
      `NIA_API_URL=${NIA_API_URL}`,
      '--',
      'pipx',
      'run',
      '--no-cache',
      'nia-mcp-server',
    ];

    debug(`Running: ${binary} ${args.join(' ')}`);
    const result = spawnSync(binary, args, { stdio: 'ignore' });

    if (result.error || result.status !== 0) {
      return { success: false, error: 'Failed to add server to Codex CLI' };
    }

    return { success: true };
  }

  async removeServer(): Promise<MCPClientResult> {
    const binary = this.findCodexBinary();
    if (!binary) return { success: false, error: 'Codex CLI not found' };

    const result = spawnSync(binary, ['mcp', 'remove', SERVER_NAME], {
      stdio: 'ignore',
    });

    if (result.error || result.status !== 0) {
      return { success: false, error: 'Failed to remove server from Codex CLI' };
    }

    return { success: true };
  }

  supportsRemote(): boolean {
    return false;
  }
}
