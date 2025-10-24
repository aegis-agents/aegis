import { Command, END, LangGraphRunnableConfig, MessagesAnnotation, messagesStateReducer, Send, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage, RemoveMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
// import { TavilySearch } from "@langchain/tavily";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildLLM } from "../common/llm.js";
import { changeSmartAccount, query_user_info as queryUserInfo } from "../tool/wallet.tool.js";
import { agentStateModifier, WorkerStateAnnotation, runAgentNode } from "../prompt/worker.js";
import { getMultiServerMCPClient } from "../../mcp-client/multi-mcp.js";

const AccountTeamState = Annotation.Root({
  worker: Annotation<string>,
  instruction: Annotation<string>,
  taskId: Annotation<string>,
  messages: Annotation<BaseMessage[]>,
});

const llm = buildLLM({ temperature: 0 });

const smartAccountWorkerNode = (state: typeof AccountTeamState.State) => {
  const stateModifier = agentStateModifier(
    `
You are an account assistant responsible for assist users in managing their smart accounts.
You have the following tools:
 - [change_smart_account]: Use this to trigger UI to request the user to change smart account. (not available yet)
`,
    [changeSmartAccount],
    state.instruction
  );
  const agent = createReactAgent({ llm, tools: [changeSmartAccount], stateModifier, stateSchema: WorkerStateAnnotation });
  return runAgentNode({ state, agent, name: "SmartAccountWorker" });
};

const accountWorkerNode = async (state: typeof AccountTeamState.State) => {
  const smartWalletMcpTools = await getMultiServerMCPClient(["smart_wallet"]).getTools();
  const stateModifier = agentStateModifier(
    `You are an account assistant responsible for assist users in managing their accounts.
You have the following tools:
 - [show_user_info]: Use this to trigger UI to show information (user address, smart account address and so on) of the user .
 ${smartWalletMcpTools.map((tool) => `- [${tool.name}]:${tool.description}\n`)}
`,
    [queryUserInfo, ...smartWalletMcpTools],
    state.instruction
  );
  const agent = createReactAgent({ llm, tools: [queryUserInfo, ...smartWalletMcpTools], stateModifier, stateSchema: WorkerStateAnnotation });
  return runAgentNode({ state, agent, name: "AccountWorker" });
};

const accountGraph = new StateGraph(AccountTeamState)
  .addNode("SmartAccountWorker", smartAccountWorkerNode)
  .addNode("AccountWorker", accountWorkerNode)
  .addConditionalEdges(START, (state) => state.worker)
  .addEdge("SmartAccountWorker", END)
  .addEdge("AccountWorker", END);

export const accountTeam = accountGraph.compile();
