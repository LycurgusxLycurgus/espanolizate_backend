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
    const trimmedMessage = trimMessage(preFabMessage, 1000); // Trim to 1000 characters
    await sendWhatsAppMessage(from, trimmedMessage, messageId);
    server.log.info(`Auto-respond message sent to ${from}`);
  } else if (text === 'menu' || text === 'menu_button') {
    await sendInteractiveList(from, 'Por favor, elige una opción:', [
      { id: '1', title: 'Padres o Abuelos' }, // Título ajustado
      { id: '2', title: 'Trabajar en España' },
      { id: '3', title: 'Obtener Nacionalidad' },
      { id: '4', title: 'Estudios y Postgrados' },
      { id: '5', title: 'Otros Servicios' }, // Título ajustado
      { id: '6', title: 'No Necesito Ayuda' }, // Título ajustado
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

    const trimmedAiResponse = trimMessage(aiResponse, 1000); // Trim to 1000 characters
    const finalResponse = `${trimmedAiResponse}\n\n---------------------\n\nPuedes presionar el botón 'Menu' para iniciar el proceso de incorporación una vez que se hayan respondido todas tus preguntas.`;

    await sendWhatsAppMessage(from, finalResponse, messageId, true); // Set includeButton to true
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
    const trimmedText = trimMessage(text, 1000); // Trim text to 1000 characters
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: trimmedText
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'menu_button',
                title: 'Menu'
              }
            }
          ]
        }
      }
    };
  } else {
    const trimmedText = trimMessage(text, 1024); // Trim text to 1024 characters
    messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: trimmedText
      }
    };
  }

  if (messageId) {
    messageBody.context = { message_id: messageId };
  }

  try {
    const response = await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      json: messageBody
    });
    console.log('WhatsApp API Response:', await response.json());
  } catch (error: unknown) {
    console.error('Error sending WhatsApp message:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const errorWithResponse = error as { response: { text: () => Promise<string> } };
      try {
        const errorText = await errorWithResponse.response.text();
        console.error('Error response:', errorText);
      } catch (textError) {
        console.error('Error getting response text:', textError);
      }
    }
  }
}

// Helper function to trim messages to a specific length
function trimMessage(message: string, maxLength: number): string {
  if (message.length > maxLength) {
    console.warn(`Message exceeded ${maxLength} characters and was trimmed.`);
    return message.substring(0, maxLength - 3) + '...';
  }
  return message;
}

// Function to send an interactive list
export async function sendInteractiveList(
  to: string,
  text: string,
  options: Array<{ id: string; title: string }>
) {
  // Validar y sanitizar los títulos
  const sanitizedOptions = options.map(option => ({
    id: option.id,
    title: validateTitle(option.title),
    description: 'Descripción si es necesaria', // Opcional
  }));

  const trimmedText = trimMessage(text, 1024); // Ensure text is within limit

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
        text: trimmedText,
      },
      footer: {
        text: 'Selecciona una opción de la lista',
      },
      action: {
        button: 'Seleccionar',
        sections: [
          {
            title: 'Opciones',
            rows: sanitizedOptions,
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

// Helper function para validar títulos
function validateTitle(title: string): string {
  return title.length > 24 ? title.substring(0, 24) : title;
}
