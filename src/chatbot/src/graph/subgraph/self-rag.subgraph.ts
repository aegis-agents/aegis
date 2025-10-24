import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { type DocumentInterface } from "@langchain/core/documents";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { RunnableConfig } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { buildLLM } from "../common/llm.js";
import { buildRetriever } from "../common/vectorStore.js";

const retriever = buildRetriever();
const model = buildLLM({ temperature: 0 });

const GraphState = Annotation.Root({
  documents: Annotation<DocumentInterface[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  question: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  generation: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  generationVQuestionGrade: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  generationVDocumentsGrade: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
});

async function retrieve(state: typeof GraphState.State, config?: RunnableConfig): Promise<Partial<typeof GraphState.State>> {
  console.log("---RETRIEVE---");
  try {
    const documents = await retriever.withConfig({ runName: "FetchRelevantDocuments" }).invoke(state.question, config);
    return {
      documents,
    };
  } catch (error: any) {
    console.error("Retriever Search Error:", error, error.cause);
    throw error;
  }
}

async function generate(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---GENERATE---");

  // Pull in the prompt
  const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");
  // Construct the RAG chain by piping the prompt, model, and output parser
  const ragChain = prompt.pipe(model).pipe(new StringOutputParser());

  const generation = await ragChain.invoke({
    context: formatDocumentsAsString(state.documents),
    question: state.question,
  });

  return {
    generation,
  };
}

async function gradeDocuments(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---CHECK RELEVANCE---");

  // pass the name & schema to `withStructuredOutput` which will force the model to call this tool.
  const llmWithTool = model.withStructuredOutput(
    z
      .object({
        binaryScore: z.enum(["yes", "no"]).describe("Relevance score 'yes' or 'no'"),
      })
      .describe("Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."),
    {
      name: "grade",
    }
  );

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of a retrieved document to a user question.
  Here is the retrieved document:

  {context}

  Here is the user question: {question}

  If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
  Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`
  );

  // Chain
  const chain = prompt.pipe(llmWithTool);
  const docGrades = await Promise.all(
    state.documents.map(async (doc) => {
      try {
        return {
          doc,
          ...(await chain.invoke({
            context: doc.pageContent,
            question: state.question,
          })),
        };
      } catch (error) {
        return { doc, binaryScore: "no" };
      }
    })
  );
  const filteredDocs = docGrades.filter(({ doc, binaryScore }) => binaryScore === "yes").map(({ doc }) => doc);
  return {
    documents: filteredDocs,
  };
}

async function transformQuery(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---TRANSFORM QUERY---");

  // Pull in the prompt
  const prompt = ChatPromptTemplate.fromTemplate(
    `You are generating a question that is well optimized for semantic search retrieval.
  Look at the input and try to reason about the underlying sematic intent / meaning.
  Here is the initial question:
  \n ------- \n
  {question} 
  \n ------- \n
  Formulate an improved question: `
  );

  // Construct the chain
  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  const betterQuestion = await chain.invoke({ question: state.question });

  return {
    question: betterQuestion,
  };
}

function decideToGenerate(state: typeof GraphState.State) {
  console.log("---DECIDE TO GENERATE---");

  const filteredDocs = state.documents;
  if (filteredDocs.length === 0) {
    console.log("---DECISION: TRANSFORM QUERY---");
    return "transformQuery";
  }
  console.log("---DECISION: GENERATE---");
  return "generate";
}

async function generateGenerationVDocumentsGrade(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---GENERATE GENERATION vs DOCUMENTS GRADE---");

  const llmWithTool = model.withStructuredOutput(
    z
      .object({
        binaryScore: z.enum(["yes", "no"]).describe("Relevance score 'yes' or 'no'"),
      })
      .describe("Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."),
    {
      name: "grade",
    }
  );

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing whether an answer is grounded in / supported by a set of facts.
  Here are the facts:
  \n ------- \n
  {documents} 
  \n ------- \n
  Here is the answer: {generation}
  Give a binary score 'yes' or 'no' to indicate whether the answer is grounded in / supported by a set of facts.`
  );

  const chain = prompt.pipe(llmWithTool);

  const score = await chain.invoke({
    documents: formatDocumentsAsString(state.documents),
    generation: state.generation,
  });

  return {
    generationVDocumentsGrade: score.binaryScore,
  };
}

function gradeGenerationVDocuments(state: typeof GraphState.State) {
  console.log("---GRADE GENERATION vs DOCUMENTS---");

  const grade = state.generationVDocumentsGrade;
  if (grade === "yes") {
    console.log("---DECISION: SUPPORTED, MOVE TO FINAL GRADE---");
    return "supported";
  }

  console.log("---DECISION: NOT SUPPORTED, GENERATE AGAIN---");
  return "not supported";
}

async function generateGenerationVQuestionGrade(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---GENERATE GENERATION vs QUESTION GRADE---");

  const llmWithTool = model.withStructuredOutput(
    z
      .object({
        binaryScore: z.enum(["yes", "no"]).describe("Relevance score 'yes' or 'no'"),
      })
      .describe("Grade the relevance of the retrieved documents to the question. Either 'yes' or 'no'."),
    {
      name: "grade",
    }
  );

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing whether an answer is useful to resolve a question.
  Here is the answer:
  \n ------- \n
  {generation} 
  \n ------- \n
  Here is the question: {question}
  Give a binary score 'yes' or 'no' to indicate whether the answer is useful to resolve a question.`
  );

  const chain = prompt.pipe(llmWithTool);

  const score = await chain.invoke({
    question: state.question,
    generation: state.generation,
  });

  return {
    generationVQuestionGrade: score.binaryScore,
  };
}

function gradeGenerationVQuestion(state: typeof GraphState.State) {
  console.log("---GRADE GENERATION vs QUESTION---");

  const grade = state.generationVQuestionGrade;
  if (grade === "yes") {
    console.log("---DECISION: USEFUL---");
    return "useful";
  }

  console.log("---DECISION: NOT USEFUL---");
  return "not useful";
}

const workflow = new StateGraph(GraphState)
  // Define the nodes
  .addNode("retrieve", retrieve)
  // .addNode("gradeDocuments", gradeDocuments)
  .addNode("generate", generate);
// .addNode("generateGenerationVDocumentsGrade", generateGenerationVDocumentsGrade)
// .addNode("transformQuery", transformQuery)
// .addNode("generateGenerationVQuestionGrade", generateGenerationVQuestionGrade);

// Build graph
workflow.addEdge(START, "retrieve");
workflow.addEdge("retrieve", "generate");
workflow.addEdge("generate", END);
// workflow.addConditionalEdges("gradeDocuments", decideToGenerate, {
//   transformQuery: "transformQuery",
//   generate: "generate",
// });
// workflow.addEdge("transformQuery", "retrieve");
// workflow.addEdge("generate", "generateGenerationVDocumentsGrade");
// workflow.addConditionalEdges("generateGenerationVDocumentsGrade", gradeGenerationVDocuments, {
//   supported: "generateGenerationVQuestionGrade",
//   "not supported": "generate",
// });

// workflow.addConditionalEdges("generateGenerationVQuestionGrade", gradeGenerationVQuestion, {
//   useful: END,
//   "not useful": "transformQuery",
// });

// Compile
export const selfRagGraph = workflow.compile();
