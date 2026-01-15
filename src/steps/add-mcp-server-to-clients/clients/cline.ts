import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class ClineMCPClient extends MCPClient {
  name = 'Cline';
  docsUrl = 'https://docs.cline.bot/mcp/configuring-mcp-servers';

  async isClientSupported(): Promise<boolean> {
    // Cline is a VS Code extension, check for its config directory
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    return path.join(os.homedir(), '.cline', 'mcp_settings.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    const baseConfig = {
      alwaysAllow: [
        'index',
        'search',
        'manage_resource',
        'nia_web_search',
        'nia_deep_research_agent',
      ],
      disabled: false,
    };

    if (mode === 'remote') {
      return {
        ...baseConfig,
        type: 'streamableHttp',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      };
    }

    return {
      ...baseConfig,
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }
}
