// Original file: proto/chatbot.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { StreamChatChunk as _chatbot_StreamChatChunk, StreamChatChunk__Output as _chatbot_StreamChatChunk__Output } from '../chatbot/StreamChatChunk';
import type { StreamChatRequest as _chatbot_StreamChatRequest, StreamChatRequest__Output as _chatbot_StreamChatRequest__Output } from '../chatbot/StreamChatRequest';

export interface ChatbotServiceClient extends grpc.Client {
  StreamChat(argument: _chatbot_StreamChatRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_chatbot_StreamChatChunk__Output>;
  StreamChat(argument: _chatbot_StreamChatRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_chatbot_StreamChatChunk__Output>;
  streamChat(argument: _chatbot_StreamChatRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_chatbot_StreamChatChunk__Output>;
  streamChat(argument: _chatbot_StreamChatRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_chatbot_StreamChatChunk__Output>;
  
}

export interface ChatbotServiceHandlers extends grpc.UntypedServiceImplementation {
  StreamChat: grpc.handleServerStreamingCall<_chatbot_StreamChatRequest__Output, _chatbot_StreamChatChunk>;
  
}

export interface ChatbotServiceDefinition extends grpc.ServiceDefinition {
  StreamChat: MethodDefinition<_chatbot_StreamChatRequest, _chatbot_StreamChatChunk, _chatbot_StreamChatRequest__Output, _chatbot_StreamChatChunk__Output>
}
