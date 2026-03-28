import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function commandSpec(name) {
  if (process.platform !== 'win32') {
    return { file: name, shell: false };
  }

  if (name === 'npm' || name === 'npx' || name === 'pnpm') {
    return { file: name, shell: true };
  }

  if (name === 'bun' || name === 'bunx') {
    return { file: `${name}.exe`, shell: false };
  }

  return { file: name, shell: false };
}

function run(cmd, args, options = {}) {
  const { file, shell } = commandSpec(cmd);
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell,
    windowsHide: true,
    env: {
      ...process.env,
      CI: 'true',
      ...options.env,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      details
        ? `Command failed: ${cmd} ${args.join(' ')}\n${details}`
        : `Command failed: ${cmd} ${args.join(' ')}`,
    );
  }

  return result;
}

function registerTempDir(prefix, cleanupPaths, parentDir = process.cwd()) {
  const dir = mkdtempSync(path.join(parentDir, prefix));
  cleanupPaths.push(dir);
  return dir;
}

function createTempProject(prefix, cleanupPaths, tempRoot) {
  const projectDir = registerTempDir(prefix, cleanupPaths, tempRoot);

  writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: `${prefix.replace(/[^a-z0-9-]/gi, '-')}-smoke`,
        private: true,
      },
      null,
      2,
    ),
  );

  return projectDir;
}

function getPackedTarball(cleanupPaths) {
  const workspaceDir = process.cwd();
  const result = run('npm', ['pack', '--json'], { capture: true });
  const parsed = JSON.parse(result.stdout);

  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== 'string') {
    throw new Error(`Unexpected npm pack output: ${result.stdout}`);
  }

  const tarballPath = path.join(workspaceDir, parsed[0].filename);
  cleanupPaths.push(tarballPath);

  return { tarballPath };
}

function smokeWithNpm(tarballPath, cleanupPaths, tempRoot) {
  const projectDir = createTempProject('nia-wizard-npm-', cleanupPaths, tempRoot);

  console.log(`\n==> npm/npx smoke test in ${projectDir}`);

  run('npm', ['install', tarballPath], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', '--version'], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', '--help'], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', 'agent-guide'], { cwd: projectDir });

}

function smokeWithBun(tarballPath, cleanupPaths, tempRoot) {
  const projectDir = createTempProject('nia-wizard-bun-', cleanupPaths, tempRoot);

  console.log(`\n==> Bun/bunx smoke test in ${projectDir}`);

  run('bun', ['add', tarballPath], { cwd: projectDir });
  run('bunx', ['nia-wizard', '--version'], { cwd: projectDir });
  run('bunx', ['nia-wizard', '--help'], { cwd: projectDir });
  run('bunx', ['nia-wizard', 'agent-guide'], { cwd: projectDir });

}

const cleanupPaths = [];

try {
  const tempRoot = registerTempDir('.nia-wizard-smoke-', cleanupPaths);
  const { tarballPath } = getPackedTarball(cleanupPaths);

  smokeWithNpm(tarballPath, cleanupPaths, tempRoot);
  smokeWithBun(tarballPath, cleanupPaths, tempRoot);

  console.log('\nAll CLI install smoke tests passed.');
} finally {
  for (const cleanupPath of cleanupPaths.reverse()) {
    rmSync(cleanupPath, { recursive: true, force: true });
  }
}
