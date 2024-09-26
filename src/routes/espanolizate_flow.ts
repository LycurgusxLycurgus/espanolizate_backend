// src/routes/espanolizate_flow.ts

import { FastifyInstance } from 'fastify';
import { sendWhatsAppMessage, sendInteractiveList } from './whatsapp.js';

// Define interfaces for flow options and steps
interface FlowOption {
  id: string;
  title: string;
  nextStep?: string;
}

interface FlowStep {
  message: string;
  options?: FlowOption[];
  final?: boolean;
}

// Define the flow steps
const flow: Record<string, FlowStep> = {
  step0: {
    message: `
Gracias por comunicarte con www.españolizate.es 🇪🇸🇪🇸🇪🇸🇪🇸

Por favor, haznos saber cómo te podemos colaborar. 👨🏽💻👩💻

¿Tienes Padres o Abuelos españoles y deseas obtener la nacionalidad Española? 🇪🇸💃🏻🇪🇸💃🏻🇪🇸

¿Eres Chileno o Peruano y deseas trabajar en España? 🇨🇱🇵🇪🇪🇸

¿Eres Chileno o Peruano y quieres obtener la nacionalidad Española? 🇨🇱🇵🇪🇪🇸

Nos encargamos de asesorar, gestionar y representar a nuestros clientes entregando soluciones en sus procesos migratorios. 🎯🎯🎯 🇪🇺🇪🇸🇨🇱🇵🇪🇪🇸🇪🇺

Asesoramos, Gestionamos y Tramitamos en todo Chile, Perú y España 🇨🇱🇵🇪🇪🇸. 

Tú entrada legal a Europa 🇪🇺🇪🇺🇪🇺

Por favor elige el número según corresponda su requerimiento:
    `,
    options: [
      { id: '1', title: '1️⃣ PADRES O ABUELOS', nextStep: 'step3' },
      { id: '2', title: '2️⃣ TRABAJAR EN ESPAÑA', nextStep: 'step6' },
      { id: '3', title: '3️⃣ OBTENER NACIONALIDAD', nextStep: 'step9' },
      { id: '4', title: '4️⃣ ESTUDIOS Y POSTGRADOS', nextStep: 'step2' },
      { id: '5', title: '5️⃣ OTROS', nextStep: 'step34' },
      { id: '6', title: '6️⃣ NO POR EL MOMENTO', nextStep: 'step25' },
    ],
  },
  step2: {
    message: `
Puede indicarme que tipo de gestión requiere tramitar?

1️⃣ PREGRADO
2️⃣ POSTGRADO
3️⃣ BECAS
4️⃣ OTROS
    `,
    options: [
      { id: '1', title: '1️⃣ PREGRADO' },
      { id: '2', title: '2️⃣ POSTGRADO' },
      { id: '3', title: '3️⃣ BECAS' },
      { id: '4', title: '4️⃣ OTROS', nextStep: 'step34' },
    ],
  },
  step3: {
    message: `
Puede indicarme que tipo de gestión requiere tramitar?

1️⃣ PADRE
2️⃣ ABUELO
3️⃣ REUNIFICACIÓN FAMILIAR
4️⃣ OTROS
    `,
    options: [
      { id: '1', title: '1️⃣ PADRE' },
      { id: '2', title: '2️⃣ ABUELO' },
      { id: '3', title: '3️⃣ REUNIFICACIÓN FAMILIAR' },
      { id: '4', title: '4️⃣ OTROS', nextStep: 'step34' },
    ],
  },
  step6: {
    message: `
Puede indicarme que tipo de gestión requiere tramitar?

1️⃣ CUENTA PROPIA
2️⃣ CUENTA AJENA
3️⃣ PROFESIONAL CALIFICADO
4️⃣ OTRO
    `,
    options: [
      { id: '1', title: '1️⃣ CUENTA PROPIA' },
      { id: '2', title: '2️⃣ CUENTA AJENA' },
      { id: '3', title: '3️⃣ PROFESIONAL CALIFICADO' },
      { id: '4', title: '4️⃣ OTRO', nextStep: 'step34' },
    ],
  },
  step9: {
    message: `
Puede indicarme que tipo de gestión requiere tramitar?

1️⃣ INDIVIDUAL
2️⃣ FAMILIA
    `,
    options: [
      { id: '1', title: '1️⃣ INDIVIDUAL' },
      { id: '2', title: '2️⃣ FAMILIA' },
    ],
  },
  step25: {
    message: `
Perfecto, si tiene alguna consulta no dude en contáctarnos
    `,
    final: true,
  },
  step34: {
    message: `
Por favor, proporciona más detalles sobre tu requerimiento.
    `,
    options: [
      // You can define sub-options or prompt for free text here
    ],
  },
  step35: {
    message: `
Parece que no haz elegido ninguna de las opciones. Por favor elige el número según corresponda su requerimiento:

1️⃣ PADRES O ABUELOS
2️⃣ TRABAJAR EN ESPAÑA
3️⃣ OBTENER NACIONALIDAD
4️⃣ ESTUDIOS Y POSTGRADOS
5️⃣ OTROS
6️⃣ NO POR EL MOMENTO
    `,
    options: [
      { id: '1', title: '1️⃣ PADRES O ABUELOS', nextStep: 'step3' },
      { id: '2', title: '2️⃣ TRABAJAR EN ESPAÑA', nextStep: 'step6' },
      { id: '3', title: '3️⃣ OBTENER NACIONALIDAD', nextStep: 'step9' },
      { id: '4', title: '4️⃣ ESTUDIOS Y POSTGRADOS', nextStep: 'step2' },
      { id: '5', title: '5️⃣ OTROS', nextStep: 'step34' },
      { id: '6', title: '6️⃣ NO POR EL MOMENTO', nextStep: 'step25' },
    ],
  },
  step12: {
    message: `
{{contact.first_name}}, Muchas gracias gestionaré, para que uno de nuestros asesores legales le contacte a la brevedad, le gustaría ser contactado hoy?
    `,
    options: [
      { id: '29', title: 'Sí' },
      { id: '30', title: 'No' },
    ],
  },
  step29: {
    message: `
Muchas gracias, por favor indicarme el nombre de la persona de contacto
    `,
    // Here you might want to handle free text input
  },
  step39: {
    message: `
Parece que ese no es un nombre válido, por favor indicanos el nombre de la persona de contacto
    `,
  },
  step31: {
    message: `
Muchas gracias por la información, uno de nuestros asesores le contará, a la brevedad.

Si su consulta es muy urgente. 
No dude en contactarnos al ☎️ 

🇨🇱 +56996396692 
🇵🇪 +51757382990
🇪🇸 +34660592796 
    `,
    final: true,
  },
};

// Handler function for Españolizate flow
export const handleEspanolizateFlow = async (
  server: FastifyInstance,
  from: string,
  text: string,
  messageId: string
) => {
  const { db } = server;

  if (!db.data) {
    await db.read();
    db.data ||= { conversations: {}, autoRespond: {} };
  }

  db.data.conversations[from] = db.data.conversations[from] || { messages: [], state: null };
  let userState = db.data.conversations[from].state || 'idle';

  if (userState === 'idle' && text === 'menu_button') {
    userState = 'step0';
    db.data.conversations[from].state = userState;
    await sendFlowStep(from, flow[userState]);
  } else if (userState && flow[userState]) {
    const currentStep = flow[userState];

    if (currentStep.options && currentStep.options.length > 0) {
      const selectedOption = currentStep.options.find(option => option.id === text);

      if (selectedOption) {
        userState = selectedOption.nextStep || 'step12'; // Default next step after selection
        db.data.conversations[from].state = userState;

        if (userState && flow[userState]) {
          await sendFlowStep(from, flow[userState]);
        } else {
          // Final message or undefined next step
          await sendWhatsAppMessage(from, "Gracias por tu interés. Nos pondremos en contacto contigo pronto.");
          db.data.conversations[from].state = null; // Reset state
        }
      } else {
        // Invalid selection
        await sendWhatsAppMessage(from, "Parece que no has elegido una opción válida. Por favor, selecciona una opción de la lista.");
        await sendFlowStep(from, currentStep);
      }
    } else if (currentStep.final) {
      // Handle final steps
      db.data.conversations[from].state = null; // Reset state
    } else {
      // Handle free text or undefined options
      // For simplicity, we'll assume free text leads to step12
      userState = 'step12';
      db.data.conversations[from].state = userState;
      await sendFlowStep(from, flow[userState]);
    }
  } else {
    // Not in Españolizate flow, handle with existing logic or ignore
    // You can choose to invoke the default handler or do nothing
    // For example:
    // await handleDefaultFlow(server, from, text, messageId);
    // Here, we'll reset the state
    db.data.conversations[from].state = null;
    await db.write();
    return;
  }

  await db.write();
};

// Function to send a specific flow step to the user
async function sendFlowStep(to: string, step: FlowStep) {
  if (step.options && step.options.length > 0) {
    // Send interactive list
    await sendInteractiveList(
      to,
      step.message,
      step.options.map(option => ({
        id: option.id,
        title: option.title,
      }))
    );
  } else {
    // Send text message
    await sendWhatsAppMessage(to, step.message);
  }
}
