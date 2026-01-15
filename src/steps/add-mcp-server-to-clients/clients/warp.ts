import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class WarpMCPClient extends MCPClient {
  name = 'Warp';
  docsUrl = 'https://docs.warp.dev/knowledge-and-collaboration/mcp';
  note = 'Configure via Settings > MCP Servers in Warp';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;

    if (platform === 'darwin') {
      // Check for Warp app support directory
      const warpDir = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'dev.warp.Warp-Stable',
      );
      return fs.existsSync(warpDir);
    }

    if (platform === 'win32') {
      const warpDir = path.join(process.env.LOCALAPPDATA || '', 'warp', 'Warp');
      return fs.existsSync(warpDir);
    }

    if (platform === 'linux') {
      const xdgState = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
      const warpDir = path.join(xdgState, 'warp-terminal');
      return fs.existsSync(warpDir);
    }

    return false;
  }

  async getConfigPath(): Promise<string> {
    // Warp uses UI-based config, return app support path for reference
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'dev.warp.Warp-Stable',
        'mcp_servers.json',
      );
    }

    if (platform === 'win32') {
      return path.join(process.env.LOCALAPPDATA || '', 'warp', 'Warp', 'mcp_servers.json');
    }

    // Linux
    const xdgState = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    return path.join(xdgState, 'warp-terminal', 'mcp_servers.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    if (mode === 'remote') {
      return {
        url: REMOTE_MCP_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      };
    }
    return {
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }
}
