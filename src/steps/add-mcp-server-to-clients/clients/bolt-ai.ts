import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class BoltAIMCPClient extends MCPClient {
  name = 'BoltAI';

  async isClientSupported(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return false;
    }
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), 'Library', 'Application Support', 'BoltAI', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    return {
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }

  supportsRemote(): boolean {
    return false;
  }
}
