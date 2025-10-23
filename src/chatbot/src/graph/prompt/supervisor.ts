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
import { Team } from "../../types/state.js";

export async function createMainSupervisor(llm: ChatOpenAI, systemPrompt: string, teams: Team[], state: typeof SuperGraphAnnotation.State, config: LangGraphRunnableConfig): Promise<Runnable> {
  const taskId = state.taskId;
  const lastReply = state.lastGeneratorResult?.trim?.();
  const supervisorContext = `
--- BEGIN NON-BINDING ADDITIONAL CONTEXT ---

[NON-BINDING ADDITIONAL CONTEXT — REFERENCE ONLY]

This block is for minimal situational awareness. It MUST NOT influence routing or override the current turn.

Scope
- Content may be incomplete or noisy; treat as hints, not evidence.

Priority order (highest to lowest)
1) The user's latest explicit input in the current task.
2) Tool results and system/tool messages in the current task.
3) Your core routing rules.
4) This additional context (reference only).

Strict constraints
- Do NOT infer completion from anything in this block.
- Do NOT use this block to introduce actions, confirm success, or decide finish=true.
- Do NOT infer completion or repetition from Generator text.
- If any item here conflicts with the latest user input or tool evidence, IGNORE it.
- Use it only to deduplicate display-only repeats or to recover lightweight parameters (e.g., last instrument_id) when unambiguous.

Acceptable uses (examples)
- If a display-only artifact (e.g., project_tvl_7d) already appeared in THIS task and the user did not ask for a change, you may avoid re-displaying it.
- If a pending modification UI is hinted here, still require explicit user confirmation in CURRENT task messages before considering it handled.
- When uncertain, ignore this block and plan from the latest user input and tool evidence.

Lightweight excerpts (non-authoritative; ignore if conflicting)
- Latest user-visible reply (may be incomplete): ${lastReply && lastReply.length > 0 ? lastReply.slice(0, 600) : "(None)"}
- Summary snapshot (may be stale): ${(state.summary || "").slice(0, 600)}
- Optional raw messages (large; low priority; ignore on conflict):
 ${[...state.messages]
   .filter((m) => !(["[Supervisor]", ...teams.map((team) => team.workers.map((worker) => `[${worker.name}]`)).flat()].includes(m.name ?? "") && !m.content.toString().includes(taskId)))
   .map((m) => ` * ${m.content}`.replaceAll("{", "{{").replaceAll("}", "}}"))
   .join("\n\n")} 

--- END NON-BINDING ADDITIONAL CONTEXT ---
`;
  const routeTool = {
    name: "route",
    description: "Select the next roles and their instructions.",
    schema: z.object({
      language: z.string().describe("The language used by the user. Only the word corresponding to the language, without adding any modifiers. For example, English, Chinese, and so on."),
      reasoning: z.string().describe(`reasoning/plan, write in ${state.language}. Do NOT mention any name of team or worker or assistant.`),
      finish: z.boolean().describe("whether the workflow should finish."),
      actions: z
        .array(
          z.object({
            team: z.enum(teams.map((team) => team.name) as [string, ...string[]]),
            worker: z.union(teams.map((team) => z.enum(team.workers.map((worker) => worker.name) as [string, ...string[]])) as [ZodTypeAny, ZodTypeAny, ...ZodEnum<[string, ...string[]]>[]]),
            instruction: z.string().describe("A specific instruction for what that worker of team should accomplish, write in English."),
          })
        )
        .describe("Parallelizable worker assignments."),
    }),
  };

  const promptText = `
You are the conversation supervisor. Decide which workers should act next or whether to finish.

Context
- Current taskId: ${taskId}
- Conversation messages above include a system note like "[System]: Task ${taskId} started" marking the start of this task.

Rules for assignment
1) Parallelism:
   - At most one modification operation (state-changing) worker at a time.
   - Display-only workers can run in parallel with a modification worker.
   - Example: AssetsWorker's [deposit] can run with QueryWorker's [show user positions]; StrategyWorker's [change strategy] cannot run in parallel with another modification worker.

2) Finish policy:
   - Consider ONLY messages starting with “[Task ${taskId}]” as evidence for this decision.
   - Ignore any messages with other taskIds for repetition checks or completion judgment.
   - If a modification UI that REQUIRES user confirmation was sent in current task ${taskId}, set finish=true.
   - If such a UI was sent in a previous turn (different taskId), do NOT auto-finish. Inspect the latest user input and plan for the new request.
   - If the user wants data analysis and you believe that the worker has provided enough relevant data in current task ${taskId}, even if the worker has not provided data analysis, you can still finish the worker flow and set finish=true.

3) No repetition within the same taskId:
   - Do NOT reassign an action that is equivalent to any action already executed AFTER "[System]: Task ${taskId} started".
   - "Equivalent" means same intent/output (e.g., showing the same hot instruments list, the same chart without new parameters).
   - If the requested display-only output has already been shown during this task and the user has NOT made a new specific request (e.g., a different instrument, timeframe, or metric), then:
     • return finish=true and actions=[].
   - This restriction applies only within the current taskId. A new user input starts a new taskId and permits fresh queries.

4) Scope and tone:
   - Only handle requests related to the Aegis Agents project or blockchain web3. Otherwise, finish the workflow.
   - Do NOT mention teams, workers or taskId in reasoning.

5) Latest user-visible reply (Generator):
   - Consider the "Latest user-visible reply" as the most recent user-facing context.
   - If there is no new user input, align planning with that reply when reasonable (e.g., follow up on the offered next step).
   - Do NOT treat suggestions or displayed UIs in that reply as completed actions.

6) Evidence boundaries:
   - Only consider messages AFTER "[System]: Task ${taskId} started" as evidence of actions in the current task.
   - Ignore older messages and the conversation summary for repetition checks.

Return format
- Return a JSON object with:
  - "finish": boolean
  - "actions": an array of {{ team, worker, instruction }}
- team choices: ${teams.map((team) => team.name).join(",")}
- worker choices by team:
${teams.map((team) => `  * ${team.name}: ${team.workers.map((w) => w.name).join(", ")}`).join("\n")}

Examples
{{
  "finish": false,
  "actions": [
    {{ "team": "AutoFiTeam", "worker": "AssetsWorker", "instruction": "The user wants to deposit USDC." }},
    {{ "team": "AutoFiTeam", "worker": "QueryWorker", "instruction": "Query the user's assets." }}
  ]
}}

or, when finishing:
{{
  "finish": true,
  "actions": []
}}
`;
  const messages = state.messages;
  let filteredMessage = [];
  const idx = [...messages].reverse().findIndex((m) => m.name === "System" && typeof m.content === "string" && m.content.includes(`Task ${taskId} started`));
  if (idx === -1) filteredMessage = [new AIMessage({ content: `[System]: Task ${taskId} started`, name: "System", id: uuidv4() }), new HumanMessage({ content: `[User]:${state.userInput}`, name: "User", id: uuidv4() })];
  const start = messages.length - 1 - idx;
  filteredMessage = messages.slice(start);
  let prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt], ["system", supervisorContext], ...filteredMessage, ["system", promptText]]);

  const supervisor = prompt
    .pipe(
      llm.bindTools([routeTool], {
        tool_choice: "route",
      })
    )
    .pipe(new JsonOutputToolsParser())
    .pipe((x: any) => {
      if (x[0].args.actions.length > 0) {
        x[0].args.finish = false;
      }
      console.log("Supervisor route:", JSON.stringify(x, null, 2));
      config.writer?.({ reasoning: x[0].args.reasoning });
      return {
        language: x[0].args.language,
        shouldFinish: x[0].args.finish,
        actions: x[0].args.actions,
        messages: [new AIMessage({ content: `[Task ${state.taskId}][Supervisor]: ${JSON.stringify(x, null, 2)}`, name: "Supervisor" })],
      };
    });
  return supervisor;
}
