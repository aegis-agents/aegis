import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { ChatbotServiceClient as _chatbot_ChatbotServiceClient, ChatbotServiceDefinition as _chatbot_ChatbotServiceDefinition } from './chatbot/ChatbotService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  chatbot: {
    ChatbotService: SubtypeConstructor<typeof grpc.Client, _chatbot_ChatbotServiceClient> & { service: _chatbot_ChatbotServiceDefinition }
    GeneratorChunk: MessageTypeDefinition
    ReasoningChunk: MessageTypeDefinition
    StreamChatChunk: MessageTypeDefinition
    StreamChatRequest: MessageTypeDefinition
  }
}

