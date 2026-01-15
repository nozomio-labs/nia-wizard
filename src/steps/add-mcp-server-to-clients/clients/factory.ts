import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class FactoryMCPClient extends MCPClient {
  name = 'Factory';
  docsUrl = 'https://docs.factory.ai/cli/configuration/mcp';
  usesCLI = true;
  note = 'Uses droid CLI for configuration';
  private droidBinaryPath: string | null = null;

  private findDroidBinary(): string | null {
    if (this.droidBinaryPath) return this.droidBinaryPath;

    const possiblePaths = [
      path.join(os.homedir(), '.bun', 'bin', 'droid'),
      path.join(os.homedir(), '.npm', 'bin', 'droid'),
      path.join(os.homedir(), '.yarn', 'bin', 'droid'),
      '/usr/local/bin/droid',
      '/opt/homebrew/bin/droid',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.droidBinaryPath = p;
        return p;
      }
    }

    try {
      execSync('command -v droid', { stdio: 'pipe' });
      this.droidBinaryPath = 'droid';
      return 'droid';
    } catch {
      return null;
    }
  }

  async isClientSupported(): Promise<boolean> {
    const binary = this.findDroidBinary();
    if (!binary) return false;
    try {
      execSync(`${binary} --version`, { stdio: 'ignore' });
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
    const binary = this.findDroidBinary();
    if (!binary) return false;
    try {
      const result = spawnSync(binary, ['mcp', 'list'], {
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
    const binary = this.findDroidBinary();
    if (!binary) return { success: false, error: 'Factory (droid) not found' };

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

      debug(`Running: ${binary} ${args.join(' ')}`);
      const result = spawnSync(binary, args, { stdio: 'pipe' });

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
    const binary = this.findDroidBinary();
    if (!binary) return { success: false, error: 'Factory (droid) not found' };

    try {
      const result = spawnSync(binary, ['mcp', 'remove', SERVER_NAME], {
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
