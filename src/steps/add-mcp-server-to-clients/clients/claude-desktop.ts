import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class ClaudeDesktopMCPClient extends MCPClient {
  name = 'Claude Desktop';
  docsUrl = 'https://modelcontextprotocol.io/quickstart/user';
  note = 'Only supports local (stdio) mode';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;
    if (platform !== 'darwin' && platform !== 'win32') {
      return false;
    }

    // Check if Claude Desktop config directory exists
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    return fs.existsSync(configDir);
  }

  async getConfigPath(): Promise<string> {
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json',
      );
    }

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Claude',
        'claude_desktop_config.json',
      );
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  /**
   * Claude Desktop only supports stdio (local) mode
   */
  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    // Claude Desktop doesn't support remote HTTP, always use local
    return {
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: 'https://apigcp.trynia.ai/',
      },
    };
  }

  /**
   * Claude Desktop only supports local mode
   */
  supportsRemote(): boolean {
    return false;
  }
}
