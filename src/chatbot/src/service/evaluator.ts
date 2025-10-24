import { getMongoClient } from "../common/mongo.js";
import config from "../config.js";
import { evaluator } from "../graph/evaluation-graph.js";
import { EvaluationInput, EvaluationResult } from "../types/evaluator.js";

export const runEvaluator = async (evaluationInput: EvaluationInput) => {
  console.log("Evaluator Start...");
  try {
    const res = await evaluator(evaluationInput);
    await insertEvaluation(evaluationInput, res);
    // TODO: notify
  } catch (error) {
    console.error("Run Evaluator Failed:", error);
  }
};

const insertEvaluation = async (evaluationInput: EvaluationInput, evaluation: EvaluationResult) => {
  console.log("Insert Evaluation...");
  try {
    if (!evaluation) {
      throw new Error("Invalid Evaluation Result.");
    }
    const mongoClient = getMongoClient();
    const collection = mongoClient.db(config.mongo.evaluator.db).collection(config.mongo.evaluator.collection);
    await collection.insertOne({
      evaluationInput,
      evaluation,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("Insert Evaluation Failed:", error);
  }
};
