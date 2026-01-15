import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { NIA_API_URL } from '../defaults.js';
import type { MCPServerConfig, MCPClientResult } from '../../../utils/types.js';

export class AugmentMCPClient extends MCPClient {
  name = 'Augment Code';
  docsUrl = 'https://docs.augmentcode.com/setup-augment/mcp';
  note = 'Configure via Settings Panel in VS Code (augment.advanced.mcpServers)';

  async isClientSupported(): Promise<boolean> {
    // Check for Augment extension storage
    const platform = process.platform;
    let extensionDir: string;

    if (platform === 'darwin') {
      extensionDir = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'augment.augment-vscode',
      );
    } else if (platform === 'win32') {
      extensionDir = path.join(
        process.env.APPDATA || '',
        'Code',
        'User',
        'globalStorage',
        'augment.augment-vscode',
      );
    } else {
      extensionDir = path.join(
        os.homedir(),
        '.config',
        'Code',
        'User',
        'globalStorage',
        'augment.augment-vscode',
      );
    }

    return fs.existsSync(extensionDir);
  }

  async getConfigPath(): Promise<string> {
    // Augment uses VS Code settings.json
    const platform = process.platform;

    if (platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Code',
        'User',
        'settings.json',
      );
    }

    if (platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Code',
        'User',
        'settings.json',
      );
    }

    // Linux
    return path.join(
      os.homedir(),
      '.config',
      'Code',
      'User',
      'settings.json',
    );
  }

  getServerPropertyName(): string {
    return 'augment.advanced';
  }

  // Augment uses array format, not object format
  getServerConfig(apiKey: string, _mode: 'local' | 'remote'): MCPServerConfig {
    // Augment only supports local (stdio) mode based on Context7 docs
    return {
      name: SERVER_NAME,
      command: 'pipx',
      args: ['run', '--no-cache', 'nia-mcp-server'],
      env: {
        NIA_API_KEY: apiKey,
        NIA_API_URL: NIA_API_URL,
      },
    };
  }

  // Custom implementation for array-based config
  async isServerInstalled(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    if (!fs.existsSync(configPath)) return false;

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      const mcpServers = config?.['augment.advanced']?.mcpServers;
      if (!Array.isArray(mcpServers)) return false;
      return mcpServers.some((s: { name?: string }) => s.name === SERVER_NAME);
    } catch {
      return false;
    }
  }

  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);

    try {
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Read existing config or create new
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(content);
      }

      // Ensure augment.advanced exists
      if (!config['augment.advanced']) {
        config['augment.advanced'] = {};
      }
      const augmentAdvanced = config['augment.advanced'] as Record<string, unknown>;

      // Ensure mcpServers is an array
      if (!Array.isArray(augmentAdvanced.mcpServers)) {
        augmentAdvanced.mcpServers = [];
      }
      const mcpServers = augmentAdvanced.mcpServers as Array<{ name?: string }>;

      // Remove existing server with same name
      const filtered = mcpServers.filter((s) => s.name !== SERVER_NAME);

      // Add new server
      filtered.push(this.getServerConfig(apiKey, mode));
      augmentAdvanced.mcpServers = filtered;

      // Write back
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    const configPath = await this.getConfigPath();

    if (!fs.existsSync(configPath)) {
      return { success: true };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      const augmentAdvanced = config?.['augment.advanced'];
      if (augmentAdvanced && Array.isArray(augmentAdvanced.mcpServers)) {
        augmentAdvanced.mcpServers = augmentAdvanced.mcpServers.filter(
          (s: { name?: string }) => s.name !== SERVER_NAME,
        );
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  supportsRemote(): boolean {
    return false; // Augment only supports local mode
  }
}
