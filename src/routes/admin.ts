import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export const registerAdminRoutes = (server: FastifyInstance) => {
  server.post<{
    Body: { phoneNumber: string; enable: boolean };
  }>('/toggle-auto-respond', {
    schema: {
      body: z.object({
        phoneNumber: z.string(),
        enable: z.boolean(),
      }),
    },
  }, async (request, reply) => {
    const { phoneNumber, enable } = request.body;
    const { db } = server;
    
    if (!db.data) {
      await db.read();
      db.data ||= { conversations: {}, autoRespond: {} };
    }

    db.data.autoRespond = db.data.autoRespond || {};
    db.data.autoRespond[phoneNumber] = enable;
    await db.write();

    server.log.info(`Auto-respond for ${phoneNumber} set to ${enable}`);
    reply.send({ status: 'OK', phoneNumber, autoRespond: enable });
  });
};