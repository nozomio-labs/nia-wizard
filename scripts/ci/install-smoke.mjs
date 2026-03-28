import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
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

function createTempProject(prefix) {
  const projectDir = mkdtempSync(path.join(os.tmpdir(), prefix));

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

function getPackedTarball() {
  const packDir = mkdtempSync(path.join(os.tmpdir(), 'nia-wizard-pack-'));

  run('pnpm', ['pack', '--pack-destination', packDir]);

  const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));

  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one tarball in ${packDir}, found ${tarballs.length}.`);
  }

  return {
    packDir,
    tarballPath: path.join(packDir, tarballs[0]),
  };
}

function smokeWithNpm(tarballPath) {
  const projectDir = createTempProject('nia-wizard-npm-');

  console.log(`\n==> npm/npx smoke test in ${projectDir}`);

  run('npm', ['install', tarballPath], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', '--version'], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', '--help'], { cwd: projectDir });
  run('npx', ['--no-install', 'nia-wizard', 'agent-guide'], { cwd: projectDir });

  return projectDir;
}

function smokeWithBun(tarballPath) {
  const projectDir = createTempProject('nia-wizard-bun-');

  console.log(`\n==> Bun/bunx smoke test in ${projectDir}`);

  run('bun', ['add', tarballPath], { cwd: projectDir });
  run('bunx', ['nia-wizard', '--version'], { cwd: projectDir });
  run('bunx', ['nia-wizard', '--help'], { cwd: projectDir });
  run('bunx', ['nia-wizard', 'agent-guide'], { cwd: projectDir });

  return projectDir;
}

const cleanupPaths = [];

try {
  const { packDir, tarballPath } = getPackedTarball();
  cleanupPaths.push(packDir);

  cleanupPaths.push(smokeWithNpm(tarballPath));
  cleanupPaths.push(smokeWithBun(tarballPath));

  console.log('\nAll CLI install smoke tests passed.');
} finally {
  for (const cleanupPath of cleanupPaths.reverse()) {
    rmSync(cleanupPath, { recursive: true, force: true });
  }
}
