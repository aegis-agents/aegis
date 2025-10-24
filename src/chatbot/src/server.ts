import { AIMessage } from "@langchain/core/messages";
import { closeNatsConnection, getNatsConnection } from "./common/nats.js";
import { superGraph } from "./graph/chatbot-graph.js";
import { startChatbotGrpc, stopChatbotGrpc } from "./common/grpc.js";
import { closeMongoClient } from "./common/mongo.js";
import { v4 as uuidv4 } from "uuid";

(async () => {
  try {
    const nats = await getNatsConnection();
    nats.subscribeNotification(async (userId, data) => {
      try {
        await superGraph.updateState(
          { configurable: { thread_id: userId } },
          {
            messages: [
              new AIMessage({
                content: `
[Notification]: One of the user's auto-fi position has been updated by the auto-fi assistant agent:\n
- update timestamp: ${data.timestamp}
- transaction hash: ${data.transaction_hash} 
- explorer link of transaction: ${data.explorer_uri} 
- instrument info of the position updated:
  * instrument name: ${data.instrument_of_transaction.instrument_type}
  * chain id: ${data.instrument_of_transaction.chain_id}
  * asset (token address): ${data.instrument_of_transaction.asset}
- user's latest positions after updating:
${
  data.user_positions_left?.map(
    (position, index) => `
[position ${index + 1}]
  * instrument name: ${position.position_meta.instrument_type}
  * chain id: ${position.position_meta.chain_id}
  * asset (token address): ${position.position_meta.asset}
  * asset amount: ${position.position_data.asset_amount}
  * asset amount in usd: $${position.position_data.asset_amount_usd}
  * shares: ${position.position_data.shares}
  * pnl in usd: $${position.position_data.pnl_usd}
  * roe in usd: $${position.position_data.roe_usd}
\n`
  ) ?? `The user currently has no positions.`
}
`,
                name: "Notification",
                id: uuidv4(),
              }),
            ],
          }
        );
      } catch (error) {
        console.error("Insert Notification to SuperGraph State Failed: ", error);
      }
    });
  } catch (error) {
    console.error("Subscribe Notification Error: ", error);
  }
})();

(async () => {
  try {
    await startChatbotGrpc();
  } catch (error) {
    console.error("Grpc Server Error: ", error);
  }
})();

process.on("SIGINT", async () => {
  try {
    stopChatbotGrpc();
    await closeNatsConnection();
    await closeMongoClient();
    process.exit();
  } catch (error) {
    console.error("Error on SIGINT:", error);
  }
});
