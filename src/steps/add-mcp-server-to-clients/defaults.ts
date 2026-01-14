import { z } from 'zod';

// Remote MCP endpoint - use env vars for local dev, prod as default
export const REMOTE_MCP_URL = process.env.NIA_REMOTE_MCP_URL || 'https://apigcp.trynia.ai/mcp';
export const NIA_API_URL = process.env.NIA_API_URL || 'https://apigcp.trynia.ai/';

export const DefaultMCPClientConfig = z
  .object({
    mcpServers: z.record(
      z.string(),
      z.union([
        z.object({
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          env: z.record(z.string(), z.string()).optional(),
        }),
        z.object({
          url: z.string(),
          headers: z.record(z.string(), z.string()).optional(),
        }),
      ]),
    ),
  })
  .passthrough();

/**
 * Build MCP URL with optional parameters
 */
export function buildMCPUrl(local?: boolean): string {
  if (local) {
    return 'http://localhost:8787/mcp';
  }
  return REMOTE_MCP_URL;
}

/**
 * Get server config for remote HTTP mode
 */
export function getRemoteServerConfig(apiKey: string) {
  return {
    url: REMOTE_MCP_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

/**
 * Get server config for local stdio mode
 */
export function getLocalServerConfig(apiKey: string) {
  return {
    command: 'pipx',
    args: ['run', '--no-cache', 'nia-mcp-server'],
    env: {
      NIA_API_KEY: apiKey,
      NIA_API_URL: NIA_API_URL,
    },
  };
}

/**
 * Get the default server config based on mode
 */
export function getDefaultServerConfig(
  apiKey: string,
  mode: 'local' | 'remote',
) {
  if (mode === 'remote') {
    return getRemoteServerConfig(apiKey);
  }
  return getLocalServerConfig(apiKey);
}
