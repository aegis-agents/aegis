import config, { McpConfig } from "../config.js";
import lodash from "lodash";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildMcpConfig = (keys: string[]): McpConfig => {
  const picked = lodash.pick(config.mcp, keys);
  return Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, { ...v, args: [path.resolve(__dirname, v.args[0])] }]));
};

export const getMultiServerMCPClient = (keys: string[]) => {
  return new MultiServerMCPClient({
    mcpServers: buildMcpConfig(keys) as any,
  });
};
