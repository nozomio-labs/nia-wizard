import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class OpencodeMCPClient extends MCPClient {
  name = 'Opencode';
  docsUrl = 'https://opencode.ai/docs/mcp-servers/';
  note = 'Also available as dedicated plugin: bunx nia-opencode@latest install (Demo: https://x.com/arlanr/status/1879212916125777962)';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), '.opencode', 'config.json');
  }

  getServerPropertyName(): string {
    return 'mcp';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        type: 'remote',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        enabled: true,
      };
    }
    return {
      type: 'local',
      command: ['pipx', 'run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
      enabled: true,
    };
  }
}
