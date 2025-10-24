import { FastMCP } from "fastmcp";
import z from "zod";

async function main() {
  console.error("Start Smart Wallet Monitor MCP..");

  const server = new FastMCP({
    name: "Smart Wallet Monitor MCP",
    version: "1.0.0",
  });

  server.addTool({
    name: "monitor",
    description: "Query the relevant information of the smart wallet by its address. Including owners of smart account (field: owners) and transactions of the smart account (field: txs)",
    parameters: z.object({
      address: z.string().describe("Smart address / The address of smart wallet(smart account)"),
    }),
    execute: async ({ address }) => {
      try {
        const response = await fetch("https://indexer.dev.hyperindex.xyz/566f652/v1/graphql", {
          headers: {
            accept: "application/json, multipart/mixed",
            "cache-control": "no-cache",
            "content-type": "application/json",
          },
          body: `{"query":"{\\n  SmartAccount(where: {id: {_eq: \\"${address.toLowerCase()}\\"}}) {\\n    id\\n    owners\\n    txs{\\n      hash\\n      operator\\n    }\\n  }\\n}\"}`,
          method: "POST",
        });
        if (!response.ok) {
          return "null";
        }

        const json = await response.json();
        const { data } = json as { data: { SmartAccount: any[] } | null };
        if (!(data && data.SmartAccount && data.SmartAccount.length !== 0)) {
          return "null";
        }
        return JSON.stringify(data.SmartAccount[0]);
      } catch (error) {
        return "null";
      }
    },
  });
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
