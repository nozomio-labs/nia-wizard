/**
 * Dependency management for local mode installation
 * Handles checking and installing pipx, Homebrew, etc.
 */

import { execSync, spawnSync } from 'child_process';
import os from 'os';
import clack from './clack.js';
import { abortIfCancelled } from './clack-utils.js';
import { debug } from './debug.js';
import chalk from 'chalk';

const isMacOS = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    const result = spawnSync(isWindows ? 'where' : 'which', [cmd], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Run a shell command and return success/failure
 */
function runCommand(cmd: string, options?: { silent?: boolean }): boolean {
  try {
    debug(`Running: ${cmd}`);
    execSync(cmd, {
      stdio: options?.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    debug(`Command failed: ${cmd}`, error);
    return false;
  }
}

/**
 * Check if Homebrew is installed (macOS only)
 */
export function checkHomebrew(): boolean {
  if (!isMacOS) return true; // Not needed on other platforms
  
  // Check common locations
  if (commandExists('brew')) return true;
  
  // Check Apple Silicon location
  try {
    execSync('test -f /opt/homebrew/bin/brew', { stdio: 'pipe' });
    return true;
  } catch {}
  
  // Check Intel Mac location
  try {
    execSync('test -f /usr/local/bin/brew', { stdio: 'pipe' });
    return true;
  } catch {}
  
  return false;
}

/**
 * Install Homebrew (macOS only)
 */
export async function installHomebrew(): Promise<boolean> {
  if (!isMacOS) return true;
  
  clack.log.info('Homebrew is required for local mode on macOS.');
  
  const shouldInstall = await abortIfCancelled(
    clack.confirm({
      message: 'Install Homebrew? (This may take a few minutes)',
      initialValue: true,
    }),
  );
  
  if (!shouldInstall) {
    clack.log.warn('Homebrew is required for local mode. Switching to remote mode or install manually.');
    return false;
  }
  
  const spinner = clack.spinner();
  spinner.start('Installing Homebrew...');
  
  try {
    // Run Homebrew installer
    execSync(
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      { stdio: 'inherit' }
    );
    
    // Add to PATH for Apple Silicon
    if (process.arch === 'arm64') {
      try {
        execSync('eval "$(/opt/homebrew/bin/brew shellenv)"', { stdio: 'pipe' });
      } catch {}
    }
    
    spinner.stop('Homebrew installed!');
    return true;
  } catch (error) {
    spinner.stop('Failed to install Homebrew');
    clack.log.error('Homebrew installation failed. Please install manually: https://brew.sh');
    return false;
  }
}

/**
 * Check if pipx is installed
 */
export function checkPipx(): boolean {
  return commandExists('pipx');
}

/**
 * Check if Python 3 is installed
 */
export function checkPython(): boolean {
  return commandExists('python3') || commandExists('python');
}

/**
 * Install pipx
 */
export async function installPipx(): Promise<boolean> {
  clack.log.info('pipx is required for local mode (manages Python packages safely).');
  
  const shouldInstall = await abortIfCancelled(
    clack.confirm({
      message: 'Install pipx?',
      initialValue: true,
    }),
  );
  
  if (!shouldInstall) {
    clack.log.warn('pipx is required for local mode.');
    return false;
  }
  
  const spinner = clack.spinner();
  spinner.start('Installing pipx...');
  
  try {
    if (isMacOS) {
      // Try Homebrew first (preferred on macOS)
      if (checkHomebrew()) {
        if (runCommand('brew install pipx', { silent: true })) {
          runCommand('pipx ensurepath', { silent: true });
          spinner.stop('pipx installed via Homebrew!');
          return true;
        }
      }
    }
    
    // Fallback to pip
    if (checkPython()) {
      const pythonCmd = commandExists('python3') ? 'python3' : 'python';
      if (runCommand(`${pythonCmd} -m pip install --user pipx`, { silent: true })) {
        runCommand(`${pythonCmd} -m pipx ensurepath`, { silent: true });
        spinner.stop('pipx installed via pip!');
        return true;
      }
    }
    
    spinner.stop('Failed to install pipx');
    clack.log.error('Could not install pipx automatically.');
    clack.log.info('Please install manually: https://pipx.pypa.io/stable/installation/');
    return false;
  } catch (error) {
    spinner.stop('Failed to install pipx');
    debug('pipx installation error:', error);
    return false;
  }
}

/**
 * Ensure all dependencies for local mode are installed
 * Returns true if all dependencies are ready, false otherwise
 */
export async function ensureLocalDependencies(): Promise<boolean> {
  clack.log.step('Checking dependencies for local mode...');
  
  // Check Homebrew (macOS only)
  if (isMacOS) {
    if (!checkHomebrew()) {
      clack.log.warn('Homebrew not found');
      const installed = await installHomebrew();
      if (!installed) return false;
    } else {
      clack.log.success('Homebrew found');
    }
  }
  
  // Check Python
  if (!checkPython()) {
    clack.log.warn('Python 3 not found');
    
    if (isMacOS && checkHomebrew()) {
      const shouldInstall = await abortIfCancelled(
        clack.confirm({
          message: 'Install Python 3 via Homebrew?',
          initialValue: true,
        }),
      );
      
      if (shouldInstall) {
        const spinner = clack.spinner();
        spinner.start('Installing Python 3...');
        if (runCommand('brew install python3', { silent: true })) {
          spinner.stop('Python 3 installed!');
        } else {
          spinner.stop('Failed to install Python 3');
          return false;
        }
      } else {
        return false;
      }
    } else {
      clack.log.error('Python 3 is required. Please install from https://python.org');
      return false;
    }
  } else {
    clack.log.success('Python found');
  }
  
  // Check pipx
  if (!checkPipx()) {
    clack.log.warn('pipx not found');
    const installed = await installPipx();
    if (!installed) return false;
  } else {
    clack.log.success('pipx found');
  }
  
  // Verify nia-mcp-server can be run
  clack.log.step('Installing/upgrading nia-mcp-server...');
  const spinner = clack.spinner();
  spinner.start('Setting up nia-mcp-server...');
  
  try {
    // Check if already installed
    const listResult = spawnSync('pipx', ['list'], { encoding: 'utf-8', stdio: 'pipe' });
    const isInstalled = listResult.stdout?.includes('nia-mcp-server');
    
    if (isInstalled) {
      // Upgrade existing installation
      runCommand('pipx upgrade nia-mcp-server', { silent: true });
      spinner.stop('nia-mcp-server upgraded!');
    } else {
      // Fresh install
      if (runCommand('pipx install nia-mcp-server', { silent: true })) {
        spinner.stop('nia-mcp-server installed!');
      } else {
        spinner.stop('Failed to install nia-mcp-server');
        clack.log.warn('Could not pre-install nia-mcp-server. It will be installed on first run.');
      }
    }
  } catch {
    spinner.stop('nia-mcp-server will be installed on first run');
  }
  
  console.log('');
  clack.log.success(chalk.green('All dependencies ready!'));
  return true;
}

/**
 * Check if dependencies are already satisfied (quick check)
 */
export function dependenciesReady(): boolean {
  if (isMacOS && !checkHomebrew()) return false;
  if (!checkPython()) return false;
  if (!checkPipx()) return false;
  return true;
}
