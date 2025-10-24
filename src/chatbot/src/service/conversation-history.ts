import { getMongoClient } from "../common/mongo.js";
import config from "../config.js";
import { ChatHistoryItem } from "../types/mongo.js";

export const insertConversationHistory = async ({ userId, userInput, userAction, generator, conversationCard,
      dashboardCards, suggestions, createdAt = new Date() }: ChatHistoryItem) => {
  try {
    const mongoClient = getMongoClient();
    const collection = mongoClient.db(config.mongo.history.db).collection(config.mongo.history.collection);
    await collection.insertOne({
      userId,
      userInput,
      userAction,
      generator,
      conversationCard,
      dashboardCards,
      suggestions,
      createdAt,
    });
  } catch (error) {
    console.error("Insert Conversation History Failed:", error);
  }
};
