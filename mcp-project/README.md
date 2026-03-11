# Per-project MCP setup

Cursor reads MCP servers from:

- `~/.cursor/mcp.json` (global)

This folder lets you keep **project-specific** server overrides in the repo, then apply them to the global file.

## What to edit

- `mcp.project.json`: project-specific MCP servers (paths, db files, etc.)
- `mcp.project.env.example`: template for your per-project secrets (copy to `mcp.project.env` for your own reference)

## Apply to Cursor (global)

From the repo root:

```bash
node scripts/apply-project-mcp.mjs
```

Then reload/restart Cursor to pick up the change.

