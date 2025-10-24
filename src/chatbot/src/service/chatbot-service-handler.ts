import { ServerWritableStream } from "@grpc/grpc-js";
import { ChatbotServiceHandlers } from "../proto/chatbot/ChatbotService.js";
import { StreamChatChunk } from "../proto/chatbot/StreamChatChunk.js";
import { StreamChatRequest__Output } from "../proto/chatbot/StreamChatRequest.js";
import { v4 as uuidv4 } from "uuid";
import { superGraph } from "../graph/chatbot-graph.js";
import { insertConversationHistory } from "./conversation-history.js";
import { runEvaluator } from "./evaluator.js";
import { BaseMessage } from "@langchain/core/messages.js";

export const chatbotServiceHandler: ChatbotServiceHandlers = {
  StreamChat: async function (call: ServerWritableStream<StreamChatRequest__Output, StreamChatChunk>): Promise<void> {
    const { userInput, userId, userAction: userActionJson, userDirectRequest: userDirectRequestJson } = call.request;
    const reqId = uuidv4();
    let conversationCard: { type: string; args: any } | null = null;
    let dashboardCards: { type: string; args: any }[] = [];
    let suggestions = [];
    let messages: BaseMessage[] = [];
    let generator = "";
    let userAction;
    let userDirectRequest;
    try {
      userAction = userActionJson ? JSON.parse(userActionJson) : undefined;
      userDirectRequest = userDirectRequestJson ? JSON.parse(userDirectRequestJson) : undefined;
    } catch (error) {}

    try {
      const chunks = await superGraph.stream(
        { userInput, userAction, userDirectRequest },
        {
          streamMode: ["values", "custom"],
          configurable: { thread_id: userId, user_id: userId, req_id: uuidv4() },
        }
      );

      for await (const item of chunks) {
        const [type, chunk] = item;
        if (chunk.generator) {
          generator += chunk.generator;
          call.write({
            generatorChunk: { text: chunk.generator },
          });
        }
        if (chunk.suggester) {
          suggestions = chunk.suggester;
          call.write({
            suggestionsJson: JSON.stringify(suggestions ?? {}),
          });
        }
        if (chunk.reasoning) {
          call.write({
            reasoningChunk: { text: chunk.reasoning },
          });
        }

        if (chunk.conversationCardExtractor) {
          conversationCard = chunk.conversationCardExtractor;
          call.write({
            conversationCardJson: JSON.stringify(conversationCard),
          });
        }
        if (chunk.dashboardCardExtractor) {
          dashboardCards.push(chunk.dashboardCardExtractor);
          call.write({
            dashboardCardsJson: JSON.stringify(dashboardCards ?? []),
          });
        }
        if (type === "values" && chunk.messages) messages = chunk.messages;
      }

      console.log("stream chatbot data end.");
      // call.write({
      //   finalResult: {
      //     conversationCardJson: JSON.stringify(conversationCard),
      //     dashboardCardsJson: JSON.stringify(dashboardCards ?? []),
      //     suggestionsJson: JSON.stringify(suggestions ?? {}),
      //   },
      // });
    } catch (error) {
      if (!call.closed) {
        call.write({
          generatorChunk: { text: "Service error occurred, please try again later." },
        });
      }
      console.error("StreamChat processing error:", error);
    } finally {
      try {
        call.end();
        console.log("stream grpc response end.");
      } catch (e) {
        console.error("call.end error", e);
      }
      runEvaluator({
        reqId,
        userId,
        userInput,
        userAction: userActionJson,
        generator,
        conversationCard,
        dashboardCards,
        suggestions,
        messages,
      });
      // insert to mongodb
      insertConversationHistory({
        userId,
        userInput,
        userAction: userActionJson,
        generator,
        conversationCard,
        dashboardCards,
        suggestions,
      });
    }
  },
};
