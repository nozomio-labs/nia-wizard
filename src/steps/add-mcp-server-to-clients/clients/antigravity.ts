import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class AntigravityMCPClient extends MCPClient {
  name = 'Google Antigravity';
  docsUrl = 'https://developers.google.com/gemini-code-assist/docs/use-mcp-servers';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Gemini',
        'Antigravity',
        'mcp_config.json',
      );
    }

    if (platform === 'linux') {
      return path.join(os.homedir(), '.config', 'gemini', 'antigravity', 'mcp_config.json');
    }

    // macOS
    return path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
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
