// src/routes/whatsapp.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ky from 'ky';

// Initialize WhatsApp API with Ky
const whatsappApi = ky.create({
  prefixUrl: 'https://graph.facebook.com/v20.0/',
  headers: {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export const registerWhatsAppRoutes = (server: FastifyInstance) => {
  /**
   * POST /webhook
   * Handles incoming messages from WhatsApp.
   */
  server.post<{
    Body: {
      object: string;
      entry: Array<{
        changes: Array<{
          value: {
            messages: Array<{
              from: string;
              type: string;
              text?: { body: string };
              interactive?: {
                type: string;
                button_reply?: {
                  id: string;
                  title: string;
                  payload: string;
                };
                list_reply?: {
                  id: string;
                  title: string;
                  description?: string;
                };
              };
              id: string;
            }>;
          };
        }>;
      }>;
    };
  }>('/webhook', {
    schema: {
      body: z.object({
        object: z.string(),
        entry: z.array(z.object({
          changes: z.array(z.object({
            value: z.object({
              messages: z.array(z.object({
                from: z.string(),
                type: z.string(),
                text: z.object({ body: z.string() }).optional(),
                interactive: z.object({
                  type: z.string(),
                  button_reply: z.object({
                    id: z.string(),
                    title: z.string(),
                    payload: z.string(),
                  }).optional(),
                  list_reply: z.object({
                    id: z.string(),
                    title: z.string(),
                    description: z.string().optional(),
                  }).optional(),
                }).optional(),
                id: z.string(),
              })),
            }),
          })),
        })),
      }),
    },
  }, async (request, reply) => {
    const { body } = request;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          for (const message of change.value.messages) {
            let messageText = '';

            // Handle Text Messages
            if (message.type === 'text' && message.text && message.text.body) {
              messageText = message.text.body;
            }
            // Handle Interactive Messages
            else if (message.type === 'interactive' && message.interactive) {
              if (message.interactive.type === 'button_reply' && message.interactive.button_reply) {
                messageText = message.interactive.button_reply.payload;
              } else if (message.interactive.type === 'list_reply' && message.interactive.list_reply) {
                // Use the row ID from the list reply
                messageText = message.interactive.list_reply.id;
              }
            }

            // Process the incoming message with the extracted text
            await processIncomingMessage(server, message.from, messageText, message.id);
          }
        }
      }
    }

    reply.send({ status: 'OK' });
  });

  /**
   * GET /webhook
   * Handles webhook verification.
   */
  server.get<{
    Querystring: {
      'hub.mode': string;
      'hub.verify_token': string;
      'hub.challenge': string;
    };
  }>('/webhook', {
    schema: {
      querystring: z.object({
        'hub.mode': z.string(),
        'hub.verify_token': z.string(),
        'hub.challenge': z.string(),
      }),
    },
  }, (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = request.query;

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      reply.send(challenge);
    } else {
      reply.code(403).send('Forbidden');
    }
  });

  /**
   * Processes incoming messages from WhatsApp.
   * @param server - Fastify instance.
   * @param from - Sender's phone number.
   * @param text - Message text or payload.
   * @param messageId - ID of the received message.
   */
  async function processIncomingMessage(server: FastifyInstance, from: string, text: string, messageId: string) {
    const { db } = server;

    if (!db.data) {
      await db.read();
      db.data ||= { conversations: {}, autoRespond: {} };
    }

    const isAutoRespond = db.data.autoRespond[from] || false;

    if (isAutoRespond) {
      const preFabMessage = `
Este servicio tiene un costo mensual de solo $9.99 USD, lo que te da acceso completo a las funciones 24/7 de apoyo y acompañamiento emocional.
Sin embargo, si prefieres hacer un pago anual, tenemos una promoción del 50% de descuento. 

Esto significa que el pago por todo el año sería solo $59.99 USD, ahorrándote un total de $60 USD durante el año completo.

Para seleccionar el plan mensual de $9.99 USD al mes.
👇🏻Haz Click Aquí 👇🏻

🔗 https://pay.hotmart.com/V95372989N?off=8v2fi8ts&checkoutMode=10 🔗
----------------------------------
Para seleccionar el plan anual con el 50% de descuento, por un total de $59.99 USD al año
👇🏻Haz Click Aquí 👇🏻

🔗 https://pay.hotmart.com/V95372989N?off=j68zq7ud&checkoutMode=10 🔗
      `;
      await sendWhatsAppMessage(server, from, preFabMessage, messageId);
      server.log.info(`Auto-respond message sent to ${from}`);
    } 
    else if (text.toLowerCase() === 'menu') {
      await sendInteractiveList(server, from, 'Please choose an option:', ['Chatbot', 'Assistant']);
      server.log.info(`Interactive list sent to ${from}`);
    } 
    else if (text.startsWith('option_')) {
      // Handle Interactive List Option Selections
      const selectedOption = text.split('_')[1]; // e.g., '1' from 'option_1'

      if (selectedOption === '1') {
        // Handle 'Chatbot' selection
        await sendWhatsAppMessage(server, from, 'You selected Chatbot.', messageId);
        server.log.info(`User ${from} selected Chatbot`);
      } else if (selectedOption === '2') {
        // Handle 'Assistant' selection
        await sendWhatsAppMessage(server, from, 'You selected Assistant.', messageId);
        server.log.info(`User ${from} selected Assistant`);
      } else {
        await sendWhatsAppMessage(server, from, 'Invalid selection. Please try again.', messageId);
        server.log.info(`User ${from} made an invalid selection: ${selectedOption}`);
      }
    } 
    else {
      // Handle AI response
      try {
        const response = await server.inject({
          method: 'POST',
          url: '/generate',
          payload: { input: text, phoneNumber: from },
        });

        const aiResponse = (await response.json()).response;
        await sendWhatsAppMessage(server, from, aiResponse, messageId);
        server.log.info(`AI response sent to ${from}`);
      } catch (error) {
        server.log.error(error, `Error generating AI response for ${from}`);
        await sendWhatsAppMessage(server, from, 'An error occurred while processing your message.', messageId);
      }
    }
  }

  /**
   * Sends a WhatsApp interactive button message (Quick Reply).
   * @param server - Fastify instance.
   * @param to - Recipient's phone number.
   * @param text - Message text.
   * @param messageId - ID of the received message (optional).
   */
  async function sendWhatsAppMessage(server: FastifyInstance, to: string, text: string, messageId?: string) {
    const messageBody: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'menu', // Payload set to 'menu'
                title: 'Menu'
              }
            }
          ]
        }
      }
    };

    if (messageId) {
      messageBody.context = { message_id: messageId };
    }

    try {
      await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        json: messageBody,
      });
      server.log.info(`Sent WhatsApp message to ${to}`);
    } catch (error) {
      server.log.error(error, `Failed to send WhatsApp message to ${to}`);
    }
  }

  /**
   * Sends a WhatsApp interactive list message.
   * @param server - Fastify instance.
   * @param to - Recipient's phone number.
   * @param text - Message body text.
   * @param options - List options.
   */
  async function sendInteractiveList(server: FastifyInstance, to: string, text: string, options: string[]) {
    const messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Choose an option',
        },
        body: {
          text,
        },
        footer: {
          text: 'Please select one of the options below.'
        },
        action: {
          button: 'Select',
          sections: [
            {
              title: 'Options',
              rows: options.map((option, index) => ({
                id: `option_${index + 1}`, // e.g., 'option_1', 'option_2'
                title: option,
                description: `Select ${option}`
              })),
            },
          ],
        }
      }
    };

    try {
      await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        json: messageBody,
      });
      server.log.info(`Sent interactive list to ${to}`);
    } catch (error) {
      server.log.error(error, `Failed to send interactive list to ${to}`);
    }
  }
};
