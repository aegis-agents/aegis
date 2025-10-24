import { MongoClient } from "mongodb";
import config from "../config.js";

let mongoClient: MongoClient | null = null;
export const getMongoClient = () => {
  if (!mongoClient) {
    let mongoClientOptions = {};
    if (config.openai.use_proxy) {
      console.log("MongoClient use proxy.", config.mongo.proxy_host, config.mongo.proxy_port);
      mongoClientOptions = { proxyHost: config.mongo.proxy_host, proxyPort: config.mongo.proxy_port };
    }
    mongoClient = new MongoClient(config.mongo.url, mongoClientOptions);
  }
  return mongoClient;
};

export const closeMongoClient = async () => {
  console.log("Close MongoClient...");
  if (mongoClient) {
    await mongoClient.close();
  }
};
