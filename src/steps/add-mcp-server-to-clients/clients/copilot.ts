import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

const COPILOT_TOOLS = ['index', 'search', 'manage_resource', 'nia_web_search', 'nia_deep_research_agent'];

export class CopilotCLIMCPClient extends MCPClient {
  name = 'Copilot CLI';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    if (process.platform === 'win32') {
      return path.join(process.env.USERPROFILE || '', '.copilot', 'mcp-config.json');
    }
    return path.join(os.homedir(), '.copilot', 'mcp-config.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        type: 'http',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        tools: COPILOT_TOOLS,
      };
    }
    return {
      type: 'local',
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
      tools: COPILOT_TOOLS,
    };
  }
}

export class CopilotAgentMCPClient extends MCPClient {
  name = 'Copilot Coding Agent';

  async isClientSupported(): Promise<boolean> {
    // Check if .github directory exists (repo-level config)
    return fs.existsSync('.github');
  }

  async getConfigPath(): Promise<string> {
    return path.join('.github', 'copilot-mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        type: 'http',
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        tools: COPILOT_TOOLS,
      };
    }
    return {
      type: 'stdio',
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
      tools: COPILOT_TOOLS,
    };
  }
}
