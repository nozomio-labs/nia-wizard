import chalk from "chalk";

export interface BuildSuccessOutroOptions {
  installedNiaCliSkill: boolean;
}

const pad = "  ";

function dimBullet(text: string): string {
  return `${pad}${chalk.dim("•")} ${text}`;
}

/**
 * Post-install success: scannable sections — what Nia is, what to do next, example asks, links.
 */
export function buildSuccessOutro(options: BuildSuccessOutroOptions): string {
  const { installedNiaCliSkill } = options;

  const sections = [
    chalk.green.bold("Nia is ready"),
    chalk.dim(
      "Search indexed code, docs, and papers with citations. Vaults keep synthesized wikis; on macOS you can opt in to personal data.",
    ),
    "",
    chalk.cyan.bold("Pick a starting point"),
    dimBullet(
      `${chalk.white("Documentation")} ${chalk.dim("—")} ${chalk.yellow("nia sources index")} ${chalk.dim("the doc root URL, then")} ${chalk.white("semantic search")} ${chalk.dim("with")} ${chalk.yellow("nia search query")} ${chalk.dim("for cited answers across the site.")}`,
    ),
    dimBullet(
      `${chalk.white("Codebase")} ${chalk.dim("—")} ${chalk.yellow("nia repos index")} ${chalk.dim("or")} ${chalk.yellow("nia project init")}${chalk.dim(";")} ${chalk.white("sandbox search")} ${chalk.dim("with")} ${chalk.yellow("nia search query")} ${chalk.dim("— answers grounded in indexed files with citations.")}`,
    ),
    dimBullet(
      `${chalk.white("Research")} ${chalk.dim("— index sources, then")} ${chalk.yellow("nia oracle")} ${chalk.dim("or deep search for multi-step work.")}`,
    ),
    dimBullet(
      `${chalk.white("Notes that last")} ${chalk.dim("—")} ${chalk.yellow("nia vault init")} ${chalk.dim("builds a wiki from your sources.")}`,
    ),
    dimBullet(
      `${chalk.white("This Mac (optional)")} ${chalk.dim("—")} ${chalk.yellow("nia personal status")} ${chalk.dim("then")} ${chalk.yellow("nia personal init")} ${chalk.dim("(sensitive; opt-in).")}`,
    ),
    ...(installedNiaCliSkill
      ? [
          dimBullet(
            `${chalk.white("CLI skill in agents")} ${chalk.dim("—")} ${chalk.yellow("nia skill")} ${chalk.dim("chooses which coding agents get the Nia skill.")}`,
          ),
        ]
      : []),
    "",
    chalk.cyan.bold("Ask your coding agent"),
    `${pad}${chalk.yellow('"Use Nia to find from how to set up oauth with betterauth propertly?"')}`,
    `${pad}${chalk.yellow('"Use Nia to search what are the latest nextjs feature and how to migrate my codebase to it."')}`,
    `${pad}${chalk.yellow('"Use Nia to find where we handle auth in this repo and cite the files."')}`,
    "",
    chalk.cyan.bold("Open in the browser"),
    `${pad}${chalk.dim("Explore")}   ${chalk.cyan("https://app.trynia.ai/explore")}`,
    `${pad}${chalk.dim("App")}       ${chalk.cyan("https://app.trynia.ai")}`,
    "",
    chalk.cyan.bold("Reference"),
    `${pad}${chalk.dim("Docs")}     ${chalk.cyan("https://docs.trynia.ai")}`,
    `${pad}${chalk.dim("API")}      ${chalk.cyan("https://docs.trynia.ai/api-guide")}`,
    `${pad}${chalk.dim("Updates")}  ${chalk.cyan("https://x.com/nozomioai")}`,
  ];

  return sections.join("\n");
}
