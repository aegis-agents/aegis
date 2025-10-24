import { ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Command, getCurrentTaskInput, LangGraphRunnableConfig } from "@langchain/langgraph";
import z from "zod";
import { ConversationCard, ConversationCardType, DashboardCard, DashboardCardType } from "../../types/state.js";
import { getNatsConnection } from "../../common/nats.js";

export const changeSmartAccount = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: `Change User Smart Account Failed. The smart account change service is currently unavailable.`,
            tool_call_id: (config as any).toolCall.id,
          }),
        ],
      },
    });
  },
  {
    name: "change_smart_account",
    description: "Use this to trigger UI to request the user to change smart account.",
    schema: z.object({}),
  }
);

export const query_user_info = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    const nats = await getNatsConnection();
    try {
      const user = await nats.getUser({ uid: userId, req_id: reqId });
      if (!user) {
        throw new Error("The current user info does not exist.");
      }
      const userInfoCard: DashboardCard = {
        type: DashboardCardType.ShowUserInfo,
        args: [user],
      };
      config.writer?.({ dashboardCardExtractor: userInfoCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show information of the user has been display to the user.
The UI contains the following information:
- User Address: ${user.aegis_user.user_address} (The wallet address currently used by the user for sign in)
- User Smart Account Address: ${user.aegis_user.smart_address} （The address of smart account currently managed jointly by the user and the auto-fi agent）
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Query User Info Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_user_info",
    description: "Use this to trigger UI to show user the user info.",
    schema: z.object({}),
  }
);
