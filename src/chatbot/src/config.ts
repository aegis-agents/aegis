import fs from "fs";
import toml from "toml";
import path from "path";
import { fileURLToPath } from "url";

export interface Config {
  openai: {
    api_key: string;
    embedding_model_api_key: string;
    base_url: string;
    model: string;
    use_proxy: boolean;
    http_proxy: string;
  };
  tavily: {
    api_key: string;
  };
  server: {
    debug: boolean;
    grpc_port: number;
    grpc_max_workers: number;
  };
  nats: {
    url: string;
    timeout: number;
  };
  mongo: {
    url: string;

    use_proxy: boolean;
    proxy_host: string;
    proxy_port: number;
    rag: { db: string; collection: string; index_name: string };
    history: { db: string; collection: string };
    evaluator: { db: string; collection: string };
  };
  langsmith: {
    LANGSMITH_API_KEY: string;
    LANGSMITH_PROJECT: string;
  };
  tester: {
    base_url: string;
    tester_uid: string;
    tester_sk: string;
    tester_smart_address: string;
    rpc_url: string;
  };

  mcp: McpConfig;
}

export type McpConfig = Record<
  string,
  {
    command: string;
    transport: string;
    args: string[];
  }
>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, "../config.toml");
const raw = fs.readFileSync(configPath, "utf-8");
const config: Config = toml.parse(raw);

process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_API_KEY = config.langsmith.LANGSMITH_API_KEY;
process.env.LANGCHAIN_PROJECT = config.langsmith.LANGSMITH_PROJECT;

export default config;
