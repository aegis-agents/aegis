export type ChatHistoryItem = {
  userId: string;
  userInput: string;
  userAction: any;
  generator: string;
  conversationCard: {
    type: string;
    args: any;
  } | null;
  dashboardCards: {
    type: string;
    args: any;
  }[];
  suggestions: string[];
  createdAt?: Date;
};
