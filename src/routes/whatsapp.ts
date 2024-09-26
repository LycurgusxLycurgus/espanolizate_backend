// src/routes/whatsapp.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ky from 'ky';
import { handleEspanolizateMessage } from './espanolizate_flow.js'; // Ensure correct path

const whatsappApi = ky.create({
  prefixUrl: 'https://graph.facebook.com/v20.0/',
  headers: {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export const registerWhatsAppRoutes = (server: FastifyInstance) => {
  server.post<{
    Body: {
      object: string;
      entry: Array<{
        changes: Array<{
          value: {
            messages?: Array<any>; // Made messages optional
            statuses?: Array<any>; // Optional: handle statuses if needed
          };
        }>;
      }>;
    };
  }>('/webhook', {
    schema: {
      body: z.object({
        object: z.string(),
        entry: z.array(
          z.object({
            changes: z.array(
              z.object({
                value: z.object({
                  messages: z.array(z.any()).optional(), // Made messages optional
                  statuses: z.array(z.any()).optional(),
                }),
              })
            ),
          })
        ),
      }),
    },
  }, async (request, reply) => {
    const { body } = request;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.value.messages) {
            for (const message of change.value.messages) {
              await processIncomingMessage(server, message);
            }
          } else if (change.value.statuses) {
            // Optional: handle statuses if needed
            server.log.info('Received status update:', change.value.statuses);
          }
        }
      }
    }

    reply.send({ status: 'OK' });
  });

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
};

// Function to process incoming messages
async function processIncomingMessage(server: FastifyInstance, message: any) {
  const from = message.from;
  const messageId = message.id;
  let text = '';

  if (message.type === 'text') {
    text = message.text.body;
  } else if (message.type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      text = message.interactive.button_reply.id;
    } else if (message.interactive.type === 'list_reply') {
      text = message.interactive.list_reply.id;
    }
    // Handle other interactive types if necessary
  } else {
    // Handle other message types if necessary
    server.log.info(`Received unsupported message type: ${message.type}`);
    return;
  }

  // Route the message to the Españolizate flow handler
  await handleEspanolizateMessage(server, from, text, messageId);
}

// Function to handle sending messages and interactive lists
async function handleMessageText(server: FastifyInstance, from: string, text: string, messageId: string) {
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
    await sendWhatsAppMessage(from, preFabMessage, messageId);
    server.log.info(`Auto-respond message sent to ${from}`);
  } else if (text === 'menu' || text === 'menu_button') {
    await sendInteractiveList(from, 'Por favor, elige una opción:', [
      { id: '1', title: 'PADRES O ABUELOS' },
      { id: '2', title: 'TRABAJAR EN ESPAÑA' },
      { id: '3', title: 'OBTENER NACIONALIDAD' },
      { id: '4', title: 'ESTUDIOS Y POSTGRADOS' },
      { id: '5', title: 'OTROS' },
      { id: '6', title: 'NO POR EL MOMENTO' },
    ]);
    server.log.info(`Interactive list sent to ${from}`);
  } else {
    // Default case: Process the message with LangChain
    const response = await server.inject({
      method: 'POST',
      url: '/generate',
      payload: { input: text, phoneNumber: from },
    });

    const { response: aiResponse } = await response.json();
    await sendWhatsAppMessage(from, aiResponse, messageId, true); // Set includeButton to true
    server.log.info(`AI response sent to ${from}`);
  }
}

// Function to send a text message
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  messageId?: string,
  includeButton: boolean = false
) {
  let messageBody: any;

  if (includeButton) {
    messageBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text,
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'menu_button',
                title: 'Menu',
              },
            },
          ],
        },
      },
    };
  } else {
    messageBody = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: text,
      },
    };
  }

  if (messageId) {
    messageBody.context = { message_id: messageId };
  }

  try {
    await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      json: messageBody,
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

// Function to send an interactive list
export async function sendInteractiveList(
  to: string,
  text: string,
  options: Array<{ id: string; title: string }>
) {
  const messageBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: 'Elige una opción',
      },
      body: {
        text,
      },
      footer: {
        text: 'Selecciona una opción de la lista',
      },
      action: {
        button: 'Seleccionar',
        sections: [
          {
            title: 'Opciones',
            rows: options.map((option) => ({
              id: option.id,
              title: option.title,
              description: 'Descripción si es necesaria', // Optional: You can customize or remove this
            })),
          },
        ],
      },
    },
  };

  try {
    await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      json: messageBody,
    });
  } catch (error) {
    console.error('Error sending interactive list:', error);
  }
}
