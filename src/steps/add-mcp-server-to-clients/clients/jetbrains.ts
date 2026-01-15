import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class JetBrainsMCPClient extends MCPClient {
  name = 'JetBrains';
  docsUrl = 'https://www.jetbrains.com/help/idea/mcp-server.html';
  note = 'Only supports local (stdio) mode';

  async isClientSupported(): Promise<boolean> {
    // Check for common JetBrains config directories
    const homeDir = os.homedir();
    const possibleDirs = [
      path.join(homeDir, '.config', 'JetBrains'),
      path.join(homeDir, 'Library', 'Application Support', 'JetBrains'),
    ];
    return possibleDirs.some(dir => fs.existsSync(dir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), '.jetbrains', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    // JetBrains only supports local
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
