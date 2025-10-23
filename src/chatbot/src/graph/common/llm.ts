import { ChatOpenAI } from "@langchain/openai";
import config from "../../config.js";
import { HttpsProxyAgent } from "https-proxy-agent";

export const buildLLM = ({ temperature = 0.6, model = config.openai.model || "gpt-4.1" }) => {
  let configuration = {};
  if (config.openai.use_proxy) {
    console.log("build LLM with proxy.", config.openai.http_proxy);
    const httpAgent = new HttpsProxyAgent(config.openai.http_proxy);
    configuration = { ...configuration, httpAgent };
  }
  return new ChatOpenAI({
    temperature,
    apiKey: config.openai.api_key,
    model,
    streaming: true,
    configuration: {
      baseURL: config.openai.base_url,
      ...configuration,
    },
  });
};
