import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class ClaudeCodeMCPClient extends MCPClient {
  name = 'Claude Code';
  docsUrl = 'https://docs.anthropic.com/en/docs/claude-code/mcp-servers';
  usesCLI = true;
  private claudeBinaryPath: string | null = null;

  async isClientSupported(): Promise<boolean> {
    try {
      const binary = this.findClaudeBinary();
      if (!binary) {
        debug('Claude Code CLI not found');
        return false;
      }

      execSync(`${binary} --version`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private findClaudeBinary(): string | null {
    if (this.claudeBinaryPath) {
      return this.claudeBinaryPath;
    }

    const possiblePaths = [
      path.join(os.homedir(), '.claude', 'local', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const claudePath of possiblePaths) {
      if (fs.existsSync(claudePath)) {
        debug(`Found claude binary at: ${claudePath}`);
        this.claudeBinaryPath = claudePath;
        return claudePath;
      }
    }

    // Try PATH as fallback
    try {
      execSync('command -v claude', { stdio: 'pipe' });
      this.claudeBinaryPath = 'claude';
      return 'claude';
    } catch {
      return null;
    }
  }

  async getConfigPath(): Promise<string> {
    // Claude Code uses CLI, not a config file
    throw new Error('Claude Code uses CLI for configuration');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    try {
      const binary = this.findClaudeBinary();
      if (!binary) return false;

      const output = execSync(`${binary} mcp list`, { stdio: 'pipe' });
      return output.toString().includes(SERVER_NAME);
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    const binary = this.findClaudeBinary();
    if (!binary) {
      return { success: false, error: 'Claude Code CLI not found' };
    }

    try {
      let command: string;

      if (mode === 'remote') {
        // Remote HTTP mode
        command = `${binary} mcp add --transport http ${SERVER_NAME} ${REMOTE_MCP_URL} --header "Authorization: Bearer ${apiKey}" -s user`;
      } else {
        // Local stdio mode
        command = `${binary} mcp add ${SERVER_NAME} -e "NIA_API_KEY=${apiKey}" -e "NIA_API_URL=${NIA_API_URL}" -s user -- pipx run --no-cache nia-mcp-server`;
      }

      debug(`Running: ${command}`);
      execSync(command, { stdio: 'pipe' });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    const binary = this.findClaudeBinary();
    if (!binary) {
      return { success: false, error: 'Claude Code CLI not found' };
    }

    try {
      const command = `${binary} mcp remove --scope user ${SERVER_NAME}`;
      debug(`Running: ${command}`);
      execSync(command, { stdio: 'pipe' });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
