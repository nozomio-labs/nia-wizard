export interface WizardOptions {
  /** API key (nk_xxxxx) */
  apiKey?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Use local MCP server instead of remote */
  local?: boolean;
  /** Skip prompts and use defaults */
  ci?: boolean;
}

export type MCPServerConfig = Record<string, unknown>;

export interface MCPClientResult {
  success: boolean;
  error?: string;
}
