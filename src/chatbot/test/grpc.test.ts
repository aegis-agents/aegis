import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startChatbotGrpc, stopChatbotGrpc } from "../src/common/grpc";
import { ChatbotServiceClient } from "../src/proto/chatbot/ChatbotService";
import type { StreamChatRequest } from "../src/proto/chatbot/StreamChatRequest";
import * as protoLoader from "@grpc/proto-loader";
import * as grpc from "@grpc/grpc-js";
import { StreamChatChunk__Output } from "../src/proto/chatbot/StreamChatChunk";
import { ProtoGrpcType } from "../src/proto/chatbot";
import config from "../src/config";
import { v4 as uuidv4 } from "uuid";
import { UserActionType, UserDirectRequestType } from "../src/types/state";

const uuid = uuidv4();
let client: ChatbotServiceClient;

beforeAll(async () => {
  await startChatbotGrpc();
  const packageDefinition = protoLoader.loadSync("./proto/chatbot.proto");
  const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
  const uri = `localhost:${config.server.grpc_port}`;
  client = new proto.chatbot.ChatbotService(uri, grpc.credentials.createInsecure());
});

afterAll(() => {
  stopChatbotGrpc();
});

it("should stream chunks from server", { timeout: 120000 }, async () => {
  const userActionJson = JSON.stringify({
    type: UserActionType.ChangeStrategy,
    args: ["1", false],
  });

  const userDirectRequestJson = JSON.stringify({
    type: UserDirectRequestType.Deposit,
    args: [],
  });
  // const req: StreamChatRequest = {
  //   userInput: "",
  //   userId: "4ec7548e-8350-11f0-97fd-568853cfc906",
  //   userAction: "",
  //   userDirectRequest: userDirectRequestJson,
  // };
  // const req: StreamChatRequest = {
  //   userInput: "",
  //   userId: "4ec7548e-8350-11f0-97fd-568853cfc906",
  //   userAction: userActionJson,
  // };
  const req: StreamChatRequest = {
    userInput: "check the owners of my smart account.",
    userId: "4ec7548e-8350-11f0-97fd-568853cfc906",
    userAction: "",
  };
  const received: StreamChatChunk__Output[] = [];

  await new Promise<void>((resolve, reject) => {
    const call = client.StreamChat(req);
    call.on("data", (chunk: StreamChatChunk__Output) => {
      console.log("gRPC stream data:", JSON.stringify(chunk));
      received.push(chunk);
    });
    call.on("end", () => {
      // console.log("gRPC received data:", JSON.stringify(received, null, 2));
      console.log("gRPC client stream data: done.");
      setTimeout(() => resolve(), 15000);
    });
    call.on("error", reject);
  });
});
