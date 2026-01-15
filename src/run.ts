import chalk from 'chalk';
import clack from './utils/clack.js';
import { printWelcome, getApiKey, askInstallMode, abortIfCancelled } from './utils/clack-utils.js';
import { addMCPServerToClientsStep, getAllClients } from './steps/add-mcp-server-to-clients/index.js';
import { enableDebug } from './utils/debug.js';
import { ensureLocalDependencies, dependenciesReady } from './utils/dependencies.js';
import type { WizardOptions } from './utils/types.js';
import { getDefaultServerConfig, getRemoteServerConfig, getLocalServerConfig, REMOTE_MCP_URL } from './steps/add-mcp-server-to-clients/defaults.js';

/**
 * Run manual mode - show config without installing
 */
async function runManualMode(): Promise<void> {
  const allClients = getAllClients();

  // Let user select which agent to view
  const selectedName = await abortIfCancelled(
    clack.select({
      message: 'Select a coding agent to view its configuration:',
      options: allClients.map((client) => ({
        value: client.name,
        label: client.name,
        hint: client.note || undefined,
      })),
    }),
  );

  const client = allClients.find((c) => c.name === selectedName);
  if (!client) {
    clack.log.error('Client not found');
    return;
  }

  // Show the configuration for this client
  console.log('');
  clack.log.info(chalk.bold(`Configuration for ${client.name}`));
  console.log('');

  // Show docs URL if available
  if (client.docsUrl) {
    console.log(chalk.cyan('  Documentation:'));
    console.log(`    ${chalk.underline(client.docsUrl)}`);
    console.log('');
  }

  // Show special notes
  if (client.note) {
    console.log(chalk.yellow('  Note:'));
    console.log(`    ${client.note}`);
    console.log('');
  }

  // Try to get config path
  let configPath = '';
  try {
    configPath = await client.getConfigPath();
    console.log(chalk.cyan('  Config file path:'));
    console.log(`    ${configPath}`);
    console.log('');
  } catch {
    if (client.usesCLI) {
      console.log(chalk.cyan('  Configuration method:'));
      console.log(`    Uses CLI commands (no config file)`);
      console.log('');
    }
  }

  // Show example configs
  const exampleApiKey = 'nk_YOUR_API_KEY_HERE';

  // Local config
  console.log(chalk.cyan('  Local mode config (stdio):'));
  const localConfig = client.getServerConfig(exampleApiKey, 'local');
  console.log(chalk.dim('    Add this to your config file under the servers section:'));
  console.log('');
  console.log(chalk.green(`    "${client.name === 'Cursor' ? 'mcpServers' : client.getServerPropertyName()}": {`));
  console.log(chalk.green(`      "nia": ${JSON.stringify(localConfig, null, 6).split('\n').map((line, i) => i === 0 ? line : '      ' + line).join('\n')}`));
  console.log(chalk.green(`    }`));
  console.log('');

  // Remote config
  console.log(chalk.cyan('  Remote mode config (HTTP):'));
  const remoteConfig = client.getServerConfig(exampleApiKey, 'remote');
  console.log(chalk.dim('    Add this to your config file under the servers section:'));
  console.log('');
  console.log(chalk.green(`    "${client.name === 'Cursor' ? 'mcpServers' : client.getServerPropertyName()}": {`));
  console.log(chalk.green(`      "nia": ${JSON.stringify(remoteConfig, null, 6).split('\n').map((line, i) => i === 0 ? line : '      ' + line).join('\n')}`));
  console.log(chalk.green(`    }`));
  console.log('');

  // CLI command examples for CLI-based clients
  if (client.usesCLI) {
    console.log(chalk.cyan('  CLI commands:'));
    if (client.name === 'Claude Code') {
      console.log(chalk.dim('    Local mode:'));
      console.log(`      claude mcp add -e "NIA_API_KEY=${exampleApiKey}" -e "NIA_API_URL=https://apigcp.trynia.ai/" -s user nia -- pipx run --no-cache nia-mcp-server`);
      console.log('');
      console.log(chalk.dim('    Remote mode:'));
      console.log(`      claude mcp add --transport http --header "Authorization: Bearer ${exampleApiKey}" -s user nia "${REMOTE_MCP_URL}"`);
    } else if (client.name === 'Codex CLI') {
      console.log(chalk.dim('    Local mode:'));
      console.log(`      codex mcp add nia --env "NIA_API_KEY=${exampleApiKey}" --env "NIA_API_URL=https://apigcp.trynia.ai/" -- pipx run --no-cache nia-mcp-server`);
    } else if (client.name === 'Factory') {
      console.log(chalk.dim('    Local mode:'));
      console.log(`      droid mcp add nia "pipx run --no-cache nia-mcp-server" --env "NIA_API_KEY=${exampleApiKey}" --env "NIA_API_URL=https://apigcp.trynia.ai/"`);
      console.log('');
      console.log(chalk.dim('    Remote mode:'));
      console.log(`      droid mcp add nia ${REMOTE_MCP_URL} --type http --header "Authorization: Bearer ${exampleApiKey}"`);
    } else if (client.name === 'Amp') {
      console.log(chalk.dim('    Remote mode:'));
      console.log(`      amp mcp add nia --header "Authorization=Bearer ${exampleApiKey}" ${REMOTE_MCP_URL}`);
    }
    console.log('');
  }

  clack.outro(chalk.dim('Press Enter to exit'));
}

/**
 * Main wizard entry point
 */
export async function runWizard(options: WizardOptions): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  printWelcome();

  // First, ask what user wants to do
  const wizardMode = await abortIfCancelled(
    clack.select({
      message: 'What would you like to do?',
      options: [
        {
          value: 'install' as const,
          label: 'Install Nia MCP Server',
          hint: 'Automatically configure your coding agents',
        },
        {
          value: 'manual' as const,
          label: 'Manual Setup (View Config)',
          hint: 'View configuration for manual setup or troubleshooting',
        },
      ],
      initialValue: 'install' as const,
    }),
  );

  if (wizardMode === 'manual') {
    await runManualMode();
    return;
  }

  // Step 1: Get API key
  const apiKey = await getApiKey(options.apiKey);

  // Step 2: Select install mode
  let mode: 'local' | 'remote';
  if (options.local !== undefined) {
    mode = options.local ? 'local' : 'remote';
    clack.log.info(`Using ${mode} mode`);
  } else if (options.ci) {
    mode = 'local';
    clack.log.info('Using local mode (CI default)');
  } else {
    mode = await askInstallMode(true);
  }

  // Step 3: If local mode, ensure dependencies are installed
  if (mode === 'local') {
    if (!dependenciesReady()) {
      console.log('');
      const depsOk = await ensureLocalDependencies();
      if (!depsOk) {
        // Dependencies failed, offer to switch to remote
        clack.log.warn('Local mode requires additional dependencies.');
        const switchToRemote = await clack.confirm({
          message: 'Switch to remote mode instead?',
          initialValue: true,
        });
        
        if (switchToRemote) {
          mode = 'remote';
          clack.log.info('Switched to remote mode');
        } else {
          clack.outro(chalk.yellow('Please install dependencies and try again.'));
          process.exit(1);
        }
      }
      console.log('');
    } else {
      clack.log.success('Dependencies ready');
    }
  }

  // Step 4: Install to clients
  const installedClients = await addMCPServerToClientsStep({
    apiKey,
    mode,
    ci: options.ci,
  });

  // Outro
  if (installedClients.length > 0) {
    const outroMessage = `
${chalk.green('✓ Nia MCP Server installed!')}

${chalk.cyan('Get started:')}
  • Browse pre-indexed sources: ${chalk.cyan('https://app.trynia.ai/explore')}
  • Or index your own repos, docs, and papers

${chalk.cyan('Try in your coding agent:')}
  ${chalk.yellow('"List my indexed sources"')}
  ${chalk.yellow('"Search vercel/ai-sdk for streaming"')}
  ${chalk.yellow('"Run deep research on MCP protocols"')}

${chalk.dim('Using as API?')} ${chalk.cyan('https://docs.trynia.ai/api-guide')}
${chalk.dim('Follow us:')} ${chalk.cyan('https://x.com/nozomioai')}
`;
    clack.outro(outroMessage);
  } else {
    clack.outro(chalk.dim('No changes made.'));
  }
}
