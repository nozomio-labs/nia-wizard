import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class ZedMCPClient extends MCPClient {
  name = 'Zed';
  docsUrl = 'https://zed.dev/docs/ai/mcp';
  note = 'Only supports local (stdio) mode';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;
    // Zed is available on macOS and Linux
    if (platform !== 'darwin' && platform !== 'linux') {
      return false;
    }

    // Check if Zed config directory exists
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    return fs.existsSync(configDir);
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(os.homedir(), '.config', 'zed', 'settings.json');
    }

    // Linux
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      return path.join(xdgConfigHome, 'zed', 'settings.json');
    }
    return path.join(os.homedir(), '.config', 'zed', 'settings.json');
  }

  getServerPropertyName(): string {
    return 'context_servers';
  }

  /**
   * Zed only supports local stdio mode
   */
  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    return {
      source: 'custom',
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
