import { execSync, spawnSync } from 'child_process';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class FactoryMCPClient extends MCPClient {
  name = 'Factory';
  docsUrl = 'https://docs.factory.ai/cli/configuration/mcp';
  usesCLI = true;
  note = 'Uses droid CLI for configuration';

  async isClientSupported(): Promise<boolean> {
    try {
      execSync('droid --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getConfigPath(): Promise<string> {
    throw new Error('Factory uses CLI configuration');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    try {
      const result = spawnSync('droid', ['mcp', 'list'], {
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
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    try {
      let args: string[];

      if (mode === 'remote') {
        args = [
          'mcp', 'add', SERVER_NAME,
          REMOTE_MCP_URL,
          '--type', 'http',
          '--header', `Authorization: Bearer ${apiKey}`,
        ];
      } else {
        args = [
          'mcp', 'add', SERVER_NAME,
          'pipx run --no-cache nia-mcp-server',
          '--env', `NIA_API_KEY=${apiKey}`,
          '--env', `NIA_API_URL=${NIA_API_URL}`,
        ];
      }

      debug(`Running: droid ${args.join(' ')}`);
      const result = spawnSync('droid', args, { stdio: 'pipe' });

      if (result.error || result.status !== 0) {
        return { success: false, error: 'Failed to add server to Factory' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    try {
      const result = spawnSync('droid', ['mcp', 'remove', SERVER_NAME], {
        stdio: 'pipe',
      });

      if (result.error || result.status !== 0) {
        return { success: false, error: 'Failed to remove server from Factory' };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
