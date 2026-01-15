import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class CodexMCPClient extends MCPClient {
  name = 'Codex CLI';
  docsUrl = 'https://developers.openai.com/codex/mcp/';
  note = 'Uses CLI or config file (~/.codex/config.toml)';
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

  private getConfigFilePath(): string {
    if (process.platform === 'win32') {
      return path.join(process.env.USERPROFILE || '', '.codex', 'config.toml');
    }
    return path.join(os.homedir(), '.codex', 'config.toml');
  }

  async isClientSupported(): Promise<boolean> {
    // Check for CLI first
    const binary = this.findCodexBinary();
    if (binary) {
      try {
        execSync(`${binary} --version`, { stdio: 'ignore' });
        return true;
      } catch {
        // Continue to check config
      }
    }

    // Check if ~/.codex directory exists
    const codexDir = path.dirname(this.getConfigFilePath());
    return fs.existsSync(codexDir);
  }

  async getConfigPath(): Promise<string> {
    return this.getConfigFilePath();
  }

  getServerPropertyName(): string {
    return 'mcp_servers';
  }

  async isServerInstalled(): Promise<boolean> {
    // Try CLI first
    const binary = this.findCodexBinary();
    if (binary) {
      try {
        const result = spawnSync(binary, ['mcp', 'list', '--json'], {
          encoding: 'utf-8',
        });

        if (!result.error && result.status === 0 && result.stdout?.trim()) {
          const servers = JSON.parse(result.stdout.trim()) as Array<{ name: string }>;
          if (servers.some((server) => server.name === SERVER_NAME)) {
            return true;
          }
        }
      } catch {
        // Fall through to config file check
      }
    }

    // Check config file
    const configPath = this.getConfigFilePath();
    if (!fs.existsSync(configPath)) return false;

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return content.includes(`[mcp_servers.${SERVER_NAME}]`);
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    // Try CLI first for local mode
    const binary = this.findCodexBinary();
    if (binary && mode === 'local') {
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

      if (!result.error && result.status === 0) {
        return { success: true };
      }
      // Fall through to config file method
    }

    // Fall back to config file editing
    return this.addServerViaConfigFile(apiKey, mode);
  }

  private async addServerViaConfigFile(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    const configPath = this.getConfigFilePath();
    const configDir = path.dirname(configPath);

    try {
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Read existing config
      let content = '';
      if (fs.existsSync(configPath)) {
        content = fs.readFileSync(configPath, 'utf-8');
      }

      // Remove existing server config if present
      const serverRegex = new RegExp(`\\[mcp_servers\\.${SERVER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`, 'g');
      content = content.replace(serverRegex, '').trim();

      // Add new server config
      let serverConfig: string;
      if (mode === 'remote') {
        serverConfig = `
[mcp_servers.${SERVER_NAME}]
url = "${REMOTE_MCP_URL}"
http_headers = { "Authorization" = "Bearer ${apiKey}" }
`;
      } else {
        serverConfig = `
[mcp_servers.${SERVER_NAME}]
command = "pipx"
args = ["run", "--no-cache", "nia-mcp-server"]

[mcp_servers.${SERVER_NAME}.env]
NIA_API_KEY = "${apiKey}"
NIA_API_URL = "${NIA_API_URL}"
`;
      }

      content = content + '\n' + serverConfig.trim() + '\n';

      fs.writeFileSync(configPath, content.trim() + '\n');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    // Try CLI first
    const binary = this.findCodexBinary();
    if (binary) {
      const result = spawnSync(binary, ['mcp', 'remove', SERVER_NAME], {
        stdio: 'ignore',
      });

      if (!result.error && result.status === 0) {
        return { success: true };
      }
      // Fall through to config file method
    }

    // Fall back to config file editing
    return this.removeServerViaConfigFile();
  }

  private async removeServerViaConfigFile(): Promise<MCPClientResult> {
    const configPath = this.getConfigFilePath();

    if (!fs.existsSync(configPath)) {
      return { success: true }; // Nothing to remove
    }

    try {
      let content = fs.readFileSync(configPath, 'utf-8');

      // Remove server config section
      const serverRegex = new RegExp(`\\[mcp_servers\\.${SERVER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`, 'g');
      content = content.replace(serverRegex, '').trim();

      // Also remove env section if exists
      const envRegex = new RegExp(`\\[mcp_servers\\.${SERVER_NAME}\\.env\\][\\s\\S]*?(?=\\n\\[|$)`, 'g');
      content = content.replace(envRegex, '').trim();

      fs.writeFileSync(configPath, content + '\n');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
