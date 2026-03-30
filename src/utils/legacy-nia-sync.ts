import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { debug } from './debug.js';

export type LegacyInstallSource = 'uv-tool' | 'python3-pip' | 'python-pip' | 'pip' | 'legacy-state';

type PackageInstallSource = Exclude<LegacyInstallSource, 'legacy-state'>;

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface LegacyNiaSyncDetection {
  sources: LegacyInstallSource[];
  packageSources: PackageInstallSource[];
  hasLegacyState: boolean;
  stateDirPath: string;
  stateConfigPath: string;
  stateDirExists: boolean;
  stateConfigExists: boolean;
  stateDirEmpty: boolean | null;
  diagnostics: {
    uvToolAvailable: boolean;
    python3PipAvailable: boolean;
    pythonPipAvailable: boolean;
    pipAvailable: boolean;
  };
}

export interface LegacyNiaSyncCleanupResult {
  detected: LegacyNiaSyncDetection;
  remaining: LegacyNiaSyncDetection;
  attemptedActions: string[];
  completedActions: string[];
  notes: string[];
  success: boolean;
  blockingError?: string;
}

export interface LegacyNiaSyncEnvironment {
  homeDir: string;
  commandExists(command: string): boolean;
  run(command: string, args: string[]): CommandResult;
  pathExists(targetPath: string): boolean;
  readDir(targetPath: string): string[];
  unlink(targetPath: string): void;
  removeDir(targetPath: string): void;
}

const LEGACY_PACKAGE_NAME = 'nia-sync';
const LEGACY_STATE_DIRNAME = '.nia-sync';
const LEGACY_STATE_CONFIG = 'config.json';

const UV_TOOL_SOURCE: PackageInstallSource = 'uv-tool';
const PYTHON3_PIP_SOURCE: PackageInstallSource = 'python3-pip';
const PYTHON_PIP_SOURCE: PackageInstallSource = 'python-pip';
const PIP_SOURCE: PackageInstallSource = 'pip';

function defaultEnvironment(): LegacyNiaSyncEnvironment {
  return {
    homeDir: os.homedir(),
    commandExists(command: string): boolean {
      const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
      const result = spawnSync(lookupCommand, [command], {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return result.status === 0;
    },
    run(command: string, args: string[]): CommandResult {
      const result = spawnSync(command, args, {
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: process.platform === 'win32',
      });

      return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        error: result.error?.message,
      };
    },
    pathExists(targetPath: string): boolean {
      return fs.existsSync(targetPath);
    },
    readDir(targetPath: string): string[] {
      return fs.readdirSync(targetPath);
    },
    unlink(targetPath: string): void {
      fs.unlinkSync(targetPath);
    },
    removeDir(targetPath: string): void {
      fs.rmdirSync(targetPath);
    },
  };
}

function getLegacyStatePaths(homeDir: string): { stateDirPath: string; stateConfigPath: string } {
  const stateDirPath = path.join(homeDir, LEGACY_STATE_DIRNAME);
  return {
    stateDirPath,
    stateConfigPath: path.join(stateDirPath, LEGACY_STATE_CONFIG),
  };
}

function hasDetectedPackage(commandResult: CommandResult, packageName: string): boolean {
  if (commandResult.status !== 0) {
    return false;
  }

  return new RegExp(`\\b${packageName}\\b`, 'i').test(commandResult.stdout);
}

function hasPipModule(env: LegacyNiaSyncEnvironment, command: 'python3' | 'python'): boolean {
  if (!env.commandExists(command)) {
    return false;
  }

  return env.run(command, ['-m', 'pip', '--version']).status === 0;
}

function detectPackageSources(env: LegacyNiaSyncEnvironment): {
  packageSources: PackageInstallSource[];
  diagnostics: LegacyNiaSyncDetection['diagnostics'];
} {
  const packageSources: PackageInstallSource[] = [];

  const uvToolAvailable = env.commandExists('uv');
  if (uvToolAvailable) {
    const result = env.run('uv', ['tool', 'list']);
    if (hasDetectedPackage(result, LEGACY_PACKAGE_NAME)) {
      packageSources.push(UV_TOOL_SOURCE);
    }
  }

  const python3PipAvailable = hasPipModule(env, 'python3');
  if (python3PipAvailable) {
    const result = env.run('python3', ['-m', 'pip', 'show', LEGACY_PACKAGE_NAME]);
    if (result.status === 0) {
      packageSources.push(PYTHON3_PIP_SOURCE);
    }
  }

  const pythonPipAvailable = hasPipModule(env, 'python');
  if (pythonPipAvailable) {
    const result = env.run('python', ['-m', 'pip', 'show', LEGACY_PACKAGE_NAME]);
    if (result.status === 0) {
      packageSources.push(PYTHON_PIP_SOURCE);
    }
  }

  const pipAvailable = env.commandExists('pip');
  if (pipAvailable) {
    const result = env.run('pip', ['show', LEGACY_PACKAGE_NAME]);
    if (result.status === 0) {
      packageSources.push(PIP_SOURCE);
    }
  }

  return {
    packageSources,
    diagnostics: {
      uvToolAvailable,
      python3PipAvailable,
      pythonPipAvailable,
      pipAvailable,
    },
  };
}

function getUninstallCommand(source: PackageInstallSource): { command: string; args: string[] } {
  switch (source) {
    case UV_TOOL_SOURCE:
      return { command: 'uv', args: ['tool', 'uninstall', LEGACY_PACKAGE_NAME] };
    case PYTHON3_PIP_SOURCE:
      return { command: 'python3', args: ['-m', 'pip', 'uninstall', '-y', LEGACY_PACKAGE_NAME] };
    case PYTHON_PIP_SOURCE:
      return { command: 'python', args: ['-m', 'pip', 'uninstall', '-y', LEGACY_PACKAGE_NAME] };
    case PIP_SOURCE:
      return { command: 'pip', args: ['uninstall', '-y', LEGACY_PACKAGE_NAME] };
  }

  throw new Error(`Unsupported legacy install source: ${source}`);
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

export function detectLegacyNiaSync(env: LegacyNiaSyncEnvironment = defaultEnvironment()): LegacyNiaSyncDetection {
  const { stateDirPath, stateConfigPath } = getLegacyStatePaths(env.homeDir);
  const { packageSources, diagnostics } = detectPackageSources(env);

  const stateDirExists = env.pathExists(stateDirPath);
  const stateConfigExists = env.pathExists(stateConfigPath);
  const stateDirEmpty = stateDirExists ? env.readDir(stateDirPath).length === 0 : null;
  const hasLegacyState = stateDirExists || stateConfigExists;

  const sources: LegacyInstallSource[] = [...packageSources];
  if (hasLegacyState) {
    sources.push('legacy-state');
  }

  return {
    sources,
    packageSources,
    hasLegacyState,
    stateDirPath,
    stateConfigPath,
    stateDirExists,
    stateConfigExists,
    stateDirEmpty,
    diagnostics,
  };
}

export function cleanupLegacyNiaSync(
  env: LegacyNiaSyncEnvironment = defaultEnvironment(),
): LegacyNiaSyncCleanupResult {
  const detected = detectLegacyNiaSync(env);
  const attemptedActions: string[] = [];
  const completedActions: string[] = [];
  const notes: string[] = [];

  if (detected.sources.length === 0) {
    return {
      detected,
      remaining: detected,
      attemptedActions,
      completedActions,
      notes,
      success: true,
    };
  }

  for (const source of detected.packageSources) {
    const { command, args } = getUninstallCommand(source);
    const formattedCommand = formatCommand(command, args);
    attemptedActions.push(formattedCommand);

    const result = env.run(command, args);
    debug(`Legacy nia-sync uninstall via ${source}:`, result.status, result.stdout, result.stderr);

    if (result.status !== 0) {
      const remaining = detectLegacyNiaSync(env);
      return {
        detected,
        remaining,
        attemptedActions,
        completedActions,
        notes,
        success: false,
        blockingError: `Failed to uninstall legacy \`${LEGACY_PACKAGE_NAME}\` via \`${formattedCommand}\`.`,
      };
    }

    completedActions.push(formattedCommand);
  }

  if (detected.stateConfigExists && env.pathExists(detected.stateConfigPath)) {
    const action = `delete ${detected.stateConfigPath}`;
    attemptedActions.push(action);

    try {
      env.unlink(detected.stateConfigPath);
      completedActions.push(action);
    } catch (error) {
      const remaining = detectLegacyNiaSync(env);
      return {
        detected,
        remaining,
        attemptedActions,
        completedActions,
        notes,
        success: false,
        blockingError: `Failed to remove legacy config at \`${detected.stateConfigPath}\`.`,
      };
    }
  }

  if (detected.stateDirExists && env.pathExists(detected.stateDirPath)) {
    const remainingEntries = env.readDir(detected.stateDirPath);
    if (remainingEntries.length === 0) {
      const action = `remove ${detected.stateDirPath}`;
      attemptedActions.push(action);

      try {
        env.removeDir(detected.stateDirPath);
        completedActions.push(action);
      } catch {
        const remaining = detectLegacyNiaSync(env);
        return {
          detected,
          remaining,
          attemptedActions,
          completedActions,
          notes,
          success: false,
          blockingError: `Failed to remove empty legacy state directory \`${detected.stateDirPath}\`.`,
        };
      }
    } else {
      notes.push(
        `Left legacy state directory in place because it still contains files: ${detected.stateDirPath}`,
      );
    }
  }

  const remaining = detectLegacyNiaSync(env);
  if (remaining.packageSources.length > 0) {
    return {
      detected,
      remaining,
      attemptedActions,
      completedActions,
      notes,
      success: false,
      blockingError: `Legacy \`${LEGACY_PACKAGE_NAME}\` is still installed after cleanup.`,
    };
  }

  return {
    detected,
    remaining,
    attemptedActions,
    completedActions,
    notes,
    success: true,
  };
}
