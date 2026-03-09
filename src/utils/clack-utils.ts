import clack, { isCancel } from './clack.js';
import chalk from 'chalk';
import open from 'open';
import {
  startDeviceSession,
  exchangeForApiKey,
  formatUserCode,
  isSessionValid,
  getSessionTimeRemaining,
  isDeviceFlowError,
  type DeviceSession,
} from './device-flow.js';
import { debug } from './debug.js';

// Use env var for local dev, prod as default
const NIA_APP_URL = process.env.NIA_APP_URL || 'https://app.trynia.ai';

export async function abortIfCancelled<T>(
  input: T | Promise<T>,
): Promise<Exclude<T, symbol>> {
  const result = await input;

  if (isCancel(result)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }

  return result as Exclude<T, symbol>;
}

export async function abort(message?: string, code = 1): Promise<never> {
  clack.outro(message ?? 'Setup cancelled.');
  process.exit(code);
}

export function printWelcome(): void {
  console.log('');
  clack.intro(chalk.bgCyan.black(' Nia Wizard '));
  clack.note(
    'This wizard installs Nia for your coding agents.\nGet external docs, code search, and research tools inside your agent.',
  );
}

/**
 * Get API key from user - either passed as arg, via device flow, or manual entry
 */
export async function getApiKey(providedKey?: string): Promise<string> {
  // If key provided and valid, use it
  if (providedKey && providedKey.startsWith('nk_')) {
    clack.log.success('Using provided API key');
    return providedKey;
  }

  // Invalid key format
  if (providedKey && !providedKey.startsWith('nk_')) {
    clack.log.warn(`Invalid API key format. Keys should start with 'nk_'`);
  }

  // No key - offer device flow or manual entry
  clack.log.info('You need a Nia API key to continue.');

  const authMethod = await abortIfCancelled(
    clack.select({
      message: 'How would you like to authenticate?',
      options: [
        {
          value: 'browser' as const,
          label: 'Sign in with browser',
          hint: 'Recommended. Opens browser for quick sign-in.',
        },
        {
          value: 'manual' as const,
          label: 'Enter API key manually',
          hint: 'If you already have an API key.',
        },
      ],
      initialValue: 'browser' as const,
    }),
  );

  if (authMethod === 'browser') {
    return await runDeviceFlow();
  } else {
    return await promptForManualApiKey();
  }
}

/**
 * Run the device authorization flow
 */
async function runDeviceFlow(): Promise<string> {
  const spinner = clack.spinner();
  
  // Step 1: Start device session
  spinner.start('Connecting to Nia...');
  
  let session: DeviceSession;
  try {
    session = await startDeviceSession();
    spinner.stop('Connected!');
  } catch (error) {
    spinner.stop('Failed to connect');
    
    if (isDeviceFlowError(error)) {
      clack.log.error(error.message);
    } else {
      clack.log.error('Failed to connect to Nia servers. Check your internet connection.');
      debug(`Device flow error: ${error}`);
    }
    
    // Fall back to manual entry
    clack.log.info('Falling back to manual API key entry.');
    return await promptForManualApiKey();
  }

  // Step 2: Display the code and open browser
  const formattedCode = formatUserCode(session.user_code);
  const timeRemaining = getSessionTimeRemaining(session);
  
  console.log('');
  clack.note(
    `${chalk.bold('Your authorization code:')}\n\n` +
    `    ${chalk.bold.green(formattedCode)}\n\n` +
    chalk.dim(`Code expires in ${Math.floor(timeRemaining / 60)} minutes`),
    'Browser Authorization'
  );
  
  // Open browser
  clack.log.info(`Opening ${chalk.cyan(session.verification_url)}...`);
  
  try {
    await open(session.verification_url);
  } catch {
    clack.log.warn('Could not open browser automatically.');
  }
  
  console.log('');
  clack.log.message(
    chalk.dim('If the browser didn\'t open, go to:\n') +
    `  ${chalk.cyan(session.verification_url)}`
  );
  
  // Step 3: Show instructions
  console.log('');
  clack.log.step(chalk.yellow('Complete these steps in your browser:'));
  console.log('  1. Sign in or create an account');
  console.log('  2. Complete any setup steps shown');
  console.log('');
  clack.log.message(chalk.dim('The CLI will detect when you\'re done and continue automatically.'));
  console.log('');

  // Step 4: Wait for user and exchange
  return await waitForAuthorizationAndExchange(session);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Auto-poll for authorization and exchange for API key.
 * Polls every 2s (with backoff on consecutive network errors), up to session expiry.
 */
async function waitForAuthorizationAndExchange(session: DeviceSession): Promise<string> {
  const spinner = clack.spinner();
  spinner.start('Waiting for browser authorization...');

  const POLL_INTERVAL_MS = 2000;
  const MAX_NETWORK_ERRORS = 5;
  let consecutiveNetworkErrors = 0;

  while (true) {
    if (!isSessionValid(session)) {
      spinner.stop('Session expired');
      clack.log.error('Session has expired. Please start over.');
      return abort('Session expired', 1);
    }

    try {
      const apiKey = await exchangeForApiKey(session);
      spinner.stop(chalk.green('✓ Authorized!'));
      clack.log.success('API key obtained successfully!');
      return apiKey;
    } catch (error) {
      if (isDeviceFlowError(error)) {
        switch (error.type) {
          case 'not_ready':
            consecutiveNetworkErrors = 0;
            break;

          case 'expired':
            spinner.stop('Session expired');
            clack.log.error('Session has expired.');
            clack.log.info('Please run the wizard again to start a new session.');
            return abort('Session expired', 1);

          case 'consumed':
            spinner.stop('Session already used');
            clack.log.error('This session was already used.');
            clack.log.info('Please run the wizard again to start a new session.');
            return abort('Session already used', 1);

          case 'invalid':
            spinner.stop('Invalid session');
            clack.log.error(error.message);
            clack.log.info('Please run the wizard again to start a new session.');
            return abort('Invalid session', 1);

          case 'network':
            consecutiveNetworkErrors++;
            if (consecutiveNetworkErrors >= MAX_NETWORK_ERRORS) {
              spinner.stop('Connection failed');
              clack.log.error(`Failed to reach Nia servers after ${MAX_NETWORK_ERRORS} attempts.`);
              clack.log.info('Falling back to manual API key entry.');
              return await promptForManualApiKey();
            }
            break;

          default:
            spinner.stop('Error');
            clack.log.error(error.message);
            clack.log.info('Falling back to manual API key entry.');
            return await promptForManualApiKey();
        }
      } else {
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= MAX_NETWORK_ERRORS) {
          spinner.stop('Connection failed');
          clack.log.error('Lost connection to Nia servers.');
          debug(`Exchange error: ${error}`);
          clack.log.info('Falling back to manual API key entry.');
          return await promptForManualApiKey();
        }
      }
    }

    const backoff = consecutiveNetworkErrors > 0
      ? POLL_INTERVAL_MS * Math.min(consecutiveNetworkErrors, 4)
      : POLL_INTERVAL_MS;
    await sleep(backoff);
  }
}

/**
 * Prompt user to manually enter their API key
 */
async function promptForManualApiKey(): Promise<string> {
  const shouldOpen = await abortIfCancelled(
    clack.confirm({
      message: `Open ${chalk.cyan(NIA_APP_URL)} to get your API key?`,
      initialValue: true,
    }),
  );

  if (shouldOpen) {
    clack.log.info(`Opening ${chalk.cyan(NIA_APP_URL)}...`);
    try {
      await open(NIA_APP_URL);
    } catch {
      clack.log.warn('Could not open browser. Please go to the URL manually.');
    }
  } else {
    clack.log.info(`Get your API key at: ${chalk.cyan(NIA_APP_URL)}`);
  }

  const apiKey = await abortIfCancelled(
    clack.text({
      message: 'Paste your API key (nk_...):',
      placeholder: 'nk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      validate: (value) => {
        if (!value) return 'API key is required';
        if (!value.startsWith('nk_')) return "API key should start with 'nk_'";
        if (value.length < 10) return 'API key is too short';
        return undefined;
      },
    }),
  );

  return apiKey;
}

/**
 * Ask user to select installation mode
 */
export async function askInstallMode(
  defaultLocal = false,
): Promise<'local' | 'remote'> {
  const mode = await abortIfCancelled(
    clack.select({
      message: 'Select installation mode:',
      options: [
        {
          value: 'remote' as const,
          label: 'Remote (Recommended)',
        },
        {
          value: 'local' as const,
          label: 'Local',
          hint: 'Requires pipx',
        },
      ],
      initialValue: defaultLocal ? 'local' : 'remote',
    }),
  );

  return mode as 'local' | 'remote';
}
