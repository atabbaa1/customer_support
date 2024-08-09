import { NextResponse } from "next/server";
import OpenAI from "openai";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { pull } from "langchain/hub";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { StreamingTextResponse, createStreamDataTransformer } from "ai";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/dist/chat_history";
import { RunnableWithMessageHistory, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// const systemPrompt = "You are a friendly, customer support representative. You assist users with their needs."
const history_length = 10;

const loader = new CheerioWebBaseLoader("url");
const docs = await loader.load();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const splits = await textSplitter.splitDocuments(docs);
const vectorStore = await MemoryVectorStore.fromDocuments(
  splits,
  new OpenAIEmbeddings()
);

// Retrieve and generate using the relevant snippets of the blog.
const retriever = vectorStore.asRetriever();
const systemPrompt = pull<ChatPromptTemplate>("rlm/rag-prompt");

export async function POST(req) {

  const parser = new StringOutputParser();
  
  const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.3
  });

  const messageHistories = {}; // messageHistories is of type Record<string, InMemoryChatMessageHistory>

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      systemPrompt,
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{user_input}"],
  ]);
    
  // The following config should be passed into the runnable every time.
  // The config contains information that isn't part of the input directly, but is still useful
  const config = {
    configurable: {
      sessionId: "abc2",
    },
  };

  class ChainInput {
    constructor(chat_history = new BaseMessage(), input = "") {
      this.chat_history = chat_history;
      this.input = input;
    }
  }
  const filterMessages = (some_chain_inp) => some_chain_inp.chat_history.slice(history_length); // some_chain_inp is type ChainInput
  
  const chain = RunnableSequence.from<ChainInput>([
    RunnablePassthrough.assign({
      chat_history: filterMessages,
    }),
    prompt,
    model,
  ]);
  //const chain = prompt.pipe(model);
  
  const withMessageHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId) => { // sessionId is used to distiguish between separate conversations
      if (messageHistories[sessionId] === undefined) {
        messageHistories[sessionId] = new InMemoryChatMessageHistory();
      }
      return messageHistories[sessionId];
    },
    inputMessagesKey: "user_input",
    historyMessagesKey: "chat_history",
  });

  const user_question = "What's my name?";

  const stream = await withMessageHistory.stream(
    {
      user_input: user_question
    },
    config
  );

  for await (const chunk of stream) {
    const content = chunk.content;
    if (content) {

    }
  }








    
    
    /*
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const data = await req.json();
    
    const completion = await openai.chat.completions.create({
        messages: [{role: "system", content: systemPrompt}, ...data], 
        model: "gpt-3.5-turbo", 
        stream: true,
    });

    // Create a ReadableStream to handle the streaming response
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder() // Create a TextEncoder to convert strings to Uint8Array
            try {
                // Iterate over the streamed chunks of the response
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content // Extract the content from the chunk
                    if (content) {
                        const text = encoder.encode(content) // Encode the content to Uint8Array
                        controller.enqueue(text) // Enqueue the encoded text to the stream
                    }
                }
            } catch (err) {
                controller.error(err) // Handle any errors that occur during streaming
            } finally {
                controller.close() // Close the stream when done
            }
        },
    })

    return new NextResponse(stream) // Return the stream as the response
    */
}