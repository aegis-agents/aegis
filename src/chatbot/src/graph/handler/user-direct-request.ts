import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConversationCard, ConversationCardType, UserDirectRequest, UserDirectRequestType } from "../../types/state.js";

export const handleUserDirectRequest = (userDirectRequest: UserDirectRequest, userId: string, requestId: string, config: LangGraphRunnableConfig) => {
  switch (userDirectRequest.type) {
    case UserDirectRequestType.Deposit:
      return handleDeposit(userDirectRequest, userId, requestId, config);
    case UserDirectRequestType.Withdraw:
      return handleWithdraw(userDirectRequest, userId, requestId, config);
    default:
      return;
  }
};

const handleDeposit = (userDirectRequest: UserDirectRequest, userId: string, requestId: string, config: LangGraphRunnableConfig) => {
  const depositCard: ConversationCard = {
    type: ConversationCardType.Deposit,
    args: [],
  };
  console.log("User Direct Request Deposit Card", depositCard);
  config.writer?.({ conversationCardExtractor: depositCard });
};

const handleWithdraw = (userDirectRequest: UserDirectRequest, userId: string, requestId: string, config: LangGraphRunnableConfig) => {
  const withdrawCard: ConversationCard = {
    type: ConversationCardType.Withdraw,
    args: [],
  };
  console.log("User Direct Request Withdraw Card", withdrawCard);
  config.writer?.({ conversationCardExtractor: withdrawCard });
};
