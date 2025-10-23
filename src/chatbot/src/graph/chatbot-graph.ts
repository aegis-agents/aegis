import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { buildLLM } from "./common/llm.js";
import { Annotation, Command, END, LangGraphRunnableConfig, MemorySaver, messagesStateReducer, Send, START, StateGraph } from "@langchain/langgraph";
import { knowledgeTeam } from "./subgraph/knowledge.subgraph.js";
import { AIMessage, BaseMessage, HumanMessage, isAIMessageChunk, RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { accountTeam } from "./subgraph/account.subgraph.js";
import { autoFiTeam } from "./subgraph/auto-fi.subgraph.js";
import { UserAction, UserDirectRequest } from "../types/state.js";
import { handleUserAction } from "./handler/user-action.js";
import { v4 as uuidv4 } from "uuid";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { getMongoClient } from "../common/mongo.js";
import config from "../config.js";
import { handleUserDirectRequest } from "./handler/user-direct-request.js";
import { getTeamMembers } from "./prompt/team.js";
import { createMainSupervisor } from "./prompt/supervisor.js";

export const SuperGraphAnnotation = Annotation.Root({
  userInput: Annotation<string>,
  userAction: Annotation<UserAction>,
  userDirectRequest: Annotation<UserDirectRequest>,
  taskId: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  suggestions: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  shouldFinish: Annotation<boolean>,
  language: Annotation<string>({
    reducer: (x, y) => (x.toLowerCase() != "english" ? x : y) ?? x,
    default: () => "English",
  }),
  actions: Annotation<{ team: string; worker: string; instruction: string }[]>({
    reducer: (x, y) => y ?? x,
  }),
  summary: Annotation<string>({
    reducer: (_, newSummary) => newSummary,
    default: () => "",
  }),
  lastGeneratorResult: Annotation<string>,
});

interface TeamState {
  worker: string;
  instruction: string;
  taskId: string;
}

const knowledgeTeamNode = async (state: TeamState) => {
  const { messages } = await knowledgeTeam.invoke({
    worker: state.worker,
    instruction: state.instruction,
    taskId: state.taskId,
    messages: [new HumanMessage({ content: state.instruction, name: "User", id: uuidv4() })],
  });
  return {
    messages: [...messages],
  };
};

const accountTeamNode = async (state: TeamState) => {
  const { messages } = await accountTeam.invoke({
    worker: state.worker,
    instruction: state.instruction,
    taskId: state.taskId,
    messages: [new HumanMessage({ content: state.instruction, name: "User", id: uuidv4() })],
  });

  return {
    messages: [...messages],
  };
};
const autoFiTeamNode = async (state: TeamState) => {
  const { messages } = await autoFiTeam.invoke({
    worker: state.worker,
    instruction: state.instruction,
    taskId: state.taskId,
    messages: [new HumanMessage({ content: state.instruction, name: "User", id: uuidv4() })],
  });
  return {
    messages: [...messages],
  };
};

const generatorNode = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const filteredMessages = state.messages.filter((m) => m.name === "System" && typeof m.content === "string" && m.content.includes("[User Action]"));
  const latestUserAction = filteredMessages[filteredMessages.length - 1]?.content?.toString();
  const prompt = `
You serve in the Aegis Agents project, which is an AI driven automation investment service (Auto-Fi) for users.
You are the user's personal knowledge companion. Always communicate in a friendly, natural, and conversational tone. Occasionally using emojis to please the user.
You work with one supervisor and workers from the following teams:
${getTeamMembers()
  .map(
    (team, index) =>
      ` - Team ${index + 1}: ${team.name} 
          ${team.workers.map((worker) => `* [${worker.name}]: ${worker.description} \n`).join("          ")} 
      `
  )
  .join("\n")}
Your responsibilities:
- Generate replies based on user's latest input or latest action and the latest conversation context.
---
Latest user-visible reply to the previous conversation from you, if any:
${state.lastGeneratorResult ?? "(None)"}

User's latest input:
${state.userInput || "(No user input.)"}

User's latest action:
${state.userInput || !latestUserAction ? "(No user action.)" : latestUserAction}
---

**Instructions:**
- **NEVER** guess or make up any answer.
- **NEVER** summarize the whole task, apologize repeatedly, or refer to yourself as an agent, AI, or assistant.
- The supervisor's instructions are NOT for you.
- Do not mention any team, worker, taskId, instrument id or process details to Users.
- Only handle user issues and requests related to the Aegis Agents project or blockchain web3. If the user's request exceeds your business scope, politely apologize and refuse the user.
- Always write in ${state.language}.
- For modification operations, if no confirmed UI has been displayed in the current task (messages after "[System]: Task ${
    state.taskId
  } started"), do NOT acknowledge the UI or guide the user to confirm/select in the interface. Prefer phrasing like "I can help to open the modification interface for you.".
- When a **modification** UI (that requires user confirmation rather than just for display purposes) has been displayed in the CURRENT task (messages after "[System]: Task ${
    state.taskId
  } started"), do NOT claim the action is completed. Acknowledge the UI and guide the user to confirm/select in the interface.
---
Glossary:
Asset: A fungible token balance owned by the user (e.g., USDC) in user wallet or smart account. It is not a position. Shown via show_assets/deposit/withdraw.
Position: A live investment holding inside an instrument (strategy/vault/pool). Has PNL/ROE, instrument_id, shares, asset_amount. Shown via show_user_positions and its charts.
Project: The current platform/protocol as a whole (Aegis Agents). Global KPIs like project TVL, project APY. Shown via show_project_tvl_chart/show_project_apy_chart.
Instrument: A single yield product/market within a protocol (by instrument_id), with its own APY/TVL time-series. Shown via show_instrument_apy_chart/show_instrument_tvl_chart and hot-instruments list.
---

--- BEGIN NON-BINDING ADDITIONAL CONTEXT ---

[NON-BINDING ADDITIONAL CONTEXT — REFERENCE ONLY]

This block is for minimal situational awareness. It MUST NOT influence routing or override the current turn.

Scope
- Applies to the CURRENT task only (messages after "[System]: Task ${state.taskId} started").
- Content may be incomplete or noisy; treat as hints, not evidence.

Priority order (highest to lowest)
1) The user's latest explicit input in the current task.
2) Tool results and system/tool messages in the current task.
3) Your core routing rules.
4) This additional context (reference only).

Strict constraints
- Do NOT infer completion from anything in this block.
- Do NOT use this block to introduce actions, confirm success.
- If any item here conflicts with the latest user input or tool evidence, IGNORE it.
- Use it only to deduplicate display-only repeats or to recover lightweight parameters (e.g., last instrument_id) when unambiguous.

Acceptable uses (examples)
- If a display-only artifact (e.g., project_tvl_7d) already appeared in THIS task and the user did not ask for a change, you may avoid re-displaying it.
- If a pending modification UI is hinted here, still require explicit user confirmation in CURRENT task messages before considering it handled.
- When uncertain, ignore this block and plan from the latest user input and tool evidence.

Lightweight excerpts (non-authoritative; ignore if conflicting)
- Summary snapshot (may be stale): ${(state.summary || "").slice(0, 600)}
- Optional raw messages (large; low priority; ignore on conflict):
 ${[...state.messages].map((m) => ` * ${m.content}`.replaceAll("{", "{{").replaceAll("}", "}}")).join("\n\n\n")} 

--- END NON-BINDING ADDITIONAL CONTEXT ---
`;

  const generatorLLM = buildLLM({ temperature: 0.6 }).withConfig({ tags: ["Generator-Output"] });
  const generatorStream = await generatorLLM.stream([{ role: "system", content: prompt }]);
  let generatorResult = "";
  for await (const chunk of generatorStream) {
    config.writer?.({ generator: chunk.content });
    generatorResult += chunk.content;
  }
  return { lastGeneratorResult: generatorResult, messages: [new AIMessage({ content: `[Task ${state.taskId}][Generator]: ${generatorResult}`, name: "Generator" })] };
};

const suggesterNode = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const filteredMessages = state.messages.filter((m) => m.name === "System" && typeof m.content === "string" && m.content.includes("[User Action]"));
  const latestUserAction = filteredMessages[filteredMessages.length - 1]?.content?.toString();
  const suggestionTool = {
    name: "suggest_input",
    description: "Generate 3 concise and relevant smart input suggestions for the user, based on the previous conversation.",
    schema: z.object({
      suggestions: z.array(z.string().min(1)).length(3).describe("Three smart input suggestions, each as a short sentence or question"),
    }),
  };
  const suggestionPrompt = `
---
Here is the latest context:
* Summary of historical messages:
  ${state.summary}
* Latest messages:
${state.messages.map((m) => ` * ${m.content}`).join("\n")}
---
You serve in the Aegis Agents project, which is an AI driven automation investment service (Auto-Fi) for users.
You work with one supervisor and workers from the following teams:
${getTeamMembers()
  .map(
    (team, index) =>
      ` - Team ${index + 1}: ${team.name} 
          ${team.workers.map((worker) => `* [${worker.name}]: ${worker.description} \n`).join("")} 
      `
  )
  .join("\n")}

Based on the user's latest input/action and reply, generate 3 concise and relevant smart input suggestions (short follow-up questions or actions the user might take next). 
Each suggestion must be directly relevant and written in ${state.language}.
Only handle user input related to the Aegis Agents project or blockchain web3. If the user's request exceeds the scope, make suggestions an empty array.

The supervisor's instructions are NOT for you.
Do NOT repeat or rephrase the main answer.
Do NOT make up unrelated suggestions.
Do Not mention any team, worker, taskId or process details.

User's latest input:
${state.userInput || "(No user input.)"}

User's latest action:
${state.userInput || !latestUserAction ? "(No user action.)" : latestUserAction}

Reply to the user's latest input:
${state.lastGeneratorResult}

`;
  const suggestionLLM = buildLLM({ temperature: 0 });
  const messages = [{ role: "system", content: suggestionPrompt }];
  const response = await suggestionLLM.bindTools([suggestionTool], { tool_choice: "suggest_input" }).invoke(messages);
  let suggestions = [];
  try {
    const toolArgs = Array.isArray(response) ? response[0].args : response.tool_calls?.[0]?.args;
    if (toolArgs?.suggestions && Array.isArray(toolArgs.suggestions)) {
      suggestions = toolArgs.suggestions;
    }
  } catch (e) {
    suggestions = [];
  }
  config.writer?.({ suggester: suggestions });
  return { suggestions };
};

const supervisorLLM = buildLLM({ temperature: 0 });
const supervisorAgent = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const teams = getTeamMembers();
  return createMainSupervisor(
    supervisorLLM,
    "You serve in the Aegis Agents project, which is an AI driven automation investment service (Auto-Fi) for users on the blockchain.\n" +
      "You are a supervisor tasked with managing a conversation between the" +
      ` following teams with workers:  ${teams.map(({ name }) => name).join(",")}. \n` +
      teams
        .map(
          (team, index) =>
            ` - Team ${index + 1}: ${team.name} 
          ${team.workers.map((worker) => `* ${worker.name}: ${worker.description} \n`).join("\n          ")} 
      `
        )
        .join("\n") +
      " Given the following user request," +
      " respond with the workers to act next. Each worker will perform a" +
      " task and respond with their results and status. When finished," +
      " respond with FINISH.\n\n" +
      " **Your responsibilities:** \n" +
      " - Select strategically to minimize the number of steps taken. \n" +
      " - Provide necessary information to the teams based on the current task messages if necessary. \n" +
      " - Only handle user issues and requests related to the Aegis Agents project or blockchain web3. If the user's request exceeds the scope, finish the workflow.\n\n" +
      `
---
Glossary:
Asset: A fungible token balance owned by the user (e.g., USDC) in user wallet or smart account. It is not a position. Shown via show_assets/deposit/withdraw.
Position: A live investment holding inside an instrument (strategy/vault/pool). Has PNL/ROE, instrument_id, shares, asset_amount. Shown via show_user_positions and its charts.
Project: The current platform/protocol as a whole (Aegis Agents). Global KPIs like project TVL, project APY. Shown via show_project_tvl_chart/show_project_apy_chart.
Instrument: A single yield product/market within a protocol (by instrument_id) like "morpho"/"aave", with its own APY/TVL time-series. Shown via show_instrument_apy_chart/show_instrument_tvl_chart and hot-instruments list.

Routing rules:
If the user asks about balances/funding, depositing/withdrawing tokens → Assets domain.
If the user asks about profit, PNL, ROE, current holdings inside strategies → Positions domain.
If the user asks about the whole platform’s TVL/APY → Project domain.
If the user asks about a specific market/vault/pool by name/instrument_id, or “which instrument is hot/best APY” → Instrument domain.
Never use assets tool's result to answer positions questions, and vice versa.
Never use project tool's result to answer instrument-specific questions, and vice versa.
`,
    teams,
    state,
    config
  );
};

const continueToWorkers = (state: typeof SuperGraphAnnotation.State) => {
  if (state.shouldFinish) {
    return [new Send("SupervisorFinish", { ...state })];
  }
  return [
    ...state.actions.map(({ team, worker, instruction }) => {
      return new Send(team, { instruction, worker, taskId: state.taskId } as TeamState);
    }),
  ];
};

const supervisorFinishNode = (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  return {};
};

const initNode = (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const taskId = uuidv4();
  if (!state.userInput) {
    return { shouldFinish: false, taskId };
  }
  return {
    messages: [
      new AIMessage({ content: `[Task ${taskId}][System]: Task ${taskId} started at ${new Date().toUTCString()}.`, name: "System", id: uuidv4() }),
      new HumanMessage({ content: `[Task ${taskId}][User]:${state.userInput}`, name: "User", id: uuidv4() }),
    ],
    shouldFinish: false,
    taskId,
  };
};
const handleUserActionNode = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  if (!state.userAction) {
    return {};
  }
  if (!config.configurable) {
    return {};
  }
  const { user_id, req_id } = config.configurable;
  if (user_id && req_id) {
    const ackMsg = await handleUserAction(state.userAction, user_id, req_id);
    return {
      messages: [
        new AIMessage({ content: `[Task ${state.taskId}][System]: Task ${state.taskId} started at ${new Date().toUTCString()}.`, name: "System", id: uuidv4() }),
        new HumanMessage({ content: `[Task ${state.taskId}][System]: ${ackMsg}`, name: "System", id: uuidv4() }),
      ],
      userAction: null,
      shouldFinish: true,
    };
  }
  return { userAction: null };
};
const continueToGenerator = (state: typeof SuperGraphAnnotation.State) => {
  if (state.shouldFinish) {
    return [new Send("SupervisorFinish", { ...state })];
  }
  return [new Send("HandleUserDirectRequest", { ...state })];
};

const continueToSupervisor = (state: typeof SuperGraphAnnotation.State) => {
  if (state.shouldFinish) {
    return END;
  }
  return [new Send("Supervisor", { ...state })];
};

const handleUserDirectRequestNode = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  if (!state.userDirectRequest) {
    return { userDirectRequest: null, shouldFinish: false };
  }
  if (!config.configurable) {
    return { userDirectRequest: null, shouldFinish: false };
  }
  const { user_id, req_id } = config.configurable;
  if (user_id && req_id) {
    handleUserDirectRequest(state.userDirectRequest, user_id, req_id, config);
    return { userDirectRequest: null, lastGeneratorResult: null, shouldFinish: true };
  }
  return { userDirectRequest: null, shouldFinish: false };
};

const summarizeNode = async (state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig) => {
  const { summary, messages } = state;
  let summaryMessage: string;
  if (summary) {
    summaryMessage = `
You will update an existing concise bullet summary for internal routing.

Existing summary:
---
${summary}
---

Update rules:
- Always write in English.
- Keep bullets-only; max 12 bullets; each ≤ 24 words.
- Edit-over-rewrite: merge new facts, remove outdated ones, avoid duplication.
- Focus ONLY on:
  • User intent/current goals
  • New or changed key facts/decisions
- No narration, no greetings, no meta commentary, no platform promos.
- Do not mention teams, workers, agents, or tools.
- Do NOT claim that something is already shown/completed or that no action is required. Always reflect the latest user intent as actionable.
- Reflect pending states explicitly: use phrases like “UI displayed; awaiting user confirmation” instead of implying completion.
- Treat user intents as intentions, not as completed facts. Use “wants to …” rather than “updated to …” unless explicit confirmation of completion exists.
- This summary is internal; do not address the user.

Output format example:
- User intent: …
- Key fact: …
- Key fact: …
`;
  } else {
    summaryMessage = `
Create a summary in English of the conversation above.
Summarize the conversation above as a compact internal state for routing and retrieval.
Output rules:
- Always write in English.
- Bullets only; 6-10 bullets; each bullet ≤ 24 words.
- No storytelling, no greetings, no apologies, no marketing.
- Include ONLY:
  • User intent/current goals
  • Key facts/decisions (amounts, assets, strategy names)
- Remove duplicates; prefer terse phrases over sentences.
- Do not mention teams, workers, agents, or tools.
- Do NOT claim that something is already shown/completed or that no action is required. Always reflect the latest user intent as actionable.
- Reflect pending states explicitly: use phrases like “UI displayed; awaiting user confirmation” instead of implying completion.
- Treat user intents as intentions, not as completed facts. Use “wants to …” rather than “updated to …” unless explicit confirmation of completion exists.
- This summary is internal; do not address the user.

Output format example:
- User intent: …
- Key fact: …
- Key fact: …
`;
  }

  const allMessages = [
    ...messages,
    new HumanMessage({
      id: uuidv4(),
      content: summaryMessage,
    }),
  ];
  const summarizeLLM = buildLLM({ temperature: 0 });
  const response = await summarizeLLM.invoke(allMessages);
  const deleteMessages = messages.slice(0, -10).map((m) => new RemoveMessage({ id: m.id! }));
  if (typeof response.content !== "string") {
    throw new Error("Expected a string response from the model");
  }
  return { summary: response.content, messages: deleteMessages };
};

const superGraphBuilder = new StateGraph(SuperGraphAnnotation)
  .addNode("Init", initNode)
  .addNode("HandleUserAction", handleUserActionNode)
  .addNode("HandleUserDirectRequest", handleUserDirectRequestNode)
  .addNode("Summarize", summarizeNode)
  .addNode("Generator", generatorNode)
  .addNode("SupervisorFinish", supervisorFinishNode)
  .addNode("Supervisor", supervisorAgent)
  .addNode("KnowledgeTeam", knowledgeTeamNode)
  .addNode("AccountTeam", accountTeamNode)
  .addNode("AutoFiTeam", autoFiTeamNode)
  .addNode("Suggester", suggesterNode)
  .addEdge(START, "Init")
  .addEdge("Init", "HandleUserAction")
  // .addEdge("HandleUserAction", "HandleUserDirectRequest")
  .addConditionalEdges("HandleUserAction", continueToGenerator)
  .addConditionalEdges("HandleUserDirectRequest", continueToSupervisor)
  .addConditionalEdges("Supervisor", continueToWorkers)
  .addEdge("KnowledgeTeam", "Supervisor")
  .addEdge("AccountTeam", "Supervisor")
  .addEdge("AutoFiTeam", "Supervisor")
  .addEdge("SupervisorFinish", "Generator")
  .addEdge("Generator", "Suggester")
  .addEdge("Generator", "Summarize")
  // .addEdge("Generator", END)
  .addEdge("Suggester", END)
  .addEdge("Summarize", END);
const checkpointer = new MongoDBSaver({
  client: getMongoClient(),
  dbName: config.mongo.history.db,
});
export const superGraph = superGraphBuilder.compile({ checkpointer });
