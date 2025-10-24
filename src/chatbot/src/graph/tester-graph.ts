import { AIMessage, BaseMessage, HumanMessage, RemoveMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { Annotation, Command, END, LangGraphRunnableConfig, MemorySaver, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import { ConversationCard, DashboardCard, UserActionType } from "../types/state.js";
import { v4 as uuidv4 } from "uuid";
import { buildLLM } from "./common/llm.js";
import z from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import config from "../config.js";

export const TesterGraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  topics: Annotation<string[]>,
  generator: Annotation<string>,
  conversationCard: Annotation<ConversationCard>,
  dashboardCards: Annotation<DashboardCard[]>,
  suggestions: Annotation<string[]>,
  newRequest: Annotation<string>,
  newMockUserAction: Annotation<string>,
});

const initNode = async (state: typeof TesterGraphAnnotation.State) => {
  const messages = [...(state.messages ?? [])];
  return { messages };
};

const generateNewRequestNode = async (state: typeof TesterGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const llm = buildLLM({ temperature: 0 });
  const lastRequest = state.newRequest;
  if (!lastRequest) {
    return {
      newRequest: "What can you do for me? ",
      messages: [new HumanMessage({ content: `[Tester]: What can you do for me? `, name: "Tester", id: uuidv4() })],
    };
  }

  const promptStart = `
    You serve in the Aegis Agents project, which is an AI driven chatbot with automation investment service (Auto-Fi) for users.
    You are a tester for the chatbot of Aegis Agents.
    ---
    Here is the history of the conversation messages for you:
    `.trim();

  const promptEnd = `
    Your task is to produce robust next-turn user requests that stress-test the assistant. Produce ONLY the current turn using the provided inputs. Do not use any external knowledge. 
    Your job is to produce one new user request for next-turn conversation.
    
    Inputs (current turn only):
    - Your last Input: ${lastRequest || "(none)"}
    - Assistant Reply: ${state.generator || "(none)"}
    - Display UIs (read-only) with datas:
    ${state.dashboardCards.length > 0 ? state.dashboardCards.map((c) => `  * [${c.type}]:\n${JSON.stringify(c.args)}`).join("\n\n") : "None"}
    - Modification UI (require user confirmation in next turn): 
    ${state.conversationCard ? `  * [${state.conversationCard.type} UI]:\n${JSON.stringify(state.conversationCard.args)}` : "None"}
    - Assistant Suggestions: ${state.suggestions?.length ? state.suggestions.join(", ") : "(none)"}
    
    Generate 1 candidate user request that:
    - Are short, natural, and actionable.
    - Do NOT randomly search for assets. Focus as much as possible on assets supported in Auto-Fi, strategies and instrument of Auto-Fi investments.
    - Related to these topics as much as possible: ${state.topics?.length ? state.topics.join(", ") : "(none)"}
    - If a modification UI is present (Modification UI is not null), you MUST call the corresponding tool to submit the action. Do not describe the action; execute it via tool call.
    - Your final output must still be a structured response with userRequest, but you must also execute the tool when applicable.
    - Mix three angles when possible:
      1) Follow-up: pick the most relevant suggestion and turn it into a concrete ask (with specific parameter or timeframe).
      2) UI-interaction: if a modification UI is shown, use these tools to confirm/submit;
          * [deposit]: use this to deposit assets when the Assistant replies that the deposit UI has been displayed and the Modification UI is not null. Make USDC input amount less than $1.5.
          * [withdraw]: use this to withdraw assets when the Assistant replies that the withdraw UI has been displayed and the Modification UI is not null.
          * [change_strategy]: use this to change strategy when the Assistant replies that the Change Strategy UI has been displayed and the Modification UI is not null.
      3) Robustness: probe edge cases (e.g., different instrument, missing parameter default, repeated request detection) without being hostile.
    - Avoid meta talk about agents/tools/taskIds.
    - Do not repeat the assistant’s wording verbatim; paraphrase naturally.
    - Multiple sentences joined by 'and then'.
    - You MUST call the tool "response_format" exactly once at the end to return the final JSON { "userRequest": string }.
    - Do NOT print the JSON in assistant text. Only return it via the tool call.
    - If a modification UI is present, call the corresponding tool first, then call "response_format" as the last step.
    `.trim();
  const responseFormatSchema = z.object({
    userRequest: z.string().min(1).max(600).describe("New user request for next-turn conversation."),
  });
  const responseFormatTool = tool(
    async ({ userRequest }, runnableConfig: LangGraphRunnableConfig) => {
      return {
        userRequest,
      };
    },
    {
      name: "response_format",
      description: "Format the final response into strict JSON shape.",
      schema: responseFormatSchema,
    }
  );
  const testerAgent = createReactAgent({
    llm,
    tools: [deposit, withdraw, changeStrategy, responseFormatTool],
    stateSchema: Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
      }),
      newMockUserAction: Annotation<string>,
    }),
  });

  const { messages, newMockUserAction } = await testerAgent.invoke({
    messages: [new SystemMessage(promptStart), ...state.messages, new SystemMessage(promptEnd)],
  });
  let userRequest: string | undefined;
  const toolMsgs = (messages ?? []).filter((m) => (m as any)?.getType?.() === "tool" || (m as any)?._getType?.() === "tool" || (m as any)?.constructor?.name === "ToolMessage");
  for (const tm of toolMsgs) {
    const name = (tm as any)?.name ?? (tm as any)?.toolName ?? (tm as any)?.additional_kwargs?.tool_name;
    if (name === "response_format") {
      const content = (tm as any).content;
      if (typeof content === "string") {
        const parsed = safeParseJsonFromText<{ userRequest?: string }>(content);
        userRequest = parsed?.userRequest;
      } else if (content && typeof content === "object") {
        userRequest = (content as any).userRequest;
      }
      if (userRequest) break;
    }
  }
  if (!userRequest) {
    const aiMsgs = (messages ?? []).filter((msg) => (msg as any)?.getType?.() === "ai" || (msg as any)?._getType?.() === "ai" || (msg as any)?.constructor?.name === "AIMessage");
    const lastAI = aiMsgs[aiMsgs.length - 1];
    if (lastAI) {
      const raw = typeof (lastAI as any).content === "string" ? (lastAI as any).content : JSON.stringify((lastAI as any).content);
      userRequest = safeParseJsonFromText<{ userRequest?: string }>(raw)?.userRequest;
    }
  }

  return {
    newRequest: userRequest,
    newMockUserAction,
    messages: [
      new AIMessage({
        content: `
[Chatbot]:
- Assistant Reply: ${state.generator || "(none)"}
- Display UIs (read-only): ${state.dashboardCards.length > 0 ? state.dashboardCards.map((c) => `[${c.type}]`).join(", ") : "None"}
- Modification UIs (require user confirmation in next turn): ${state.conversationCard ? `[${state.conversationCard.type}]` : "None"}
- Assistant Suggestions: ${state.suggestions?.length ? state.suggestions.join(", ") : "(none)"}`,
        name: "Chatbot",
        id: uuidv4(),
      }),
      new HumanMessage({ content: `[Tester]:${userRequest}`, name: "Tester", id: uuidv4() }),
    ],
  };
};

const clearOldMessagesNode = async (state: typeof TesterGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const deleteMessages = state.messages.slice(0, -12).map((m) => new RemoveMessage({ id: m.id! }));
  return { messages: deleteMessages };
};

const testerGraphBuilder = new StateGraph(TesterGraphAnnotation)
  .addNode("Init", initNode)
  .addNode("GenerateNewRequest", generateNewRequestNode)
  .addNode("ClearOldMessages", clearOldMessagesNode)
  .addEdge(START, "Init")
  .addEdge("Init", "GenerateNewRequest")
  .addEdge("GenerateNewRequest", "ClearOldMessages")
  .addEdge("ClearOldMessages", END);

const checkpointer = new MemorySaver();
export const testerGraph = testerGraphBuilder.compile({ checkpointer });

const testerAccount = privateKeyToAccount(config.tester.tester_sk as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(config.tester.rpc_url),
});

const walletClient = createWalletClient({
  account: testerAccount,
  chain: base,
  transport: http(),
});
const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const deposit = tool(
  async ({ amount }, runnableConfig: LangGraphRunnableConfig) => {
    const abi = [
      {
        constant: false,
        inputs: [
          {
            name: "_to",
            type: "address",
          },
          {
            name: "_value",
            type: "uint256",
          },
        ],
        name: "transfer",
        outputs: [
          {
            name: "",
            type: "bool",
          },
        ],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ];
    const txHash = await walletClient.writeContract({
      account: testerAccount,
      address: usdcAddress,
      abi: abi,
      functionName: "transfer",
      args: [config.tester.tester_smart_address, parseUnits(amount, 6)],
    });
    const userActionJson = JSON.stringify({
      type: UserActionType.Deposit,
      args: [amount, "USDC", base.id, txHash],
    });
    return new Command({
      update: {
        newMockUserAction: userActionJson,
        messages: [
          new ToolMessage({
            content: `Successfully deposit ${amount} USDC. Chain Id: ${base.id}.Tx hash: ${txHash}`,
            tool_call_id: (runnableConfig as any).toolCall.id,
          }),
        ],
      },
    });
  },

  {
    name: "deposit",
    description: "use this to deposit assets when the Assistant replies that the deposit UI has been displayed and the Modification UI is not null.",
    schema: z.object({
      amount: z.string().describe("the amount of the asset to deposit."),
    }),
  }
);

const withdraw = tool(
  async ({ amount }, runnableConfig: LangGraphRunnableConfig) => {
    const [account] = await walletClient.getAddresses();
    const { nonce } = await fetchNonce(account);
    const signature = await getWithdrawSignature(account, usdcAddress, parseUnits(amount, 6).toString(), nonce);
    const userActionJson = JSON.stringify({
      type: UserActionType.Withdraw,
      args: [base.id, usdcAddress, parseUnits(amount, 6).toString(), `${nonce}`, signature],
    });
    return new Command({
      update: {
        newMockUserAction: userActionJson,
        messages: [
          new ToolMessage({
            content: `Successfully make a request to withdraw ${amount} USDC.`,
            tool_call_id: (runnableConfig as any).toolCall.id,
          }),
        ],
      },
    });
  },
  {
    name: "withdraw",
    description: "use this to withdraw assets when the Assistant replies that the withdraw UI has been displayed and the Modification UI is not null.",
    schema: z.object({
      amount: z.string().describe("the amount of the asset to withdraw."),
    }),
  }
);

const changeStrategy = tool(
  async ({ newStrategy }, runnableConfig: LangGraphRunnableConfig) => {
    const userActionJson = JSON.stringify({
      type: UserActionType.ChangeStrategy,
      args: [newStrategy, false],
    });
    return new Command({
      update: {
        newMockUserAction: userActionJson,
        messages: [
          new ToolMessage({
            content: `Successfully make a request to change strategy. New Value:${newStrategy}`,
            tool_call_id: (runnableConfig as any).toolCall.id,
          }),
        ],
      },
    });
  },
  {
    name: "change_strategy",
    description: "use this to change strategy when the Assistant replies that the Change Strategy UI has been displayed and the Modification UI is not null.",
    schema: z.object({
      newStrategy: z.enum(["0", "1", "2", "3"]).describe(
        `The new strategy user want to change.
         Auto-fi strategy contains following options:
          - 0: disable
          - 1: conservative
          - 2: balanced (not supported)
          - 3: aggressive (not supported)`
      ),
    }),
  }
);

const fetchNonce = async (address: string) => {
  const response = await fetch(`${config.tester.base_url}/fetchNonce?address=${address}`, {
    method: "GET",
    headers: {
      // Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const {
    data: { nonce },
  } = (await response.json()) as any;
  return nonce;
};

const getWithdrawSignature = async (address: string, tokenAddress: string, tokenAmount: string, nonce: number) => {
  const domain = {
    name: "aegis.auto",
    version: "1",
  };

  const types = {
    WithdrawAction: [
      { name: "address", type: "address" },
      { name: "tokenAddress", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "nonce", type: "string" },
    ],
  };
  const message = {
    address: address as `0x${string}`,
    tokenAddress: tokenAddress as `0x${string}`,
    tokenAmount: BigInt(tokenAmount),
    nonce: `${nonce}`,
  };

  return walletClient.signTypedData({
    account: address as `0x${string}`,
    domain,
    types,
    primaryType: "WithdrawAction",
    message,
  });
};

export function safeParseJsonFromText<T = any>(text: string): T | undefined {
  if (!text) return undefined;
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return undefined;

  const candidate = text.slice(firstBrace, lastBrace + 1).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return undefined;
  }
}
