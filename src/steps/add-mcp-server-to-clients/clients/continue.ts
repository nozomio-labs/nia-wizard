import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient, SERVER_NAME } from '../MCPClient.js';
import { REMOTE_MCP_URL, NIA_API_URL } from '../defaults.js';
import type { MCPClientResult } from '../../../utils/types.js';

export class ContinueMCPClient extends MCPClient {
  name = 'Continue.dev';
  docsUrl = 'https://docs.continue.dev/customize/mcp-tools';
  note = 'Uses YAML config in ~/.continue/mcpServers/';

  private getMcpServersDir(): string {
    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(process.env.USERPROFILE || '', '.continue', 'mcpServers');
    }
    return path.join(os.homedir(), '.continue', 'mcpServers');
  }

  async isClientSupported(): Promise<boolean> {
    // Check if ~/.continue directory exists
    const continueDir = path.dirname(this.getMcpServersDir());
    return fs.existsSync(continueDir);
  }

  async getConfigPath(): Promise<string> {
    return path.join(this.getMcpServersDir(), 'nia.yaml');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    return fs.existsSync(configPath);
  }

  private generateYamlConfig(apiKey: string, mode: 'local' | 'remote'): string {
    if (mode === 'remote') {
      return `name: ${SERVER_NAME}
version: 0.0.1
schema: v1
mcpServers:
  - name: ${SERVER_NAME}
    type: http
    url: ${REMOTE_MCP_URL}
    headers:
      Authorization: Bearer ${apiKey}
`;
    }

    return `name: ${SERVER_NAME}
version: 0.0.1
schema: v1
mcpServers:
  - name: ${SERVER_NAME}
    command: pipx
    args:
      - run
      - --no-cache
      - nia-mcp-server
    env:
      NIA_API_KEY: ${apiKey}
      NIA_API_URL: ${NIA_API_URL}
`;
  }

  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    try {
      const mcpServersDir = this.getMcpServersDir();
      const configPath = await this.getConfigPath();

      // Ensure mcpServers directory exists
      if (!fs.existsSync(mcpServersDir)) {
        fs.mkdirSync(mcpServersDir, { recursive: true });
      }

      // Write YAML config
      const yamlContent = this.generateYamlConfig(apiKey, mode);
      fs.writeFileSync(configPath, yamlContent);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<MCPClientResult> {
    try {
      const configPath = await this.getConfigPath();

      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
