// test/setup.ts
import { afterAll } from "vitest";
import { closeNatsConnection } from "../src/common/nats.js";
import { bootstrap } from "global-agent";
import { setGlobalDispatcher, ProxyAgent as UndiciProxyAgent } from "undici";

console.log("proxy check.");
process.env.GLOBAL_AGENT_HTTP_PROXY = "http://127.0.0.1:10809";
setGlobalDispatcher(new UndiciProxyAgent("http://127.0.0.1:10809"));
bootstrap();

afterAll(async () => {
  await closeNatsConnection();
});
