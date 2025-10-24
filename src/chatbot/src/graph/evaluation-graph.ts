import { buildLLM } from "./common/llm.js";
import { EvaluationInput, EvaluationResult } from "../types/evaluator.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import z from "zod";
import { getTeamMembers } from "./prompt/team.js";

export const evaluator = async (evaluationInput: EvaluationInput): Promise<EvaluationResult> => {
  const llm = buildLLM({ temperature: 0 });

  const filteredMessages = evaluationInput.messages.filter((m) => m.name === "System" && typeof m.content === "string" && m.content.includes("[User Action]"));
  const latestUserAction = filteredMessages[filteredMessages.length - 1]?.content?.toString();

  const prompt = `
You serve in the Aegis Agents project, which is an AI driven chatbot with automation investment service (Auto-Fi) for users.
You work with the workers from the following teams:
${(await getTeamMembers())
  .map(
    (team, index) =>
      ` - Team ${index + 1}: ${team.name} 
          ${team.workers.map((worker) => `* [${worker.name}]: ${worker.description} \n`).join("")} 
      `
  )
  .join("\n")}

You are an evaluator for the Aegis Agents chatbot (Aegis Agents). Evaluate ONLY the current turn using the provided inputs. Do not use any external knowledge. Your job is to produce three scores and six boolean assertions, plus a short reasoning. Be strict but fair.

Inputs (current turn only):
- User Input: ${evaluationInput.userInput || "(none)"}
- User Action: ${evaluationInput.userInput ? "None" : latestUserAction ?? "None"}
- Assistant Reply: ${evaluationInput.generator || "(none)"}
- Display UIs (read-only): ${evaluationInput.dashboardCards.length > 0 ? evaluationInput.dashboardCards.map((c) => `[${c.type}]`).join(", ") : "None"}
- Modification UIs (require user confirmation in next turn): ${evaluationInput.conversationCard ? `[${evaluationInput.conversationCard.type}]` : "None"}
- Assistant Suggestions: ${evaluationInput.suggestions?.length ? evaluationInput.suggestions.join(", ") : "(none)"}

Evaluation principles:
- Relevance: Is the reply directly responsive to the latest User Input or Action? Penalize off‑topic, generic fluff, or scope violations (outside Aegis/Web3).
- Accuracy/Consistency: No fabricated facts or numbers without UI/tool evidence. Respect domain boundaries (assets vs positions vs project vs instrument).
- UI Compliance: 
  - Display UIs are read‑only. Acknowledge showing is fine; never claim completion of changes.
  - Modification UIs require user confirmation in next turn.
  - Penalize “finish/already shown/completed” claims without matching evidence this turn.

Decide the following boolean assertions (true/false). Treat the string lists above as ground truth for this turn.
- premature_finish: Assistant implies the task is finished while no Display or Modification UI was opened this turn.
- missing_tool_call: Assistant claims something was shown/opened but both Display and Modification UI lists are empty.
- modify_claimed_complete: A Modification UI appears this turn, yet the assistant does not claim completion or request user confirmation.
- repeated_display: Assistant re‑opens exactly the same Display artifact in the same turn without user change request. If uncertain, false.
- domain_mismatch: The reply uses the wrong domain to answer the question.(e.g., uses assets data to answer positions question, or project metrics for instrument‑specific request).
- hallucination_numbers: The reply states specific numbers/metrics with no UI evidence this turn.

Scoring rules (0.0–1.0):
- relevance_score: 1.0 means fully on‑topic.
- accuracy_score: Penalize domain_mismatch, hallucination_numbers, fabrications.
- ui_compliance_score: Penalize premature_finish, missing_tool_call, modify_claimed_complete, repeated_display.

Output requirements:
- Return ONLY the structured JSON per the schema you were given.
- Keep reasoning concise (<=120 words); cite this turn only. Write in English.
- Scores must be within [0,1] with at most two decimals.
`.trim();

  const responseFormat = z.object({
    reasoning: z.string().min(1).max(600).describe("Brief explanation (<=120 words) citing only this turn’s evidence."),
    assertions: z.object({
      premature_finish: z.boolean().describe("Assistant implies finish without any UI shown this turn."),
      missing_tool_call: z.boolean().describe("Assistant claims UI/visibility but no Display/Modification UI recorded this turn."),
      modify_claimed_complete: z.boolean().describe("Modification UI shown but assistant claims completion without confirmation."),
      repeated_display: z.boolean().describe("Assistant re-opens the same display artifact in the same turn without changes."),
      domain_mismatch: z.boolean().describe("Used wrong domain to answer the question."),
      hallucination_numbers: z.boolean().describe("Gives specific numbers with no UI evidence this turn."),
    }),
    relevance_score: z.number().min(0).max(1).describe("0.00–1.00, responsiveness to user input/action."),
    accuracy_score: z.number().min(0).max(1).describe("0.00–1.00, correctness; domain aligned; no fabrications."),
    ui_compliance_score: z.number().min(0).max(1).describe("0.00–1.00, correct handling of display vs modification UI."),
  });

  const evaluatorAgent = createReactAgent({
    llm,
    tools: [],
    responseFormat,
  });

  const { structuredResponse } = await evaluatorAgent.invoke({
    messages: [{ role: "system", content: prompt }],
  });

  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  structuredResponse.relevance_score = clamp(Number(structuredResponse.relevance_score));
  structuredResponse.accuracy_score = clamp(Number(structuredResponse.accuracy_score));
  structuredResponse.ui_compliance_score = clamp(Number(structuredResponse.ui_compliance_score));

  return structuredResponse;
};
