import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class ContinueMCPClient extends MCPClient {
  name = 'Continue.dev';
  docsUrl = 'https://docs.continue.dev/customize/mcp-tools';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir);
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(process.env.USERPROFILE || '', '.continue', 'config.json');
    }
    return path.join(os.homedir(), '.continue', 'config.json');
  }

  getServerPropertyName(): string {
    return 'experimental';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        modelContextProtocolServer: {
          transport: {
            type: 'http',
            url: REMOTE_MCP_URL,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      };
    }
    return {
      modelContextProtocolServer: {
        transport: {
          type: 'stdio',
          command: 'pipx',
          args: ['run', '--no-cache', 'nia-mcp-server'],
          env: {
            NIA_API_KEY: apiKey,
            NIA_API_URL: NIA_API_URL,
          },
        },
      },
    };
  }
}
