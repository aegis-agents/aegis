import { loadPackageDefinition, sendUnaryData, Server, ServerCredentials, ServerUnaryCall, ServerWritableStream } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { ProtoGrpcType } from "../proto/chatbot.js";
import config from "../config.js";
import { chatbotServiceHandler } from "../service/chatbot-service-handler.js";

let server: Server | null = null;
export const startChatbotGrpc = () => {
  return new Promise<void>((resolve, reject) => {
    try {
      const packageDefinition = protoLoader.loadSync("./proto/chatbot.proto");
      const proto = loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
      server = new Server();
      server.addService(proto.chatbot.ChatbotService.service, chatbotServiceHandler);
      const port = `[::]:${config.server.grpc_port}`;
      server.bindAsync(port, ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
          console.error("gRPC server binding error:", err);
          reject();
          return;
        }
        console.log(`gRPC server started on port ${port}`);
        resolve();
      });
    } catch (error) {
      console.error("gRPC server binding error:", error);
      reject();
    }
  });
};

export const stopChatbotGrpc = () => {
  if (!server) {
    console.error("gRPC server shutdown error: No gRPC server found.");
    return;
  }
  server.tryShutdown((err) => {
    if (err) {
      console.error("gRPC server shutdown error:", err);
      return;
    }
    console.log(`gRPC server shutdown.`);
  });
};
