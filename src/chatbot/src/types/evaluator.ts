import { BaseMessage } from "@langchain/core/messages";

export interface EvaluationAssertions {
  premature_finish: boolean;
  missing_tool_call: boolean;
  modify_claimed_complete: boolean;
  repeated_display: boolean;
  domain_mismatch: boolean;
  hallucination_numbers: boolean;
}

export interface EvaluationInput {
  reqId: string;
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
  messages: BaseMessage[];
}

export interface EvaluationResult {
  reasoning: string;
  assertions: EvaluationAssertions;
  relevance_score: number; // 0.0 - 1.0
  accuracy_score: number; // 0.0 - 1.0
  ui_compliance_score: number; // 0.0 - 1.0
}
