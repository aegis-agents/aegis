import { Command, END, LangGraphRunnableConfig, MessagesAnnotation, messagesStateReducer, Send, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage, RemoveMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
// import { TavilySearch } from "@langchain/tavily";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildLLM } from "../common/llm.js";
import { agentStateModifier, WorkerStateAnnotation, runAgentNode } from "../prompt/worker.js";
import {
  changeStrategy,
  deposit,
  showAssets,
  showHotInstruments,
  showInstrumentApyChart,
  showInstrumentTvlChart,
  showProjectApyChart,
  showProjectTvlChart,
  showStrategy,
  showUserPositionPnlChart,
  showUserPositionRoeChart,
  showUserPositions,
  withdraw,
} from "../tool/auto-fi.tool.js";

const AutoFiTeamState = Annotation.Root({
  worker: Annotation<string>,
  instruction: Annotation<string>,
  taskId: Annotation<string>,
  messages: Annotation<BaseMessage[]>,
});

const llm = buildLLM({ temperature: 0 });

const queryWorkerNode = (state: typeof AutoFiTeamState.State) => {
  const stateModifier = agentStateModifier(
    `
You are a query assistant belonging to the auto-fi team, helping users view their positions and profits, as well as displaying overall market and project data information, such as TVL, APY and other charts.
You have the following tools:
- [show_user_positions]: use this to trigger UI to display the information of the user's positions.
- [show_user_positions_roe_chart]: use this to trigger UI to display the ROE time-series chart of the user's current position.
- [show_user_positions_pnl_chart]: use this to trigger UI to display the PNL time-series chart of the user's current position.
- [show_project_tvl_chart]: use this to trigger UI to display the TVL time-series chart of the project.
- [show_project_apy_chart]: use this to trigger UI to display the APY time-series chart of the project.
- [show_hot_instruments]: use this to trigger UI to display the currently popular/hot instruments.
- [show_instrument_apy_chart]: use this to trigger UI to display the APY time-series chart of the instrument.
- [show_instrument_tvl_chart]: use this to trigger UI to display the TVL time-series chart of the instrument.
`,
    [showUserPositions, showUserPositionRoeChart, showUserPositionPnlChart, showProjectTvlChart, showProjectApyChart, showHotInstruments, showInstrumentApyChart, showInstrumentTvlChart],
    state.instruction
  );
  const agent = createReactAgent({
    llm,
    tools: [showUserPositions, showUserPositionRoeChart, showUserPositionPnlChart, showProjectTvlChart, showProjectApyChart, showHotInstruments, showInstrumentApyChart, showInstrumentTvlChart],
    stateModifier,
    stateSchema: WorkerStateAnnotation,
  });
  return runAgentNode({ state, agent, name: "QueryWorker" });
};

const strategyWorkerNode = (state: typeof AutoFiTeamState.State) => {
  const stateModifier = agentStateModifier(
    `
You are an assistant belonging to the auto-fi team, helping users query and modify their current auto-fi investment strategies. 
You have the following tools:
- [change_strategy]: use this to trigger UI to help user change the auto-fi investment strategy.
- [show_strategy]: use this to trigger UI to show the current auto-fi investment strategy of the user, only when the user explicitly wants to query the strategy rather than change it.
`,
    [showStrategy, changeStrategy],
    state.instruction
  );
  const agent = createReactAgent({ llm, tools: [showStrategy, changeStrategy], stateModifier, stateSchema: WorkerStateAnnotation });
  return runAgentNode({ state, agent, name: "StrategyWorker" });
};

const assetsWorkerNode = (state: typeof AutoFiTeamState.State) => {
  const stateModifier = agentStateModifier(
    `
You are an assistant that can help show the user's current assets, deposit assets, and withdraw assets. 
You have the following tools:
- [show_assets]: use this to trigger UI to show users their current assets.
- [deposit]: use this to trigger UI to help user deposit assets.
- [withdraw]: use this to trigger UI to help user withdraw assets.
`,
    [showAssets, deposit, withdraw],
    state.instruction
  );
  const agent = createReactAgent({ llm, tools: [showAssets, deposit, withdraw], stateModifier, stateSchema: WorkerStateAnnotation });
  return runAgentNode({ state, agent, name: "AssetsWorker" });
};
const autoFiGraph = new StateGraph(AutoFiTeamState)
  .addNode("QueryWorker", queryWorkerNode)
  .addNode("StrategyWorker", strategyWorkerNode)
  .addNode("AssetsWorker", assetsWorkerNode)
  .addConditionalEdges(START, (state) => state.worker)
  .addEdge("QueryWorker", END)
  .addEdge("StrategyWorker", END)
  .addEdge("AssetsWorker", END);

export const autoFiTeam = autoFiGraph.compile();
