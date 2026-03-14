import { spawnSync } from 'child_process';
import clack from './clack.js';
import { debug } from './debug.js';

const NIA_CLI_PACKAGE = '@nozomioai/nia';

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function npxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function niaCommand(): string {
  return process.platform === 'win32' ? 'nia.cmd' : 'nia';
}

export function isNiaCliInstalled(): boolean {
  const result = spawnSync(niaCommand(), ['--version'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: false,
  });

  debug('nia --version status', result.status);
  return result.status === 0;
}

export function ensureNiaCliInstalled(): boolean {
  if (isNiaCliInstalled()) {
    return true;
  }

  clack.log.info('Installing @nozomioai/nia globally with npm...');

  const installSpinner = clack.spinner();
  installSpinner.start('Installing @nozomioai/nia...');

  const installResult = spawnSync(npmCommand(), ['install', '-g', NIA_CLI_PACKAGE], {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: false,
  });

  if (installResult.status !== 0) {
    installSpinner.stop('Failed to install @nozomioai/nia');
    const installOutput = [installResult.stdout, installResult.stderr].filter(Boolean).join('\n').trim();
    if (installOutput) {
      clack.log.error(installOutput);
    }
    clack.log.error('Could not install @nozomioai/nia automatically.');
    clack.log.info('Install manually: npm install -g @nozomioai/nia');
    return false;
  }

  if (!isNiaCliInstalled()) {
    installSpinner.stop('Installed @nozomioai/nia, but `nia` is not available');
    clack.log.error('The `nia` command is still unavailable in your PATH.');
    clack.log.info('Open a new terminal or run: npm install -g @nozomioai/nia');
    return false;
  }

  installSpinner.stop('@nozomioai/nia installed!');
  return true;
}

export function runNiaSkill(): boolean {
  const runResult = spawnSync(niaCommand(), ['skill', '--all'], {
    stdio: 'inherit',
    shell: false,
  });

  if (runResult.status === 0) {
    return true;
  }

  debug('nia skill --all failed, falling back to npx @nozomioai/nia skill --all', runResult.status);
  clack.log.warn('`nia skill --all` failed. Trying `npx -y @nozomioai/nia skill --all`...');

  const fallbackResult = spawnSync(npxCommand(), ['-y', NIA_CLI_PACKAGE, 'skill', '--all'], {
    stdio: 'inherit',
    shell: false,
  });

  return fallbackResult.status === 0;
}

export function runNiaAuthLogin(apiKey: string): boolean {
  const authResult = spawnSync(niaCommand(), ['auth', 'login', '--api-key', apiKey], {
    stdio: 'inherit',
    shell: false,
  });

  if (authResult.status === 0) {
    return true;
  }

  debug('nia auth login failed, falling back to npx @nozomioai/nia auth login', authResult.status);
  clack.log.warn('`nia auth login` failed. Trying `npx -y @nozomioai/nia auth login`...');

  const fallbackResult = spawnSync(
    npxCommand(),
    ['-y', NIA_CLI_PACKAGE, 'auth', 'login', '--api-key', apiKey],
    {
      stdio: 'inherit',
      shell: false,
    },
  );

  return fallbackResult.status === 0;
}
