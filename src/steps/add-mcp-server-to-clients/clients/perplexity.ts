import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class PerplexityMCPClient extends MCPClient {
  name = 'Perplexity Desktop';
  docsUrl = 'https://docs.perplexity.ai/guides/mcp-server';
  note = 'Only supports local (stdio) mode, macOS only';

  async isClientSupported(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return false;
    }
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Perplexity', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    // Perplexity has a different config format
    return {
      args: ['run', '--no-cache', 'nia-mcp-server'],
      command: 'pipx',
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
