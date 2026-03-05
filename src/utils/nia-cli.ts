import { spawnSync } from 'child_process';
import clack from './clack.js';
import { debug } from './debug.js';

const NIA_CLI_PACKAGE = 'nia-cli';

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function npxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

export function isNiaCliInstalled(): boolean {
  const result = spawnSync('nia', ['--version'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: false,
  });

  debug('nia --version status', result.status);
  return result.status === 0;
}

export function ensureNiaCliInstalled(): boolean {
  const checkSpinner = clack.spinner();
  checkSpinner.start('Checking for nia CLI...');

  if (isNiaCliInstalled()) {
    checkSpinner.stop('nia CLI found');
    return true;
  }

  checkSpinner.stop('nia CLI not found');
  clack.log.info('Installing nia-cli globally with npm...');

  const installSpinner = clack.spinner();
  installSpinner.start('Installing nia-cli...');

  const installResult = spawnSync(npmCommand(), ['install', '-g', NIA_CLI_PACKAGE], {
    stdio: 'inherit',
    shell: false,
  });

  if (installResult.status !== 0) {
    installSpinner.stop('Failed to install nia-cli');
    clack.log.error('Could not install nia-cli automatically.');
    clack.log.info('Install manually: npm install -g nia-cli');
    return false;
  }

  if (!isNiaCliInstalled()) {
    installSpinner.stop('Installed nia-cli, but `nia` is not available');
    clack.log.error('The `nia` command is still unavailable in your PATH.');
    clack.log.info('Open a new terminal or run: npm install -g nia-cli');
    return false;
  }

  installSpinner.stop('nia-cli installed!');
  return true;
}

export function runNiaSkill(): boolean {
  const runResult = spawnSync('nia', ['skill'], {
    stdio: 'inherit',
    shell: false,
  });

  if (runResult.status === 0) {
    return true;
  }

  debug('nia skill failed, falling back to npx nia-cli skill', runResult.status);
  clack.log.warn('`nia skill` failed. Trying `npx -y nia-cli skill`...');

  const fallbackResult = spawnSync(npxCommand(), ['-y', NIA_CLI_PACKAGE, 'skill'], {
    stdio: 'inherit',
    shell: false,
  });

  return fallbackResult.status === 0;
}
