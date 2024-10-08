// src/routes/conversation.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Define the Conversation type as per index.ts
type Conversation = {
  messages: Array<{
    timestamp: string;
    message: string;
    sender: 'user' | 'ai';
  }>;
  state: string | null;
};

export const registerConversationRoutes = (server: FastifyInstance) => {
  server.get<{
    Params: { phoneNumber: string };
  }>('/conversations/:phoneNumber', {
    schema: {
      params: z.object({
        phoneNumber: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { phoneNumber } = request.params;
    const { db } = server;

    if (!db.data) {
      await db.read();
      db.data ||= { conversations: {}, autoRespond: {} };
    }

    const conversation: Conversation = db.data.conversations[phoneNumber] || { messages: [], state: null };
    reply.send(conversation);
  });

  server.post<{
    Params: { phoneNumber: string };
    Body: { message: string };
  }>('/conversations/:phoneNumber', {
    schema: {
      params: z.object({
        phoneNumber: z.string(),
      }),
      body: z.object({
        message: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { phoneNumber } = request.params;
    const { message } = request.body;
    const { db } = server;

    if (!db.data) {
      throw new Error('Database not initialized');
    }

    if (!db.data.conversations[phoneNumber]) {
      db.data.conversations[phoneNumber] = { messages: [], state: null };
    }

    db.data.conversations[phoneNumber].messages.push({
      timestamp: new Date().toISOString(),
      message,
      sender: 'user',
    });
    await db.write();

    server.log.info(`New message added for ${phoneNumber}`);
    reply.send({ status: 'OK' });
  });
};
