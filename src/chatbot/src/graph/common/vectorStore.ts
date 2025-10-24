import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import config from "../../config.js";
import { MongoClient } from "mongodb";
import { VectorStoreRetriever } from "@langchain/core/vectorstores.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getMongoClient } from "../../common/mongo.js";

let retriever: VectorStoreRetriever | null = null;
export const buildRetriever = () => {
  if (retriever == null) {
    try {
      let configuration = {};
      if (config.openai.use_proxy) {
        console.log("Openai use proxy.", config.openai.http_proxy);
        const httpAgent = new HttpsProxyAgent(config.openai.http_proxy);
        configuration = { ...configuration, httpAgent };
      }
      const embeddingModel = new OpenAIEmbeddings({ model: "text-embedding-3-large", apiKey: config.openai.embedding_model_api_key, configuration });
      // const embeddingModel = new OllamaEmbeddings({
      //   model: "mxbai-embed-large", // Default value
      //   baseUrl: "http://127.0.0.1:11454", // Default value
      // });

      const mongoClient = getMongoClient();
      const collection = mongoClient.db(config.mongo.rag.db).collection(config.mongo.rag.collection);
      const vectorStore = new MongoDBAtlasVectorSearch(embeddingModel, { collection: collection, indexName: config.mongo.rag.index_name });
      retriever = vectorStore.asRetriever();
    } catch (error: any) {
      console.error("Build Retriever Error:", error, error.cause);
      throw error;
    }
  }
  return retriever;
};
