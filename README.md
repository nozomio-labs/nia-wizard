# @nia/wizard

CLI wizard to install Nia MCP server to your coding agents (Cursor, Claude, VS Code, etc.)

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
npx @nia/wizard
```

### With API Key

```bash
# Via curl
curl -fsSL https://install.trynia.ai | sh -s -- nk_your_api_key

# Via npx
npx @nia/wizard nk_your_api_key
```

### With API Key

If you already have an API key:

```bash
npx @nia/wizard nk_your_api_key_here
```

### MCP Commands

```bash
# Add Nia MCP server
npx @nia/wizard mcp add

# Add with API key and local mode
npx @nia/wizard mcp add --api-key nk_xxx --local

# Remove Nia MCP server
npx @nia/wizard mcp remove
```

## Options

| Option | Description |
|--------|-------------|
| `--local` | Use local mode (runs on your machine, requires pipx) |
| `--remote` | Use remote mode (connects to Nia cloud) |
| `--debug` | Enable debug logging |
| `--ci` | CI mode (skip prompts, use defaults) |
| `--api-key`, `-k` | Nia API key |

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
- Pass it directly: `npx @nia/wizard nk_xxx`
- Or select "Enter API key manually" when prompted

## Supported Coding Agents

### Full Support (Local + Remote)

| Agent | Config Location |
|-------|-----------------|
| Cursor | `~/.cursor/mcp.json` |
| VS Code | `~/.vscode/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline | `~/.cline/mcp_settings.json` |
| Continue | `~/.continue/config.json` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` |
| Trae | `~/Library/Application Support/Trae/User/mcp.json` |
| Roo Code | `~/.roo-code/mcp.json` |
| Kilo Code | `~/.kilocode/mcp.json` |
| Gemini CLI | `~/.gemini/settings.json` |
| OpenCode | `~/.opencode/config.json` |
| Qodo Gen | `~/.qodo/mcp.json` |
| Qwen Coder | `~/.qwen/settings.json` |
| Visual Studio | `~/.vs/mcp.json` |
| Crush | `~/.crush/config.json` |
| Copilot Agent | `.github/copilot-mcp.json` (per-repo) |
| Copilot CLI | `~/.copilot/mcp-config.json` |
| Factory | CLI: `droid mcp add` |

### Remote Only

| Agent | Notes |
|-------|-------|
| Claude Code | CLI: `claude mcp add` |
| Amp | CLI: `amp mcp add` |
| Vibe | TOML config at `~/.vibe/config.toml` |

### Local Only

| Agent | Config Location |
|-------|-----------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Codex | CLI: `codex mcp add` |
| Zed | `~/.config/zed/settings.json` |
| Augment | VS Code settings |
| JetBrains | `~/.jetbrains/mcp.json` |
| Kiro | `~/.kiro/mcp.json` |
| LM Studio | `~/.lmstudio/mcp.json` |
| Bolt AI | `~/Library/Application Support/BoltAI/mcp.json` |
| Perplexity | `~/Library/Application Support/Perplexity/mcp.json` |
| Warp | `~/.warp/mcp.json` |
| Amazon Q | `~/.aws/amazonq/mcp.json` |

### Manual Setup Required

- **Zencoder** - Configure via UI: Menu → Agent tools → Add custom MCP
- **Rovo Dev** - Configure via CLI: `acli rovodev mcp`

## How It Works

The wizard detects which coding agents are installed on your system and adds the Nia MCP server configuration to each one.

**Local mode** (recommended): Runs the MCP server on your machine using `pipx`. Requires Python and pipx to be installed.

**Remote mode**: Connects directly to Nia's cloud MCP server. No local installation required, but may be less stable.

## License

MIT
