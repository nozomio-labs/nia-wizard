import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupLegacyNiaSync,
  type LegacyNiaSyncEnvironment,
} from './legacy-nia-sync.js';

interface MockCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

function commandKey(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

function makeResult(result: Partial<MockCommandResult> & { status: number | null } = { status: 1 }): MockCommandResult {
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function createResponses(
  definitions: Record<string, MockCommandResult | MockCommandResult[]>,
): Map<string, MockCommandResult[]> {
  return new Map(
    Object.entries(definitions).map(([key, value]) => [key, Array.isArray(value) ? value.map(makeResult) : [makeResult(value)]]),
  );
}

function nextResult(
  responses: Map<string, MockCommandResult[]>,
  command: string,
  args: string[],
): MockCommandResult {
  const key = commandKey(command, args);
  const queue = responses.get(key);
  if (!queue || queue.length === 0) {
    return makeResult();
  }

  if (queue.length > 1) {
    return queue.shift() as MockCommandResult;
  }

  return queue[0] as MockCommandResult;
}

function createTestEnvironment(
  homeDir: string,
  definitions: Record<string, MockCommandResult | MockCommandResult[]>,
  existingCommands: string[] = [],
): LegacyNiaSyncEnvironment {
  const responses = createResponses(definitions);

  return {
    homeDir,
    commandExists(command: string): boolean {
      return existingCommands.includes(command);
    },
    run(command: string, args: string[]) {
      return makeResult(nextResult(responses, command, args));
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

function createTempHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nia-sync-test-'));
}

function legacyStatePaths(homeDir: string): { dir: string; config: string } {
  const dir = path.join(homeDir, '.nia-sync');
  return {
    dir,
    config: path.join(dir, 'config.json'),
  };
}

const tempHomes: string[] = [];

afterEach(() => {
  for (const homeDir of tempHomes.splice(0)) {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});

describe('cleanupLegacyNiaSync', () => {
  it('is a no-op when no legacy install is detected', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(homeDir, {});
    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.detected.sources).toEqual([]);
    expect(result.attemptedActions).toEqual([]);
    expect(result.completedActions).toEqual([]);
  });

  it('uninstalls a uv tool install before continuing', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(
      homeDir,
      {
        'uv tool list': [
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
          { status: 0, stdout: '', stderr: '' },
        ],
        'uv tool uninstall nia-sync': { status: 0, stdout: 'Uninstalled nia-sync\n', stderr: '' },
      },
      ['uv'],
    );

    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.detected.packageSources).toEqual(['uv-tool']);
    expect(result.completedActions).toContain('uv tool uninstall nia-sync');
    expect(result.remaining.packageSources).toEqual([]);
  });

  it('uninstalls a python3 pip install before continuing', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(
      homeDir,
      {
        'python3 -m pip --version': { status: 0, stdout: 'pip 25.0\n', stderr: '' },
        'python3 -m pip show nia-sync': [
          { status: 0, stdout: 'Name: nia-sync\n', stderr: '' },
          { status: 1, stdout: '', stderr: '' },
        ],
        'python3 -m pip uninstall -y nia-sync': { status: 0, stdout: 'Successfully uninstalled\n', stderr: '' },
      },
      ['python3'],
    );

    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.detected.packageSources).toEqual(['python3-pip']);
    expect(result.completedActions).toContain('python3 -m pip uninstall -y nia-sync');
    expect(result.remaining.packageSources).toEqual([]);
  });

  it('removes both uv and pip legacy installs when both are present', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(
      homeDir,
      {
        'uv tool list': [
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
          { status: 0, stdout: '', stderr: '' },
        ],
        'uv tool uninstall nia-sync': { status: 0, stdout: 'Removed\n', stderr: '' },
        'python3 -m pip --version': { status: 0, stdout: 'pip 25.0\n', stderr: '' },
        'python3 -m pip show nia-sync': [
          { status: 0, stdout: 'Name: nia-sync\n', stderr: '' },
          { status: 1, stdout: '', stderr: '' },
        ],
        'python3 -m pip uninstall -y nia-sync': { status: 0, stdout: 'Removed\n', stderr: '' },
      },
      ['uv', 'python3'],
    );

    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.detected.packageSources).toEqual(['uv-tool', 'python3-pip']);
    expect(result.completedActions).toContain('uv tool uninstall nia-sync');
    expect(result.completedActions).toContain('python3 -m pip uninstall -y nia-sync');
    expect(result.remaining.packageSources).toEqual([]);
  });

  it('deletes the legacy config file and removes the directory when it becomes empty', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const { dir, config } = legacyStatePaths(homeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config, '{"api_key":"nk_old"}');

    const env = createTestEnvironment(homeDir, {});
    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.completedActions).toContain(`delete ${config}`);
    expect(result.completedActions).toContain(`remove ${dir}`);
    expect(fs.existsSync(config)).toBe(false);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('leaves the legacy directory in place when it still contains other files', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const { dir, config } = legacyStatePaths(homeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(config, '{"api_key":"nk_old"}');
    fs.writeFileSync(path.join(dir, 'extra.txt'), 'keep');

    const env = createTestEnvironment(homeDir, {});
    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(true);
    expect(result.completedActions).toContain(`delete ${config}`);
    expect(result.completedActions).not.toContain(`remove ${dir}`);
    expect(result.notes).toHaveLength(1);
    expect(fs.existsSync(config)).toBe(false);
    expect(fs.existsSync(dir)).toBe(true);
    expect(result.remaining.packageSources).toEqual([]);
  });

  it('fails when uninstall does not remove the detected package', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(
      homeDir,
      {
        'uv tool list': [
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
        ],
        'uv tool uninstall nia-sync': { status: 0, stdout: 'Removed\n', stderr: '' },
      },
      ['uv'],
    );

    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(false);
    expect(result.blockingError).toContain('still installed');
    expect(result.remaining.packageSources).toEqual(['uv-tool']);
  });

  it('fails when an uninstall command exits non-zero', () => {
    const homeDir = createTempHome();
    tempHomes.push(homeDir);

    const env = createTestEnvironment(
      homeDir,
      {
        'uv tool list': [
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
          { status: 0, stdout: 'nia-sync v0.2.3\n', stderr: '' },
        ],
        'uv tool uninstall nia-sync': { status: 1, stdout: '', stderr: 'permission denied' },
      },
      ['uv'],
    );

    const result = cleanupLegacyNiaSync(env);

    expect(result.success).toBe(false);
    expect(result.blockingError).toContain('Failed to uninstall legacy');
    expect(result.completedActions).toEqual([]);
  });
});
