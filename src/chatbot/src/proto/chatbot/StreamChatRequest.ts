// Original file: proto/chatbot.proto


export interface StreamChatRequest {
  'userInput'?: (string);
  'userId'?: (string);
  'userAction'?: (string);
  'userDirectRequest'?: (string);
}

export interface StreamChatRequest__Output {
  'userInput': (string);
  'userId': (string);
  'userAction': (string);
  'userDirectRequest': (string);
}
