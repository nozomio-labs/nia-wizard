import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class TraeMCPClient extends MCPClient {
  name = 'Trae';
  docsUrl = 'https://docs.trae.ai/ide/model-context-protocol';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Trae', 'User', 'mcp.json');
    }

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Trae',
        'User',
        'mcp.json',
      );
    }

    // Linux
    return path.join(os.homedir(), '.config', 'trae', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
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
}
