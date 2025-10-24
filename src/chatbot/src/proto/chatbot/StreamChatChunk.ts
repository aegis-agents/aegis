// Original file: proto/chatbot.proto

import type { ReasoningChunk as _chatbot_ReasoningChunk, ReasoningChunk__Output as _chatbot_ReasoningChunk__Output } from '../chatbot/ReasoningChunk';
import type { GeneratorChunk as _chatbot_GeneratorChunk, GeneratorChunk__Output as _chatbot_GeneratorChunk__Output } from '../chatbot/GeneratorChunk';

export interface StreamChatChunk {
  'reasoningChunk'?: (_chatbot_ReasoningChunk | null);
  'generatorChunk'?: (_chatbot_GeneratorChunk | null);
  'conversationCardJson'?: (string);
  'dashboardCardsJson'?: (string);
  'suggestionsJson'?: (string);
  'payload'?: "reasoningChunk"|"generatorChunk"|"conversationCardJson"|"dashboardCardsJson"|"suggestionsJson";
}

export interface StreamChatChunk__Output {
  'reasoningChunk'?: (_chatbot_ReasoningChunk__Output | null);
  'generatorChunk'?: (_chatbot_GeneratorChunk__Output | null);
  'conversationCardJson'?: (string);
  'dashboardCardsJson'?: (string);
  'suggestionsJson'?: (string);
  'payload'?: "reasoningChunk"|"generatorChunk"|"conversationCardJson"|"dashboardCardsJson"|"suggestionsJson";
}
