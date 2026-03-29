import { spawnSync } from 'child_process';
import clack from './clack.js';
import { debug } from './debug.js';

const NIA_CLI_PACKAGE = '@nozomioai/nia';
const LATEST_NIA_CLI_PACKAGE = `${NIA_CLI_PACKAGE}@latest`;

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function bunCommand(): string {
  return process.platform === 'win32' ? 'bun.exe' : 'bun';
}

function npxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function bunxCommand(): string {
  return process.platform === 'win32' ? 'bunx.exe' : 'bunx';
}

function hasCommand(command: string, args: string[] = ['--version']): boolean {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf-8',
    // On Windows, shell is needed to resolve .cmd shims (npm) via PATHEXT
    shell: process.platform === 'win32',
  });

  debug(`${command} ${args.join(' ')} status`, result.status);
  return result.status === 0;
}

export function isNiaCliInstalled(): boolean {
  return hasCommand('nia');
}

function hasBun(): boolean {
  return hasCommand(bunCommand());
}

function runLatestNia(args: string[]): boolean {
  if (hasBun()) {
    const result = spawnSync(bunxCommand(), ['-p', LATEST_NIA_CLI_PACKAGE, 'nia', ...args], {
      stdio: 'inherit',
      shell: false,
    });

    return result.status === 0;
  }

  const result = spawnSync(npxCommand(), ['-y', '-p', LATEST_NIA_CLI_PACKAGE, 'nia', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return result.status === 0;
}

export function ensureNiaCliInstalled(): boolean {
  const bunAvailable = hasBun();
  const installSpinner = clack.spinner();

  if (isNiaCliInstalled()) {
    clack.log.info(`Updating ${LATEST_NIA_CLI_PACKAGE} globally with ${bunAvailable ? 'bun' : 'npm'}...`);
  } else {
    clack.log.info(`Installing ${LATEST_NIA_CLI_PACKAGE} globally with ${bunAvailable ? 'bun' : 'npm'}...`);
  }

  installSpinner.start(`Installing ${LATEST_NIA_CLI_PACKAGE}...`);

  const installResult = bunAvailable
    ? spawnSync(bunCommand(), ['add', '-g', LATEST_NIA_CLI_PACKAGE], {
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: false,
      })
    : spawnSync(npmCommand(), ['install', '-g', LATEST_NIA_CLI_PACKAGE], {
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: process.platform === 'win32',
      });

  if (installResult.status !== 0) {
    installSpinner.stop('Failed to install @nozomioai/nia');
    const installOutput = [installResult.stdout, installResult.stderr].filter(Boolean).join('\n').trim();
    if (installOutput) {
      clack.log.error(installOutput);
    }
    clack.log.error('Could not install @nozomioai/nia automatically.');
    clack.log.info(
      `Install manually: ${bunAvailable ? 'bun add -g' : 'npm install -g'} ${LATEST_NIA_CLI_PACKAGE}`,
    );
    return false;
  }

  if (!isNiaCliInstalled()) {
    installSpinner.stop('Installed @nozomioai/nia, but `nia` is not available');
    clack.log.error('The `nia` command is still unavailable in your PATH.');
    clack.log.info(
      `Open a new terminal or run: ${bunAvailable ? 'bun add -g' : 'npm install -g'} ${LATEST_NIA_CLI_PACKAGE}`,
    );
    return false;
  }

  installSpinner.stop(`${LATEST_NIA_CLI_PACKAGE} ready!`);
  return true;
}

export function runNiaSkill(): boolean {
  return runLatestNia(['skill', '--all']);
}

export function runNiaAuthLogin(apiKey: string): boolean {
  return runLatestNia(['auth', 'login', '--api-key', apiKey]);
}
