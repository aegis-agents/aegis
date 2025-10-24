import { tool } from "@langchain/core/tools";
import { Command, getCurrentTaskInput, LangGraphRunnableConfig } from "@langchain/langgraph";
import { TavilySearch } from "@langchain/tavily";
import z from "zod";
import config from "../../config.js";
import { DashboardCard, DashboardCardType } from "../../types/state.js";
import { ToolMessage } from "@langchain/core/messages";

const tavilyTool = new TavilySearch({ tavilyApiKey: config.tavily.api_key });
export const searchWithTavily = tool(
  async ({ query, topic, includeImages, timeRange, includeDomains, excludeDomains, searchDepth }, config: LangGraphRunnableConfig) => {
    // const userId = config.configurable?.user_id;
    // const toolCallId = config.toolCall.id;
    const searchResult = await tavilyTool.invoke({ query, topic, includeImages, timeRange, includeDomains, excludeDomains, searchDepth });
    console.log("SearchResult\n", searchResult, searchResult.results.map((result: any) => result.url).join("\n"));
    const webpageCard: DashboardCard = {
      type: DashboardCardType.Webpage,
      args: searchResult.results.map((result: any) => result.url),
    };
    config.writer?.({ dashboardCardExtractor: webpageCard });
    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: JSON.stringify(searchResult, null, 2),
            tool_call_id: (config as any).toolCall.id,
          }),
        ],
      },
    });
  },
  {
    name: "search_with_tavily",
    description: tavilyTool.description,
    schema: tavilyTool.schema,
  }
);
