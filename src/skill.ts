import chalk from 'chalk';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import clack from './utils/clack.js';
import { getApiKey } from './utils/clack-utils.js';
import { enableDebug, debug } from './utils/debug.js';
import { storeApiKey } from './utils/api-key.js';

const DEFAULT_SKILL_SOURCE = 'nozomio-labs/nia-skill';
const NON_INTERACTIVE_TIMEOUT_MS = 30000;

interface SkillsCapabilities {
  target: boolean;
  agent: boolean;
  all: boolean;
  globalLong: boolean;
  globalShort: boolean;
  yesLong: boolean;
  yesShort: boolean;
  nonInteractive: boolean;
  ci: boolean;
  json: boolean;
}

export interface SkillAddOptions {
  apiKey?: string;
  source?: string;
  target?: string;
  allAgents?: boolean;
  global?: boolean;
  debug?: boolean;
  yes?: boolean;
  ci?: boolean;
  nonInteractive?: boolean;
  json?: boolean;
  embedded?: boolean;
}

interface SkillInstallResult {
  success: boolean;
  command: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Add Nia skill via `skills` CLI with optional non-interactive execution.
 */
export async function runSkillAdd(options: SkillAddOptions): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  const nonInteractive = Boolean(options.nonInteractive || options.ci);
  const source = options.source || DEFAULT_SKILL_SOURCE;
  const allAgents = Boolean(options.allAgents);

  if (!options.json && !options.embedded) {
    clack.intro(chalk.bgCyan.black(' Nia Skill Installer '));
  }

  if (allAgents && options.target) {
    throw new Error('Use either `--target` or `--all-agents`, not both.');
  }

  if (nonInteractive && !options.apiKey) {
    throw new Error('`--api-key` is required when using `--non-interactive` or `--ci`.');
  }

  if (nonInteractive && options.apiKey && !options.apiKey.startsWith('nk_')) {
    throw new Error('Invalid API key format. Keys should start with `nk_`.');
  }

  const apiKey = nonInteractive ? options.apiKey! : await getApiKey(options.apiKey);
  storeApiKey(apiKey);

  if (!options.json) {
    clack.log.success('API key saved');
    clack.log.info(`Installing skill source: ${source}`);
  }

  const capabilities = detectSkillsCapabilities();
  const installResult = runSkillsInstall({
    source,
    target: options.target,
    allAgents,
    globalInstall: options.global ?? (nonInteractive || allAgents),
    nonInteractive,
    assumeYes: nonInteractive || Boolean(options.yes),
    jsonOutput: Boolean(options.json),
    capabilities,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          success: installResult.success,
          command: installResult.command,
          status: installResult.status,
          signal: installResult.signal,
          timedOut: installResult.timedOut,
          stdout: installResult.stdout,
          stderr: installResult.stderr,
        },
        null,
        2,
      ),
    );
  }

  if (!installResult.success) {
    if (installResult.timedOut) {
      throw new Error(
        'Skills installation timed out in non-interactive mode. ' +
          'Install manually or run without `--non-interactive` to inspect prompts.',
      );
    }

    throw new Error(
      `Skills installation failed (${installResult.status ?? 'no-exit-code'}). ` +
        'Use `--debug` to inspect command behavior.',
    );
  }

  if (!options.json) {
    clack.log.success('Nia skill installed!');
    if (!options.embedded) {
      clack.outro(chalk.green('Done!'));
    }
  }
}

function detectSkillsCapabilities(): SkillsCapabilities {
  const result = spawnSync('npx', ['skills', 'add', '--help'], {
    shell: false,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 8000,
    env: {
      ...process.env,
      CI: '1',
      TERM: 'dumb',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  if (result.status !== 0 || !output.trim()) {
    const fallback: SkillsCapabilities = {
      target: false,
      agent: true,
      all: true,
      globalLong: true,
      globalShort: true,
      yesLong: true,
      yesShort: true,
      nonInteractive: false,
      ci: false,
      json: false,
    };
    debug('skills capabilities fallback', fallback);
    return fallback;
  }

  const capabilities: SkillsCapabilities = {
    target: output.includes('--target'),
    agent: output.includes('--agent'),
    all: output.includes('--all'),
    globalLong: output.includes('--global'),
    globalShort: output.includes(' -g') || output.includes(', -g'),
    yesLong: output.includes('--yes'),
    yesShort: output.includes(' -y') || output.includes(', -y'),
    nonInteractive: output.includes('--non-interactive'),
    ci: output.includes('--ci'),
    json: output.includes('--json'),
  };

  debug('skills capabilities', capabilities);
  return capabilities;
}

function runSkillsInstall(params: {
  source: string;
  target?: string;
  allAgents: boolean;
  globalInstall: boolean;
  nonInteractive: boolean;
  assumeYes: boolean;
  jsonOutput: boolean;
  capabilities: SkillsCapabilities;
}): SkillInstallResult {
  const args = ['skills', 'add', params.source];

  if (params.globalInstall) {
    if (params.capabilities.globalLong) {
      args.push('--global');
    } else if (params.capabilities.globalShort) {
      args.push('-g');
    } else if (params.nonInteractive) {
      throw new Error(
        '`skills add` in this environment does not advertise `--global`/`-g`; cannot enforce deterministic scope.',
      );
    }
  }

  if (params.allAgents) {
    if (params.capabilities.all) {
      args.push('--all');
    } else if (params.capabilities.agent) {
      args.push('--agent', '*');
    } else {
      throw new Error(
        '`skills add` in this environment does not advertise `--all` or `--agent`; cannot target all agents.',
      );
    }
  }

  if (params.target) {
    if (params.capabilities.target) {
      args.push('--target', params.target);
    } else if (params.capabilities.agent) {
      args.push('--agent', params.target);
    } else {
      throw new Error(
        '`skills add` in this environment does not advertise `--target` or `--agent`; cannot enforce target.',
      );
    }
  }

  if (params.assumeYes) {
    if (params.capabilities.yesLong) {
      args.push('--yes');
    } else if (params.capabilities.yesShort) {
      args.push('-y');
    }
  }

  if (params.nonInteractive) {
    if (params.capabilities.nonInteractive) {
      args.push('--non-interactive');
    } else if (params.capabilities.ci) {
      args.push('--ci');
    }
  }

  if (params.jsonOutput && params.capabilities.json) {
    args.push('--json');
  }

  const command = `npx ${args.join(' ')}`;
  debug('running', command);

  const result = spawnSync('npx', args, {
    shell: false,
    stdio: params.nonInteractive ? 'pipe' : 'inherit',
    encoding: params.nonInteractive ? 'utf-8' : undefined,
    timeout: params.nonInteractive ? NON_INTERACTIVE_TIMEOUT_MS : undefined,
    env: {
      ...process.env,
      ...(params.nonInteractive
        ? {
            CI: '1',
            TERM: 'dumb',
            FORCE_COLOR: '0',
            NO_COLOR: '1',
          }
        : {}),
    },
  }) as SpawnSyncReturns<string>;

  const timedOut =
    params.nonInteractive &&
    Boolean(result.error && 'code' in result.error && result.error.code === 'ETIMEDOUT');
  const stdout = params.nonInteractive ? result.stdout || '' : '';
  const stderr = params.nonInteractive ? result.stderr || '' : '';

  if (stdout) {
    debug('skills stdout', stdout);
  }
  if (stderr) {
    debug('skills stderr', stderr);
  }
  if (result.error) {
    debug('skills error', result.error);
  }

  return {
    success: result.status === 0,
    command,
    status: result.status,
    signal: result.signal,
    timedOut,
    stdout,
    stderr,
  };
}
