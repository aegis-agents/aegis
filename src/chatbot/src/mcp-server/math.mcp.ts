import { FastMCP } from "fastmcp";
import z from "zod";

async function main() {
  console.error("Start Test MCP..");
  // const nats = await connect({ servers: config.nats.url, timeout: config.nats.timeout });

  const server = new FastMCP({
    name: "Test MCP",
    version: "1.0.0",
  });

  server.addTool({
    name: "add",
    description: "Add two numbers",
    parameters: z.object({
      a: z.number(),
      b: z.number(),
    }),
    execute: async (args) => {
      return String(args.a + args.b);
    },
  });

  server.addTool({
    name: "multiply",
    description: "multiply two numbers",
    parameters: z.object({
      a: z.number(),
      b: z.number(),
    }),
    execute: async (args) => {
      return String(args.a * args.b);
    },
  });

  // server.on("connect", () => {
  //   console.error("Test MCP connect...");
  // });

  // server.on("disconnect", () => {
  //   console.error("Test MCP disconnect...");
  // });
  server.start({
    transportType: "stdio",
  });
  process.on("SIGINT", async () => {
    console.error("Test MCP Shutting down...");
    // await nats.close();
    process.exit(0);
  });
}

main();
