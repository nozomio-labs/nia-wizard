import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class AmpMCPClient extends MCPClient {
  name = 'Amp';
  docsUrl = 'https://ampcode.com/docs/customize/mcp';
  usesCLI = true;
  note = 'Only supports remote mode, uses CLI configuration';
  private ampBinaryPath: string | null = null;

  private findAmpBinary(): string | null {
    if (this.ampBinaryPath) return this.ampBinaryPath;

    const possiblePaths = [
      path.join(os.homedir(), '.bun', 'bin', 'amp'),
      path.join(os.homedir(), '.npm', 'bin', 'amp'),
      path.join(os.homedir(), '.yarn', 'bin', 'amp'),
      '/usr/local/bin/amp',
      '/opt/homebrew/bin/amp',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.ampBinaryPath = p;
        return p;
      }
    }

    try {
      execSync('command -v amp', { stdio: 'pipe' });
      this.ampBinaryPath = 'amp';
      return 'amp';
    } catch {
      return null;
    }
  }

  async isClientSupported(): Promise<boolean> {
    const binary = this.findAmpBinary();
    if (!binary) return false;
    try {
      execSync(`${binary} --version`, { stdio: 'ignore' });
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
    const binary = this.findAmpBinary();
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
    _mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    const binary = this.findAmpBinary();
    if (!binary) return { success: false, error: 'Amp not found' };

    // Amp only supports remote
    try {
      const args = [
        'mcp', 'add', SERVER_NAME,
        '--header', `Authorization=Bearer ${apiKey}`,
        REMOTE_MCP_URL,
      ];

      debug(`Running: ${binary} ${args.join(' ')}`);
      const result = spawnSync(binary, args, { stdio: 'pipe' });

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
    const binary = this.findAmpBinary();
    if (!binary) return { success: false, error: 'Amp not found' };

    try {
      const result = spawnSync(binary, ['mcp', 'remove', SERVER_NAME], {
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
