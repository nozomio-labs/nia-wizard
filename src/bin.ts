#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runWizard } from './run.js';
import { runMCPAdd, runMCPRemove } from './mcp.js';
import { runSkillAdd } from './skill.js';
import { printAgentGuide } from './agent-guide.js';
import { track, shutdown } from './utils/analytics.js';

const isInteractive = Boolean(process.stdin.isTTY);

function printCliError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    return;
  }

  console.error('Error:', error);
}

const cli = yargs(hideBin(process.argv))
  .scriptName('nia-wizard')
  .usage('$0 [api-key] [options]')
  .usage('$0 mcp add [options]')
  .usage('$0 mcp remove [options]')
  .usage('$0 skill add [options]')
  .usage('$0 agent-guide')
  .command(
    '$0 [api-key]',
    'Install Nia to your coding agents',
    (yargs) =>
      yargs
        .positional('api-key', {
          type: 'string',
          description: 'Nia API key (nk_xxx)',
        })
        .option('local', {
          type: 'boolean',
          description: 'Use local mode (requires pipx)',
        })
        .option('remote', {
          type: 'boolean',
          description: 'Use remote mode (cloud)',
        })
        .option('debug', {
          type: 'boolean',
          default: false,
          description: 'Enable debug logging',
        })
        .option('ci', {
          type: 'boolean',
          default: false,
          description: 'CI mode (skip prompts)',
        }),
    async (argv) => {
      const ci = argv.ci || !isInteractive;
      if (!isInteractive && !argv.ci) {
        console.log('Non-interactive terminal detected, running in CI mode.');
        console.log('For the full interactive experience, run: npx nia-wizard\n');
      }
      try {
        await runWizard({
          apiKey: argv['api-key'],
          local: argv.local ?? (argv.remote ? false : undefined),
          debug: argv.debug,
          ci,
        });
      } catch (error) {
        track('cli_wizard_error', { error_type: 'wizard', error_message: error instanceof Error ? error.message : String(error) });
        await shutdown();
        printCliError(error);
        process.exit(1);
      }
    },
  )
  .command(
    'agent-guide',
    'Print API-first agent onboarding guide in Markdown',
    () => {},
    () => {
      printAgentGuide();
    },
  )
  .command(
    'skill <command>',
    'Manage skill installation',
    (yargs) =>
      yargs
        .command(
          'add',
          'Add Nia skill',
          (yargs) =>
            yargs
              .option('api-key', {
                type: 'string',
                alias: 'k',
                description: 'Nia API key (nk_xxx)',
              })
              .option('source', {
                type: 'string',
                default: 'nozomio-labs/nia-skill',
                description: 'Skill source to install',
              })
              .option('target', {
                type: 'string',
                description: 'Target coding agent for skill installation',
              })
              .option('all-agents', {
                type: 'boolean',
                default: false,
                description: 'Install to all detected agents (non-interactive)',
              })
              .option('global', {
                type: 'boolean',
                description: 'Install to global user skills directories',
              })
              .option('yes', {
                type: 'boolean',
                default: false,
                description: 'Auto-confirm prompts when supported by the skills CLI',
              })
              .option('non-interactive', {
                type: 'boolean',
                default: false,
                description: 'Fail fast instead of waiting for prompts',
              })
              .option('json', {
                type: 'boolean',
                default: false,
                description: 'Print machine-readable install result',
              })
              .option('debug', {
                type: 'boolean',
                default: false,
                description: 'Enable debug logging',
              })
              .option('ci', {
                type: 'boolean',
                default: false,
                description: 'CI mode (implies non-interactive behavior)',
              }),
          async (argv) => {
            try {
              await runSkillAdd({
                apiKey: argv['api-key'],
                source: argv.source,
                target: argv.target,
                allAgents: argv['all-agents'],
                global: argv.global,
                yes: argv.yes,
                nonInteractive: argv['non-interactive'],
                json: argv.json,
                debug: argv.debug,
                ci: argv.ci,
              });
            } catch (error) {
              printCliError(error);
              process.exit(1);
            }
          },
        )
        .demandCommand(1, 'You need to specify a command (add)'),
    () => {},
  )
  .command(
    'mcp <command>',
    'Manage direct agent setup',
    (yargs) =>
      yargs
        .command(
          'add',
          'Add Nia to coding agents',
          (yargs) =>
            yargs
              .option('api-key', {
                type: 'string',
                alias: 'k',
                description: 'Nia API key (nk_xxx)',
              })
              .option('local', {
                type: 'boolean',
                description: 'Use local mode',
              })
              .option('remote', {
                type: 'boolean',
                description: 'Use remote mode',
              })
              .option('debug', {
                type: 'boolean',
                default: false,
                description: 'Enable debug logging',
              })
              .option('ci', {
                type: 'boolean',
                default: false,
                description: 'CI mode (skip prompts)',
              }),
          async (argv) => {
            try {
              await runMCPAdd({
                apiKey: argv['api-key'],
                local: argv.local ?? (argv.remote ? false : undefined),
                debug: argv.debug,
                ci: argv.ci,
              });
            } catch (error) {
              printCliError(error);
              process.exit(1);
            }
          },
        )
        .command(
          'remove',
          'Remove Nia from coding agents',
          (yargs) =>
            yargs.option('debug', {
              type: 'boolean',
              default: false,
              description: 'Enable debug logging',
            }),
          async (argv) => {
            try {
              await runMCPRemove({ debug: argv.debug });
            } catch (error) {
              printCliError(error);
              process.exit(1);
            }
          },
        )
        .demandCommand(1, 'You need to specify a command (add or remove)'),
    () => {},
  )
  .help()
  .version()
  .strict();

cli.parse();
