import { Command, END, GraphRecursionError, LangGraphRunnableConfig, MessagesAnnotation, messagesStateReducer, Send, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage, RemoveMessage, ToolMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
// import { TavilySearch } from "@langchain/tavily";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildLLM } from "../common/llm.js";
import { agentStateModifier, WorkerStateAnnotation, runAgentNode } from "../prompt/worker.js";
import { v4 as uuidv4 } from "uuid";
import config from "../../config.js";
import { searchWithTavily } from "../tool/knowledge.tool.js";
import { selfRagGraph } from "./self-rag.subgraph.js";
import { isGraphRecursionError } from "../common/helper.js";
import { getBlockscoutMcpClient } from "../../mcp-client/blockscout.js";

const knowledgeTeamState = Annotation.Root({
  worker: Annotation<string>,
  instruction: Annotation<string>,
  taskId: Annotation<string>,
  messages: Annotation<BaseMessage[]>,
});

const llm = buildLLM({ temperature: 0 });
const tavilyTool = searchWithTavily;
const scrapeWebpage = tool(
  async (input) => {
    try {
      const loader = new CheerioWebBaseLoader(input.url);
      const docs = await loader.load();
      const formattedDocs = docs.map((doc) => `<Document name="${doc.metadata?.title}">\n${doc.pageContent}\n</Document>`);
      return formattedDocs.join("\n\n");
    } catch (error) {
      console.log(error);
      throw error;
    }
  },
  {
    name: "scrape_webpage",
    description: "Scrape the contents of a webpage.",
    schema: z.object({
      url: z.string(),
    }),
  }
);

const searchNode = (state: typeof knowledgeTeamState.State) => {
  console.log("Search Node Start");
  const stateModifier = agentStateModifier(
    "You are a research assistant who can search for up-to-date info using the tavily search engine.\n" +
      "For each search result, **always** provide the source URL together with your answer. Format each result as:\nWebpages:\n - [Title 1](URL 1).\n - [Title 2](URL 2).",
    [tavilyTool],
    state.instruction
  );
  const searchAgent = createReactAgent({
    llm,
    tools: [tavilyTool],
    stateModifier,
    stateSchema: WorkerStateAnnotation,
  });
  return runAgentNode({ state, agent: searchAgent, name: "Search" });
};

const selfRagNode = async (state: typeof knowledgeTeamState.State) => {
  console.log("Self-Rag Node Start");
  try {
    const { generation } = await selfRagGraph.invoke({ question: state.instruction }, { recursionLimit: 50 });
    return { messages: [new AIMessage({ content: `[SelfRag]: ${generation}`, name: "SelfRag" })] };
  } catch (error) {
    if (error instanceof GraphRecursionError || isGraphRecursionError(error)) {
      return { messages: [new AIMessage({ content: `[SelfRag]: No relevant documents found in official documents. Please do NOT try again.`, name: "SelfRag" })] };
    }
    return { messages: [new AIMessage({ content: `[SelfRag]: An error occurred while using self-reflective RAG to query official documents. Please try again.`, name: "SelfRag" })] };
  }
};
const blockscoutMcpTools = await getBlockscoutMcpClient().getTools();
const onChainDataWorkerNode = async (state: typeof knowledgeTeamState.State) => {
  console.log("OnChainDataWorker Node Start");
  // const tools = await getBlockscoutMcpClient().getTools();
  const stateModifier = agentStateModifier(
    `
  You are a query assistant who can fetch blockchain data (balances, tokens, NFTs, contract metadata) via the Model Context Protocol to access and analyze blockchain information contextually.
  You have the following tools:
  ${blockscoutMcpTools.map((tool) => `- [${tool.name}]:${tool.description}\n`)}
          `,
    [...blockscoutMcpTools],
    state.instruction
  );
  const researchAgent = createReactAgent({
    llm: llm,
    tools: [...blockscoutMcpTools],
    stateModifier,
    stateSchema: WorkerStateAnnotation,
  });
  const callId = uuidv4();
  return runAgentNode({
    state: {
      ...state,
      messages: [
        ...state.messages,
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "__unlock_blockchain_analysis__",
              args: {},
              id: callId,
            },
          ],
        }),
        new ToolMessage({
          content: "",
          tool_call_id: callId,
        }),
      ],
    },
    agent: researchAgent,
    name: "OnChainDataWorker",
  });
};

const webScraperNode = (state: typeof knowledgeTeamState.State) => {
  console.log("WebScraper Node Start");
  const stateModifier = agentStateModifier("You are a research assistant who can scrape specified urls for more detailed information using the scrapeWebpage function.", [scrapeWebpage], state.instruction);
  const researchAgent = createReactAgent({
    llm,
    tools: [scrapeWebpage],
    stateModifier,
    stateSchema: WorkerStateAnnotation,
  });

  return runAgentNode({
    state,
    agent: researchAgent,
    name: "WebScraper",
  });
};

const knowledgeGraph = new StateGraph(knowledgeTeamState)
  // .addNode("Search", searchNode)
  .addNode("SelfRAG", selfRagNode)
  .addNode("OnChainDataWorker", onChainDataWorkerNode)
  // .addNode("WebScraper", webScraperNode)
  .addConditionalEdges(START, (state) => state.worker)
  .addEdge("OnChainDataWorker", END)
  .addEdge("SelfRAG", END);
// .addEdge("Search", END)
// .addEdge("WebScraper", END);

export const knowledgeTeam = knowledgeGraph.compile();
