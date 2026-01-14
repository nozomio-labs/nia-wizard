import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig } from '../../../utils/types.js';

export class AugmentMCPClient extends MCPClient {
  name = 'Augment Code';

  async isClientSupported(): Promise<boolean> {
    // Augment is a VS Code extension, harder to detect
    return false; // User needs to configure manually
  }

  async getConfigPath(): Promise<string> {
    // Augment uses VS Code settings
    return path.join(os.homedir(), '.vscode', 'settings.json');
  }

  getServerPropertyName(): string {
    return 'augment.advanced';
  }

  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    // Augment only supports local
    return {
      mcpServers: [
        {
          name: 'nia',
          command: 'pipx',
          args: ['run', '--no-cache', 'nia-mcp-server'],
          env: {
            NIA_API_KEY: apiKey,
            NIA_API_URL: NIA_API_URL,
          },
        },
      ],
    };
  }

  supportsRemote(): boolean {
    return false;
  }
}
