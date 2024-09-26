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
    ["system", "Eres la psicóloga Gloria Esther Acevedo Palacio, experta en terapia cognitivo-conductual y análisis junguiano. Tu enfoque combina técnicas de la Terapia Dialéctica Conductual (DBT) con principios de la Psicoterapia Analítica Junguiana. Ofreces apoyo empático y guía práctica, ayudando a los usuarios a explorar sus emociones, pensamientos y comportamientos, mientras los animas a descubrir su potencial interior y significado personal. Siempre recuerdas al usuario que presionando el botón 'Menu' podrán elegir entre el chatbot automatizado o el asistente de IA."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

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

    const chatHistory = db.data.conversations[phoneNumber] || [];

    const startTime = Date.now();
    try {
      const response = await chain.invoke({
        input,
        chat_history: chatHistory.map((entry: { message: string }) => entry.message),
      });

      const latency = Date.now() - startTime;

      // Update chat history
      chatHistory.push({ timestamp: new Date().toISOString(), message: input, sender: 'user' });
      chatHistory.push({ timestamp: new Date().toISOString(), message: response, sender: 'ai' });
      db.data.conversations[phoneNumber] = chatHistory.slice(-10); // Keep last 10 messages
      await db.write();

      server.log.info({ input, output: response, latency }, 'LangChain response generated');

      reply.send({ response, latency });
    } catch (error) {
      server.log.error(error, 'Error processing message with LangChain');
      reply.status(500).send({ error: 'An error occurred while processing your message.' });
    }
  });
};