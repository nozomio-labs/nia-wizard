import chalk from 'chalk';
import clack from './utils/clack.js';
import { printWelcome, getApiKey, askInstallMode } from './utils/clack-utils.js';
import { addMCPServerToClientsStep } from './steps/add-mcp-server-to-clients/index.js';
import { enableDebug } from './utils/debug.js';
import { ensureLocalDependencies, dependenciesReady } from './utils/dependencies.js';
import type { WizardOptions } from './utils/types.js';

/**
 * Main wizard entry point
 */
export async function runWizard(options: WizardOptions): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  printWelcome();

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
