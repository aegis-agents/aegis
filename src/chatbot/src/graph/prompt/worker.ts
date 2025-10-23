import { z, ZodEnum, ZodTypeAny } from "zod";
import { HumanMessage, BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { ChatOpenAI } from "@langchain/openai";
import { Runnable } from "@langchain/core/runnables";
import { StructuredToolInterface } from "@langchain/core/tools";
import { Annotation, LangGraphRunnableConfig, MessagesAnnotation, messagesStateReducer } from "@langchain/langgraph";
import { SuperGraphAnnotation } from "../chatbot-graph.js";
import { v4 as uuidv4 } from "uuid";
import { indentLines, pretty } from "../common/helper.js";

export const WorkerStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

export const agentStateModifier = (systemPrompt: string, tools: StructuredToolInterface[], instruction: string): ((state: typeof MessagesAnnotation.State) => BaseMessage[]) => {
  const toolNames = tools.map((t) => t.name).join(", ");
  const systemMsgStart = new SystemMessage(
    systemPrompt +
      "\nWork autonomously according to your specialty, using the tools available to you.\n" +
      " Do not ask for clarification.\n" +
      " Work only according to the instructions of the supervisor and do not ask questions arbitrarily.\n" +
      " Your other team members (and other teams) will collaborate with you with their own specialties.\n" +
      ` You are chosen for a reason (${instruction})!\n` +
      "Output policy:" +
      "- Do NOT produce explanations, summaries, or natural language results." +
      "- Call tools as needed; after all required tool calls are finished, return exactly: done" +
      "- If no tool call is needed, immediately return: done" +
      "- Never include anything other than: done"
  );
  const systemMsgEnd = new SystemMessage(
    `Supervisor instructions: ${systemPrompt}\n` +
      `Remember, you individually can only use these tools: ${toolNames} \n` +
      // "You must clearly provide the names of the tools you have called.\n" +
      // "You need to describe the UI content(if any) returned by the tools as much as possible.\n" +
      "Do not ask for clarification.\n" +
      "Work only according to the instructions of the supervisor and do not ask questions arbitrarily.\n" +
      "No storytelling, no greetings, no apologies, no marketing.\n" +
      "Final assistant text message MUST be exactly: done\n"
  );

  return (state: typeof MessagesAnnotation.State): any[] => [systemMsgStart, ...state.messages, systemMsgEnd];
};

export async function runAgentNode(params: { state: any; agent: Runnable; name: string }) {
  const { state, agent, name } = params;
  const result = await agent.invoke({
    messages: state.messages,
  });
  const messages: BaseMessage[] = result.messages ?? result ?? [];

  type ToolCall = { id: string; name: string; args: any; order: number };
  type ToolResult = { callId: string; content: any; order: number };

  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  let order = 0;
  for (const msg of messages) {
    order++;

    const isAI = (msg as any)?._getType?.() === "ai" || msg.constructor?.name === "AIMessage";
    if (isAI && Array.isArray((msg as any).tool_calls)) {
      for (const call of (msg as any).tool_calls) {
        toolCalls.push({
          id: call.id,
          name: call.name,
          args: call.args,
          order,
        });
      }
    }

    const isTool = (msg as any)?._getType?.() === "tool" || msg.constructor?.name === "ToolMessage";
    if (isTool) {
      const callId = (msg as any).tool_call_id;
      toolResults.push({
        callId,
        content: (msg as any).content,
        order,
      });
    }
  }

  toolCalls.sort((a, b) => a.order - b.order);
  toolResults.sort((a, b) => a.order - b.order);

  const resultByCallId: Record<string, ToolResult[]> = {};
  for (const r of toolResults) {
    if (!resultByCallId[r.callId]) resultByCallId[r.callId] = [];
    resultByCallId[r.callId].push(r);
  }

  const lines: string[] = [];
  lines.push(`[Task ${state.taskId}][${name}]:`);
  lines.push(`Tools called:`);

  if (toolCalls.length === 0) {
    lines.push(`- (No tools were called in this step)`);
  } else {
    for (const call of toolCalls) {
      lines.push(`- tool name: ${call.name}`);
      lines.push(indentLines(`args: ${pretty(call.args, 2)}`, 2));

      const results = resultByCallId[call.id] ?? [];
      if (results.length === 0) {
        lines.push(indentLines(`result: (no tool result received)`, 2));
        continue;
      }

      if (results.length === 1) {
        lines.push(indentLines(`result: ${pretty(results[0].content, 2)}`, 2));
      } else {
        lines.push(indentLines(`result:`, 2));
        results.forEach((res, idx) => {
          lines.push(indentLines(`[${idx + 1}] ${pretty(res.content, 2)}`, 4));
        });
      }
    }
  }

  lines.push("");
  lines.push("These tool results are sufficient to solve the task.");
  lines.push("Done.");

  const summary = lines.join("\n");

  return {
    messages: [new AIMessage({ content: summary, name })],
  };
}
