// src/index.ts

import fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from 'dotenv';
import { join } from 'path';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { registerWhatsAppRoutes } from './routes/whatsapp.js';
import { registerLangChainRoutes } from './routes/langchain.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerConversationRoutes } from './routes/conversation.js';

// Initialize environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the structure of the database
type Conversation = {
  messages: Array<{
    timestamp: string;
    message: string;
    sender: 'user' | 'ai';
  }>;
  state: string | null;
};

type Database = {
  conversations: Record<string, Conversation>;
  autoRespond: Record<string, boolean>;
};

// Initialize lowdb with the updated schema
const dbFile = join(__dirname, 'db.json');
const adapter = new JSONFile<Database>(dbFile);
const defaultData: Database = { conversations: {}, autoRespond: {} };
const db = new Low<Database>(adapter, defaultData);

// Initialize Fastify with Zod type provider and pino config
const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
})
  .setValidatorCompiler(validatorCompiler)
  .setSerializerCompiler(serializerCompiler)
  .withTypeProvider<ZodTypeProvider>();

// Register plugins
server.register(sensible);
server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/public/',
});

// Extend FastifyInstance type to include db
declare module 'fastify' {
  interface FastifyInstance {
    db: Low<Database>;
  }
}

// Make db accessible to all routes
server.decorate('db', db);

// Register routes
registerWhatsAppRoutes(server);
registerLangChainRoutes(server);
registerAdminRoutes(server);
registerConversationRoutes(server);

// Start the server
const start = async () => {
  try {
    await db.read();
    db.data ||= { conversations: {}, autoRespond: {} };
    const port = process.env.PORT || 3000;
    await server.listen({ port: Number(port), host: '0.0.0.0' });
    server.log.info(`Server is running on http://0.0.0.0:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
