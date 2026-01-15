import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class VSCodeMCPClient extends MCPClient {
  name = 'VS Code';
  docsUrl = 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;
    // VS Code is available on all platforms
    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      return false;
    }

    // Check if VS Code config directory exists
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Code',
        'User',
        'mcp.json',
      );
    }

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Code',
        'User',
        'mcp.json',
      );
    }

    // Linux
    return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'servers';
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
      type: 'stdio',
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }
}
