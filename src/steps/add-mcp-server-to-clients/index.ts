import clack from '../../utils/clack.js';
import chalk from 'chalk';
import { abortIfCancelled } from '../../utils/clack-utils.js';
import { MCPClient } from './MCPClient.js';
import {
  // Core clients
  CursorMCPClient,
  ClaudeDesktopMCPClient,
  ClaudeCodeMCPClient,
  VSCodeMCPClient,
  WindsurfMCPClient,
  ZedMCPClient,
  ClineMCPClient,
  CodexCLIMCPClient,
  CodexAppMCPClient,
  // Additional clients
  ContinueMCPClient,
  JetBrainsMCPClient,
  AntigravityMCPClient,
  TraeMCPClient,
  RooCodeMCPClient,
  KiloCodeMCPClient,
  GeminiCLIMCPClient,
  OpencodeMCPClient,
  QodoGenMCPClient,
  QwenCoderMCPClient,
  VisualStudioMCPClient,
  CrushMCPClient,
  CopilotCLIMCPClient,
  CopilotAgentMCPClient,
  AugmentMCPClient,
  KiroMCPClient,
  LMStudioMCPClient,
  BoltAIMCPClient,
  PerplexityMCPClient,
  WarpMCPClient,
  AmazonQMCPClient,
  FactoryMCPClient,
  AmpMCPClient,
  VibeMCPClient,
} from './clients/index.js';
import { debug } from '../../utils/debug.js';

export { MCPClient } from './MCPClient.js';
export * from './defaults.js';

/**
 * Get all MCP clients (regardless of whether they're supported on this system)
 */
export function getAllClients(): MCPClient[] {
  return [
    // Core / popular clients first
    new CursorMCPClient(),
    new ClaudeCodeMCPClient(),
    new ClaudeDesktopMCPClient(),
    new VSCodeMCPClient(),
    new WindsurfMCPClient(),
    new ClineMCPClient(),
    new ContinueMCPClient(),
    new ZedMCPClient(),
    new JetBrainsMCPClient(),
    // Additional clients
    new AntigravityMCPClient(),
    new TraeMCPClient(),
    new RooCodeMCPClient(),
    new KiloCodeMCPClient(),
    new GeminiCLIMCPClient(),
    new OpencodeMCPClient(),
    new QodoGenMCPClient(),
    new QwenCoderMCPClient(),
    new VisualStudioMCPClient(),
    new CrushMCPClient(),
    new CopilotCLIMCPClient(),
    new CopilotAgentMCPClient(),
    new AugmentMCPClient(),
    new KiroMCPClient(),
    new LMStudioMCPClient(),
    new BoltAIMCPClient(),
    new PerplexityMCPClient(),
    new WarpMCPClient(),
    new AmazonQMCPClient(),
    new CodexCLIMCPClient(),
    new CodexAppMCPClient(),
    new FactoryMCPClient(),
    new AmpMCPClient(),
    new VibeMCPClient(),
  ];
}

/**
 * Get all MCP clients that are supported on this system
 */
export async function getSupportedClients(): Promise<MCPClient[]> {
  const allClients: MCPClient[] = [
    // Core / popular clients first
    new CursorMCPClient(),
    new ClaudeCodeMCPClient(),
    new ClaudeDesktopMCPClient(),
    new VSCodeMCPClient(),
    new WindsurfMCPClient(),
    new ClineMCPClient(),
    new ContinueMCPClient(),
    new ZedMCPClient(),
    new JetBrainsMCPClient(),
    // Additional clients
    new AntigravityMCPClient(),
    new TraeMCPClient(),
    new RooCodeMCPClient(),
    new KiloCodeMCPClient(),
    new GeminiCLIMCPClient(),
    new OpencodeMCPClient(),
    new QodoGenMCPClient(),
    new QwenCoderMCPClient(),
    new VisualStudioMCPClient(),
    new CrushMCPClient(),
    new CopilotCLIMCPClient(),
    new CopilotAgentMCPClient(),
    new AugmentMCPClient(),
    new KiroMCPClient(),
    new LMStudioMCPClient(),
    new BoltAIMCPClient(),
    new PerplexityMCPClient(),
    new WarpMCPClient(),
    new AmazonQMCPClient(),
    new CodexCLIMCPClient(),
    new CodexAppMCPClient(),
    new FactoryMCPClient(),
    new AmpMCPClient(),
    new VibeMCPClient(),
  ];

  const supportedClients: MCPClient[] = [];

  debug('Checking for supported MCP clients...');
  for (const client of allClients) {
    const isSupported = await client.isClientSupported();
    debug(`${client.name}: ${isSupported ? '✓ supported' : '✗ not supported'}`);
    if (isSupported) {
      supportedClients.push(client);
    }
  }
  debug(
    `Found ${supportedClients.length} supported client(s): ${supportedClients
      .map((c) => c.name)
      .join(', ')}`,
  );

  return supportedClients;
}

export interface AddMCPServerOptions {
  apiKey: string;
  mode: 'local' | 'remote';
  /** Skip prompts and install to all detected clients */
  ci?: boolean;
}

/**
 * Main step: Add MCP server to all supported clients
 */
export async function addMCPServerToClientsStep(
  options: AddMCPServerOptions,
): Promise<string[]> {
  const { apiKey, mode, ci = false } = options;

  // Get all clients and check which are supported
  const allClients = getAllClients();
  const supportedNames = new Set<string>();

  for (const client of allClients) {
    if (await client.isClientSupported()) {
      supportedNames.add(client.name);
    }
  }

  // In CI mode, auto-select only detected clients
  let selectedClients: MCPClient[];

  if (ci) {
    selectedClients = allClients.filter((c) => supportedNames.has(c.name));
    if (selectedClients.length === 0) {
      clack.log.warn('No coding agents detected on this system.');
      return [];
    }
    clack.log.info(
      `Auto-selecting ${selectedClients.length} client(s): ${selectedClients.map((c) => c.name).join(', ')}`,
    );
  } else {
    // Let user select which clients to install to - show ALL, mark undetected
    const selectedNames = await abortIfCancelled(
      clack.multiselect({
        message: 'Select which coding agents to install Nia to:',
        options: allClients.map((client) => ({
          value: client.name,
          label: client.name,
          hint: supportedNames.has(client.name) ? undefined : 'not detected - rerun wizard → Manual Setup',
        })),
        initialValues: allClients
          .filter((c) => supportedNames.has(c.name))
          .map((c) => c.name),
        required: false,
      }),
    );

    selectedClients = allClients.filter((client) =>
      selectedNames.includes(client.name),
    );
  }

  if (selectedClients.length === 0) {
    clack.log.info('No clients selected.');
    return [];
  }

  // Check for existing installations
  const installedClients: MCPClient[] = [];
  for (const client of selectedClients) {
    if (await client.isServerInstalled()) {
      installedClients.push(client);
    }
  }

  // Handle reinstall
  if (installedClients.length > 0 && !ci) {
    clack.log.warn(
      `Nia is already configured for:\n  ${installedClients.map((c) => `• ${c.name}`).join('\n  ')}`,
    );

    const reinstall = await abortIfCancelled(
      clack.confirm({
        message: 'Reinstall to update configuration?',
        initialValue: true,
      }),
    );

    if (!reinstall) {
      // Remove already-installed clients from the list
      selectedClients = selectedClients.filter(
        (c) => !installedClients.includes(c),
      );

      if (selectedClients.length === 0) {
        clack.log.info('Nothing to install.');
        return [];
      }
    }
  }

  // Install to selected clients
  const spinner = clack.spinner();
  spinner.start('Installing Nia MCP server...');

  const successfulClients: string[] = [];
  const failedClients: { name: string; error: string }[] = [];

  for (const client of selectedClients) {
    const result = await client.addServer(apiKey, mode);

    if (result.success) {
      successfulClients.push(client.name);
    } else {
      failedClients.push({ name: client.name, error: result.error || 'Unknown error' });
    }
  }

  spinner.stop('Installation complete.');

  // Report results
  if (successfulClients.length > 0) {
    clack.log.success(
      `Installed Nia to:\n  ${successfulClients.map((n) => `• ${n}`).join('\n  ')}`,
    );
  }

  if (failedClients.length > 0) {
    clack.log.warn(
      `Failed to install to:\n  ${failedClients.map((f) => `• ${f.name}: ${f.error}`).join('\n  ')}`,
    );
  }

  return successfulClients;
}

/**
 * Remove MCP server from clients
 */
export async function removeMCPServerFromClientsStep(): Promise<string[]> {
  // Get clients where Nia is installed
  const supportedClients = await getSupportedClients();
  const installedClients: MCPClient[] = [];

  for (const client of supportedClients) {
    if (await client.isServerInstalled()) {
      installedClients.push(client);
    }
  }

  if (installedClients.length === 0) {
    clack.log.info('Nia is not installed in any detected coding agents.');
    return [];
  }

  // Let user select which to remove from
  const selectedNames = await abortIfCancelled(
    clack.multiselect({
      message: 'Select which coding agents to remove Nia from:',
      options: installedClients.map((client) => ({
        value: client.name,
        label: client.name,
      })),
      initialValues: installedClients.map((client) => client.name),
      required: true,
    }),
  );

  const selectedClients = installedClients.filter((client) =>
    selectedNames.includes(client.name),
  );

  if (selectedClients.length === 0) {
    return [];
  }

  // Remove from selected clients
  const spinner = clack.spinner();
  spinner.start('Removing Nia MCP server...');

  const removedClients: string[] = [];

  for (const client of selectedClients) {
    const result = await client.removeServer();
    if (result.success) {
      removedClients.push(client.name);
    }
  }

  spinner.stop('Removal complete.');

  if (removedClients.length > 0) {
    clack.log.success(
      `Removed Nia from:\n  ${removedClients.map((n) => `• ${n}`).join('\n  ')}`,
    );
  }

  return removedClients;
}
