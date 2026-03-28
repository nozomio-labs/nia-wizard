# nia-wizard

CLI wizard to install Nia to your coding agents via Nia CLI, Skills, or direct agent setup.

## Installation

### One-liner (Recommended)

```bash
curl -fsSL https://app.trynia.ai/cli | sh
```

This will:

1. Install Node.js if needed
2. Run the wizard which:
   - Opens your browser for authentication
   - Installs dependencies (pipx, etc.) for local mode
   - Configures your coding agents

### With npx (if you have Node.js)

```bash
npx nia-wizard
```

Press Enter to continue with the recommended default setup, which signs you in and installs or updates `nia-cli` to the latest version, or use the arrow keys to choose advanced or manual setup.

Print the agent-specific onboarding prompt:

```bash
npx nia-wizard --agent
```

### With API Key

```bash
# Via curl
curl -fsSL https://install.trynia.ai | sh -s -- nk_your_api_key

# Via npx
npx nia-wizard nk_your_api_key
```

### With API Key

If you already have an API key:

```bash
npx nia-wizard nk_your_api_key_here
```

### MCP Commands

```bash
# Add Nia MCP server
npx nia-wizard mcp add

# Add with API key and local mode
npx nia-wizard mcp add --api-key nk_xxx --local

# Remove Nia MCP server
npx nia-wizard mcp remove
```

### Skills Installation

The wizard also supports installing Nia as a skill via the skills CLI:

```bash
npx nia-wizard
# Then select "Install Nia Skill"
```

The wizard stores your API key at `~/.config/nia/api_key`.

- Select `Install Nia CLI (recommended)` to auto-install or update `@nozomioai/nia` to the latest version, run `nia auth login --api-key ...`, and then run `nia skill`.
- Select `Install Nia Skill` to use the existing `skills` CLI flow.
- Select `Install via add-mcp` for a quick install to supported agents.

For deterministic agent/CI usage:

```bash
npx nia-wizard skill add \
  --api-key nk_xxx \
  --source nozomio-labs/nia-skill \
  --non-interactive \
  --ci
```

Install globally for all detected agents:

```bash
npx nia-wizard skill add \
  --api-key nk_xxx \
  --all-agents \
  --non-interactive \
  --ci
```

Optional target-specific installation:

```bash
npx nia-wizard skill add \
  --api-key nk_xxx \
  --target codex \
  --non-interactive \
  --ci
```

Print the agent-facing onboarding prompt:

```bash
npx nia-wizard --agent
```

## Options

| Option              | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `--local`           | Use local mode (runs on your machine, requires pipx)           |
| `--remote`          | Use remote mode (connects to Nia cloud)                        |
| `--debug`           | Enable debug logging                                           |
| `--ci`              | CI mode (skip prompts, use defaults)                           |
| `--agent`           | Print agent-facing Nia CLI onboarding prompt (root command)   |
| `--api-key`, `-k`   | Nia API key                                                    |
| `--non-interactive` | Fail fast instead of waiting for prompts (skill command)       |
| `--target`          | Target coding agent for skill installation (skill command)     |
| `--all-agents`      | Install to all detected agents in global scope (skill command) |
| `--global`          | Install to global user skills directories (skill command)      |
| `--source`          | Skill source path/repo (skill command)                         |
| `--json`            | Print machine-readable result (skill command)                  |

## Authentication

The wizard supports two authentication methods:

### 1. Browser Sign-in (Recommended)

When you run the wizard without an API key, it will:

1. Connect to Nia servers
2. Display an authorization code (e.g., `ABCD-EFGH`)
3. Open your browser to sign in
4. Automatically retrieve your API key once authenticated

This is the fastest way to get started - no manual copying required!

### 2. Manual API Key Entry

If you prefer, you can:

- Get your API key from [app.trynia.ai](https://app.trynia.ai)
- Pass it directly: `npx nia-wizard nk_xxx`
- Or select "Enter API key manually" when prompted

## Agent Onboarding Prompt

Use the root `--agent` flag when you want an external coding agent to perform the Nia CLI setup steps on the user's machine instead of launching the local interactive wizard.

```bash
npx nia-wizard --agent
```

This prints the canonical agent workflow:

1. Run `bun --version`
2. Install `@nozomioai/nia@latest` globally with Bun or npm
3. Tell the user to open `https://app.trynia.ai`
4. Tell the user to go to `Settings -> API Keys` and create an API key
5. Ask the user to paste the `nk_...` key back to the agent
6. Run `nia auth login --api-key <nk_api_key>`
7. Run `nia skill --all`

This is a prompt-only flow intended for external agents. The user retrieves the API key manually and sends it back to the agent to finish setup.

## Supported Coding Agents

### Full Support (Local + Remote)

| Agent         | Config Location                                    |
| ------------- | -------------------------------------------------- |
| Cursor        | `~/.cursor/mcp.json`                               |
| VS Code       | `~/.vscode/mcp.json`                               |
| Windsurf      | `~/.codeium/windsurf/mcp_config.json`              |
| Cline         | `~/.cline/mcp_settings.json`                       |
| Continue      | `~/.continue/config.json`                          |
| Antigravity   | `~/.gemini/antigravity/mcp_config.json`            |
| Trae          | `~/Library/Application Support/Trae/User/mcp.json` |
| Roo Code      | `~/.roo-code/mcp.json`                             |
| Kilo Code     | `~/.kilocode/mcp.json`                             |
| Gemini CLI    | `~/.gemini/settings.json`                          |
| OpenCode      | `~/.opencode/config.json`                          |
| Qodo Gen      | `~/.qodo/mcp.json`                                 |
| Qwen Coder    | `~/.qwen/settings.json`                            |
| Visual Studio | `~/.vs/mcp.json`                                   |
| Crush         | `~/.crush/config.json`                             |
| Copilot Agent | `.github/copilot-mcp.json` (per-repo)              |
| Copilot CLI   | `~/.copilot/mcp-config.json`                       |
| Factory       | CLI: `droid mcp add`                               |

### Remote Only

| Agent       | Notes                                |
| ----------- | ------------------------------------ |
| Claude Code | CLI: `claude mcp add`                |
| Amp         | CLI: `amp mcp add`                   |
| Vibe        | TOML config at `~/.vibe/config.toml` |

### Local Only

| Agent          | Config Location                                                   |
| -------------- | ----------------------------------------------------------------- |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Codex CLI      | CLI: `codex mcp add`                                              |
| Codex App      | `~/.codex/config.toml`                                            |
| Zed            | `~/.config/zed/settings.json`                                     |
| Augment        | VS Code settings                                                  |
| JetBrains      | `~/.jetbrains/mcp.json`                                           |
| Kiro           | `~/.kiro/mcp.json`                                                |
| LM Studio      | `~/.lmstudio/mcp.json`                                            |
| Bolt AI        | `~/Library/Application Support/BoltAI/mcp.json`                   |
| Perplexity     | `~/Library/Application Support/Perplexity/mcp.json`               |
| Warp           | `~/.warp/mcp.json`                                                |
| Amazon Q       | `~/.aws/amazonq/mcp.json`                                         |

### Manual Setup Required

- **Zencoder** - Configure via UI: Menu → Agent tools → Add custom MCP
- **Rovo Dev** - Configure via CLI: `acli rovodev mcp`

## How It Works

The wizard detects which coding agents are installed on your system and adds the Nia MCP server configuration to each one.

**Local mode** (recommended): Runs the MCP server on your machine using `pipx`. Requires Python and pipx to be installed.

**Remote mode**: Connects directly to Nia's cloud MCP server. No local installation required, but may be less stable.

## License

MIT
