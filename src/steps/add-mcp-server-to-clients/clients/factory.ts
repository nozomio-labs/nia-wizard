import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult, MCPServerConfig } from '../../../utils/types.js';
import { debug } from '../../../utils/debug.js';

export class FactoryMCPClient extends MCPClient {
  name = 'Factory';
  docsUrl = 'https://docs.factory.ai/cli/configuration/mcp';
  note = 'Supports droid CLI or config file (~/.factory/mcp.json)';
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

  private getConfigFilePath(): string {
    return path.join(os.homedir(), '.factory', 'mcp.json');
  }

  async isClientSupported(): Promise<boolean> {
    // Supported if droid CLI exists OR config directory exists
    const binary = this.findDroidBinary();
    if (binary) {
      try {
        execSync(`${binary} --version`, { stdio: 'ignore' });
        return true;
      } catch {
        // Continue to check config file
      }
    }

    // Check if ~/.factory directory exists (Factory is installed)
    const factoryDir = path.join(os.homedir(), '.factory');
    return fs.existsSync(factoryDir);
  }

  async getConfigPath(): Promise<string> {
    return this.getConfigFilePath();
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        type: 'http',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      };
    }
    return {
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }

  async isServerInstalled(): Promise<boolean> {
    // Try CLI first
    const binary = this.findDroidBinary();
    if (binary) {
      try {
        const result = spawnSync(binary, ['mcp', 'list'], {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        if (result.stdout?.includes(SERVER_NAME)) {
          return true;
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
      const config = JSON.parse(content);
      return !!config?.mcpServers?.[SERVER_NAME];
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    // Try CLI first if available
    const binary = this.findDroidBinary();
    if (binary) {
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

        if (!result.error && result.status === 0) {
          return { success: true };
        }
        // Fall through to config file method
      } catch {
        // Fall through to config file method
      }
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

      // Read existing config or create new
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(content);
      }

      // Add server
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
      (config.mcpServers as Record<string, unknown>)[SERVER_NAME] =
        this.getServerConfig(apiKey, mode);

      // Write back
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    // Try CLI first if available
    const binary = this.findDroidBinary();
    if (binary) {
      try {
        const result = spawnSync(binary, ['mcp', 'remove', SERVER_NAME], {
          stdio: 'pipe',
        });

        if (!result.error && result.status === 0) {
          return { success: true };
        }
        // Fall through to config file method
      } catch {
        // Fall through to config file method
      }
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
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers?.[SERVER_NAME]) {
        delete config.mcpServers[SERVER_NAME];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
