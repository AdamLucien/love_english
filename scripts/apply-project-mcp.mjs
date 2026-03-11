import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function deepMergeMcpServers(base, overlay) {
  const out = { ...base };
  out.mcpServers = { ...(base.mcpServers || {}) };
  for (const [name, cfg] of Object.entries(overlay.mcpServers || {})) {
    out.mcpServers[name] = cfg;
  }
  return out;
}

const repoRoot = process.cwd();
const projectCfgPath = path.join(repoRoot, "mcp-project", "mcp.project.json");
const globalCfgPath = path.join(os.homedir(), ".cursor", "mcp.json");

if (!fs.existsSync(projectCfgPath)) {
  console.error(`Missing ${projectCfgPath}`);
  process.exit(1);
}

const projectCfg = readJson(projectCfgPath);
const globalCfg = fs.existsSync(globalCfgPath) ? readJson(globalCfgPath) : { mcpServers: {} };

const merged = deepMergeMcpServers(globalCfg, projectCfg);
writeJson(globalCfgPath, merged);

console.log(`Updated ${globalCfgPath} with ${Object.keys(projectCfg.mcpServers || {}).length} project server(s).`);

