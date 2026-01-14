import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class KiloCodeMCPClient extends MCPClient {
  name = 'Kilo Code';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), '.kilocode', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        type: 'streamable-http',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        alwaysAllow: [],
        disabled: false,
      };
    }
    return {
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
      alwaysAllow: [],
      disabled: false,
    };
  }
}
