import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class WindsurfMCPClient extends MCPClient {
  name = 'Windsurf';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;
    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      return false;
    }

    // Check if Windsurf config directory exists
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
    }

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Codeium',
        'windsurf',
        'mcp_config.json',
      );
    }

    // Linux
    return path.join(os.homedir(), '.config', 'windsurf', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        serverUrl: REMOTE_MCP_URL,
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
}
