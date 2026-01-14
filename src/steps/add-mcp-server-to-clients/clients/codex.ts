import { execSync, spawnSync } from 'child_process';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class CodexMCPClient extends MCPClient {
  name = 'Codex CLI';

  async isClientSupported(): Promise<boolean> {
    try {
      execSync('codex --version', { stdio: 'ignore' });
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
    try {
      const result = spawnSync('codex', ['mcp', 'list', '--json'], {
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

    debug(`Running: codex ${args.join(' ')}`);
    const result = spawnSync('codex', args, { stdio: 'ignore' });

    if (result.error || result.status !== 0) {
      return { success: false, error: 'Failed to add server to Codex CLI' };
    }

    return { success: true };
  }

  async removeServer(): Promise<MCPClientResult> {
    const result = spawnSync('codex', ['mcp', 'remove', SERVER_NAME], {
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
