import { NextResponse } from "next/server";
import OpenAI from "openai";
// import "cheerio";
// import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
// import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// import { MemoryVectorStore } from "langchain/vectorstores/memory";
// import { pull } from "langchain/hub";
// import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
// import { StreamingTextResponse, createStreamDataTransformer } from "ai";
// import { HttpResponseOutputParser } from "langchain/output_parsers";
// import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
// import { AIMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { RunnableWithMessageHistory, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), '/uploads');

const systemPrompt = "You are a friendly, customer support representative. You assist users with their needs. Only answer questions based off what you know. Do not make up information."

/*
const loader = new CheerioWebBaseLoader("https://abdulrahmantabbaa.com");
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
*/
const messageHistories = {}; // messageHistories is of type Record<string, InMemoryChatMessageHistory>

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
  temperature: 0.3
});

export async function POST(req) {
  
  let user_question = await req.json();
  console.log(`User question is ${user_question}`);
  console.log(`user_question[files] is ${user_question[files]}`)

  if (user_question instanceof formData) { // Some way of determining file upload from text entry
    // const filepath = user_question[user_question.length-1].file;
    // console.log(`Filepath is ${filepath}`);
    const form = new formidable.IncomingForm({
      uploadDir,
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      const uploadedFiles = Object.values(files).map((file) => {
        return {
          filename: path.basename(file.filepath),
          filepath: file.filepath,
        };
      });

      res.status(200).json({ uploadedFiles });
    })
  } else {
    user_question = user_question[user_question.length-1].content; // Retrieve the laast message
    console.log(user_question);
    const parser = new StringOutputParser();
    
    
    console.log("Before the try statement!");
    
    try {
    
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
      // and necessary for maintaining conversation history
      // The sessionId is a unique identifier for each conversation
      const config = {
        configurable: {
          sessionId: "abc2",
        },
      };
      console.log("Before limiting chat history");
      
      /* ************************************************************************************************************ */
      /* ********** The below code is for removing chat history after a certain number of messages ****************** */
      /* ************************************************************************************************************ */
      const history_length = 30;
      const filterMessages = (some_chain_inp) => some_chain_inp.chat_history.slice(-1*history_length); // some_chain_inp is type ChainInput
      console.log("Before the RunnableSequence from ChainInput");
      
      const chain = RunnableSequence.from([
        RunnablePassthrough.assign({
          chat_history: filterMessages,
        }),
        prompt,
        model,
      ]);
      /* ************************************************************************************************************ */
      /* ************************************************************************************************************ */
      /* ************************************************************************************************************ */
      console.log("After the RunnableSequence from ChainInput");
      
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
      
      console.log("Before invoking withMessageHistory");
      
      const stream = await withMessageHistory.invoke(
        {
          user_input: user_question
        },
        config
      );
      // console.log(stream.content);
      
      return new NextResponse(stream.content);
    } catch (e) {
      return Response.json({error: e.message}, {status: e.status});
    }
  }
  
    
    
    
    
    /* Code from the YouTube tutorial:
    https://www.youtube.com/watch?v=YLagvzoWCL0
    */
   







    
    
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