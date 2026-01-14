import chalk from 'chalk';
import clack from './utils/clack.js';
import {
  addMCPServerToClientsStep,
  removeMCPServerFromClientsStep,
} from './steps/add-mcp-server-to-clients/index.js';
import { getApiKey, askInstallMode } from './utils/clack-utils.js';
import { enableDebug } from './utils/debug.js';
import { ensureLocalDependencies, dependenciesReady } from './utils/dependencies.js';

export interface MCPAddOptions {
  apiKey?: string;
  local?: boolean;
  debug?: boolean;
  ci?: boolean;
}

/**
 * Add Nia MCP server to coding agents
 */
export async function runMCPAdd(options: MCPAddOptions): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  clack.intro(chalk.bgCyan.black(' Nia MCP Server '));

  // Get API key
  const apiKey = await getApiKey(options.apiKey);

  // Get install mode
  let mode: 'local' | 'remote';
  if (options.local !== undefined) {
    mode = options.local ? 'local' : 'remote';
    clack.log.info(`Using ${mode} mode`);
  } else if (options.ci) {
    mode = 'local'; // Default to local in CI
    clack.log.info('Using local mode (CI default)');
  } else {
    mode = await askInstallMode(true);
  }

  // If local mode, ensure dependencies are installed
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

  // Run installation
  const installedClients = await addMCPServerToClientsStep({
    apiKey,
    mode,
    ci: options.ci,
  });

  if (installedClients.length > 0) {
    clack.log.message(
      chalk.dim('You may need to restart your coding agents to load Nia.'),
    );
  }

  clack.outro(chalk.green('Done!'));
}

/**
 * Remove Nia MCP server from coding agents
 */
export async function runMCPRemove(options: { debug?: boolean } = {}): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  clack.intro(chalk.bgRed.white(' Remove Nia MCP Server '));

  const removedClients = await removeMCPServerFromClientsStep();

  if (removedClients.length > 0) {
    clack.log.message(
      chalk.dim('You may need to restart your coding agents for changes to take effect.'),
    );
  }

  clack.outro(chalk.green('Done!'));
}
