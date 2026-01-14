import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { getDefaultServerConfig } from './defaults.js';
import type { MCPServerConfig, MCPClientResult } from '../../utils/types.js';
import { debug } from '../../utils/debug.js';

export const SERVER_NAME = 'nia';

export abstract class MCPClient {
  abstract name: string;
  abstract getConfigPath(): Promise<string>;
  abstract getServerPropertyName(): string;
  abstract isClientSupported(): Promise<boolean>;

  /**
   * Check if server is already installed
   */
  async isServerInstalled(): Promise<boolean> {
    try {
      const configPath = await this.getConfigPath();

      if (!fs.existsSync(configPath)) {
        return false;
      }

      const configContent = await fs.promises.readFile(configPath, 'utf8');
      const config = jsonc.parse(configContent) as Record<string, unknown>;
      const serverProp = this.getServerPropertyName();

      return (
        serverProp in config &&
        typeof config[serverProp] === 'object' &&
        config[serverProp] !== null &&
        SERVER_NAME in (config[serverProp] as Record<string, unknown>)
      );
    } catch {
      return false;
    }
  }

  /**
   * Get the server config for this client
   */
  getServerConfig(apiKey: string, mode: 'local' | 'remote'): MCPServerConfig {
    return getDefaultServerConfig(apiKey, mode);
  }

  /**
   * Add the MCP server to this client
   */
  async addServer(
    apiKey: string,
    mode: 'local' | 'remote',
  ): Promise<MCPClientResult> {
    try {
      const configPath = await this.getConfigPath();
      const configDir = path.dirname(configPath);

      // Ensure directory exists
      await fs.promises.mkdir(configDir, { recursive: true });

      const serverProp = this.getServerPropertyName();
      let configContent = '';
      let existingConfig: Record<string, unknown> = {};

      // Read existing config if it exists
      if (fs.existsSync(configPath)) {
        configContent = await fs.promises.readFile(configPath, 'utf8');
        existingConfig = (jsonc.parse(configContent) as Record<string, unknown>) || {};
      }

      // Get the new server config
      const newServerConfig = this.getServerConfig(apiKey, mode);

      // Use JSONC to safely modify the config (preserves comments)
      const edits = jsonc.modify(
        configContent,
        [serverProp, SERVER_NAME],
        newServerConfig,
        {
          formattingOptions: {
            tabSize: 2,
            insertSpaces: true,
          },
        },
      );

      const modifiedContent = jsonc.applyEdits(configContent, edits);
      await fs.promises.writeFile(configPath, modifiedContent, 'utf8');

      debug(`Wrote config to ${configPath}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug(`Failed to add server: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Remove the MCP server from this client
   */
  async removeServer(): Promise<MCPClientResult> {
    try {
      const configPath = await this.getConfigPath();

      if (!fs.existsSync(configPath)) {
        return { success: false, error: 'Config file not found' };
      }

      const configContent = await fs.promises.readFile(configPath, 'utf8');
      const serverProp = this.getServerPropertyName();

      // Remove the server entry
      const edits = jsonc.modify(
        configContent,
        [serverProp, SERVER_NAME],
        undefined,
        {
          formattingOptions: {
            tabSize: 2,
            insertSpaces: true,
          },
        },
      );

      const modifiedContent = jsonc.applyEdits(configContent, edits);
      await fs.promises.writeFile(configPath, modifiedContent, 'utf8');

      debug(`Removed server from ${configPath}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
