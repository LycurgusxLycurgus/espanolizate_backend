import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ky from 'ky';

const whatsappApi = ky.create({
  prefixUrl: 'https://graph.facebook.com/v20.0/',
  headers: {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
            messages: Array<{
              from: string;
              text: { body: string };
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
                text: z.object({ body: z.string() }),
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
            await processIncomingMessage(server, message.from, message.text.body);
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

async function processIncomingMessage(server: FastifyInstance, from: string, text: string) {
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
Para seleccionar el plan  anual con el 50% de descuento, por un total de $59.99 USD al año
👇🏻Haz Click Aquí 👇🏻

🔗 https://pay.hotmart.com/V95372989N?off=j68zq7ud&checkoutMode=10 🔗
    `;
    await sendWhatsAppMessage(from, preFabMessage);
    server.log.info(`Auto-respond message sent to ${from}`);
  } else {
    const response = await server.inject({
      method: 'POST',
      url: '/generate',
      payload: { input: text, phoneNumber: from },
    });

    const { response: aiResponse } = await response.json();
    await sendWhatsAppMessage(from, aiResponse);
    server.log.info(`AI response sent to ${from}`);
  }
}

async function sendWhatsAppMessage(to: string, text: string) {
  await whatsappApi.post(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    json: {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
  });
}