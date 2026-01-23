import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { getRemoteServerConfig } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class CursorMCPClient extends MCPClient {
  name = 'Cursor';
  docsUrl = 'https://cursor.com/docs/context/mcp';

  async isClientSupported(): Promise<boolean> {
    // Cursor is available on macOS, Windows, and Linux
    const platform = process.platform;
    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      return false;
    }

    // Check if Cursor config directory exists
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    // Check if parent .cursor directory exists (indicates Cursor is/was installed)
    return fs.existsSync(path.dirname(configDir)) || fs.existsSync(configDir);
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Cursor',
        'mcp.json',
      );
    }

    if (platform === 'linux') {
      return path.join(os.homedir(), '.config', 'cursor', 'mcp.json');
    }

    // macOS
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  /**
   * Cursor supports native HTTP transport, so we use URL-based config for remote
   */
  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return getRemoteServerConfig(apiKey);
    }
    // Local mode uses stdio
    return {
      type: 'stdio',
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: 'https://apigcp.trynia.ai/',
      },
    };
  }
}
