import { FastifyInstance } from 'fastify';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

export const registerLangChainRoutes = (server: FastifyInstance) => {
  const llm = new ChatGroq({
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
    apiKey: process.env.GROQ_API_KEY,
  });

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "Eres un asistente virtual para Españolizate, especializado en responder preguntas frecuentes sobre nuestros servicios migratorios y de nacionalidad española. Al final de cada respuesta, con un divider, recuerda al usuario que puede presionar el botón 'Menu' para iniciar el proceso de incorporación una vez que todas sus preguntas hayan sido respondidas."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);
  // NOTE: At the of each response, can we add a code-generated message?

  const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());

  server.post<{
    Body: { input: string; phoneNumber: string };
  }>('/generate', {
    schema: {
      body: z.object({
        input: z.string(),
        phoneNumber: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { input, phoneNumber } = request.body;
    const { db } = server;

    if (!db.data) {
      await db.read();
      db.data ||= { conversations: {}, autoRespond: {} };
    }

    const chatHistory = db.data.conversations[phoneNumber]?.messages || [];

    const startTime = Date.now();
    try {
      const response = await chain.invoke({
        input,
        chat_history: chatHistory.map((entry) => entry.message),
      });

      const latency = Date.now() - startTime;

      // Update chat history
      db.data.conversations[phoneNumber].messages.push({ timestamp: new Date().toISOString(), message: input, sender: 'user' });
      db.data.conversations[phoneNumber].messages.push({ timestamp: new Date().toISOString(), message: response, sender: 'ai' });
      db.data.conversations[phoneNumber].messages = db.data.conversations[phoneNumber].messages.slice(-10); // Keep last 10 messages
      await db.write();

      server.log.info({ input, output: response, latency }, 'LangChain response generated');

      reply.send({ response, latency });
    } catch (error) {
      server.log.error(error, 'Error processing message with LangChain');
      reply.status(500).send({ error: 'An error occurred while processing your message.' });
    }
  });
};