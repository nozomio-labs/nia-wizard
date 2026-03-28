import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function command(name) {
  if (process.platform !== 'win32') {
    return name;
  }

  if (name === 'npm' || name === 'npx' || name === 'pnpm') {
    return `${name}.cmd`;
  }

  if (name === 'bun' || name === 'bunx') {
    return `${name}.exe`;
  }

  return name;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(command(cmd), args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      ...options.env,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function listTarballs(dir) {
  return readdirSync(dir).filter((file) => file.endsWith('.tgz'));
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
  const beforeTarballs = new Set(listTarballs(workspaceDir));

  run('pnpm', ['pack']);

  const newTarballs = listTarballs(workspaceDir).filter((file) => !beforeTarballs.has(file));

  if (newTarballs.length !== 1) {
    throw new Error(`Expected exactly one new tarball in ${workspaceDir}, found ${newTarballs.length}.`);
  }

  const tarballPath = path.join(workspaceDir, newTarballs[0]);
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
