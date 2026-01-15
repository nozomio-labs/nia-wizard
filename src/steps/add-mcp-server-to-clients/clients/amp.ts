import { execSync, spawnSync } from 'child_process';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class AmpMCPClient extends MCPClient {
  name = 'Amp';
  docsUrl = 'https://ampcode.com/docs/customize/mcp';
  usesCLI = true;
  note = 'Only supports remote mode, uses CLI configuration';

  async isClientSupported(): Promise<boolean> {
    try {
      execSync('amp --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getConfigPath(): Promise<string> {
    throw new Error('Amp uses CLI configuration');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    try {
      const result = spawnSync('amp', ['mcp', 'list'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return result.stdout?.includes(SERVER_NAME) || false;
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    _mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    // Amp only supports remote
    try {
      const args = [
        'mcp', 'add', SERVER_NAME,
        '--header', `Authorization=Bearer ${apiKey}`,
        REMOTE_MCP_URL,
      ];

      debug(`Running: amp ${args.join(' ')}`);
      const result = spawnSync('amp', args, { stdio: 'pipe' });

      if (result.error || result.status !== 0) {
        return { success: false, error: 'Failed to add server to Amp' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    try {
      const result = spawnSync('amp', ['mcp', 'remove', SERVER_NAME], {
        stdio: 'pipe',
      });

      if (result.error || result.status !== 0) {
        return { success: false, error: 'Failed to remove server from Amp' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  supportsLocal(): boolean {
    return false;
  }
}
