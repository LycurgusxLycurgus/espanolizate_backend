// src/routes/espanolizate_flow.ts

import { FastifyInstance } from 'fastify';
import { sendWhatsAppMessage, sendInteractiveList } from './whatsapp.js'; // Ensure the path is correct

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
    message: `Gracias por comunicarte con www.españolizate.es 🇪🇸🇪🇸🇪🇸🇪🇸

Por favor, haznos saber cómo te podemos colaborar. 👨🏽💻👩💻

¿Tienes Padres o Abuelos españoles y deseas obtener la nacionalidad Española? 🇪🇸💃🏻🇪🇸💃🏻🇪🇸

¿Eres Chileno o Peruano y deseas trabajar en España? 🇨🇱🇵🇪🇪🇸

¿Eres Chileno o Peruano y quieres obtener la nacionalidad Española? 🇨🇱🇵🇪🇪🇸

Nos encargamos de asesorar, gestionar y representar a nuestros clientes entregando soluciones en sus procesos migratorios. 🎯🎯🎯 🇪🇺🇪🇸🇨🇱🇵🇪🇪🇸🇪🇺

Asesoramos, Gestionamos y Tramitamos en todo Chile, Perú y España 🇨🇱🇵🇪🇪🇸. 

Tu entrada legal a Europa 🇪🇺🇪🇺🇪🇺

Por favor elige el número según corresponda su requerimiento:`,
    options: [
      { id: '1', title: 'PADRES O ABUELOS', nextStep: 'step3' },
      { id: '2', title: 'TRABAJAR EN ESPAÑA', nextStep: 'step6' },
      { id: '3', title: 'OBTENER NACIONALIDAD', nextStep: 'step9' },
      { id: '4', title: 'ESTUDIOS Y POSTGRADOS', nextStep: 'step2' },
      { id: '5', title: 'OTROS', nextStep: 'step34' },
      { id: '6', title: 'NO POR EL MOMENTO', nextStep: 'step25' },
    ],
  },
  step3: {
    message: `Puede indicarme qué tipo de gestión requiere tramitar?`,
    options: [
      { id: '1', title: 'PADRE', nextStep: 'step31' },
      { id: '2', title: 'ABUELO', nextStep: 'step31' },
      { id: '3', title: 'REUNIFICACIÓN FAMILIAR', nextStep: 'step31' },
      { id: '4', title: 'OTROS', nextStep: 'step31' },
    ],
  },
  step6: {
    message: `Puede indicarme qué tipo de gestión requiere tramitar?`,
    options: [
      { id: '1', title: 'CUENTA PROPIA', nextStep: 'step31' },
      { id: '2', title: 'CUENTA AJENA', nextStep: 'step31' },
      { id: '3', title: 'PROFESIONAL CALIFICADO', nextStep: 'step31' },
      { id: '4', title: 'OTRO', nextStep: 'step31' },
    ],
  },
  step9: {
    message: `Puede indicarme qué tipo de gestión requiere tramitar?`,
    options: [
      { id: '1', title: 'INDIVIDUAL', nextStep: 'step31' },
      { id: '2', title: 'FAMILIA', nextStep: 'step31' },
    ],
  },
  step2: {
    message: `Puede indicarme qué tipo de gestión requiere tramitar?`,
    options: [
      { id: '1', title: 'PREGRADO', nextStep: 'step31' },
      { id: '2', title: 'POSTGRADO', nextStep: 'step31' },
      { id: '3', title: 'BECAS', nextStep: 'step31' },
      { id: '4', title: 'OTROS', nextStep: 'step31' },
    ],
  },
  step34: {
    message: `Puede indicarme qué tipo de gestión requiere tramitar?`,
    options: [
      { id: '1', title: 'CONSULTORÍA GENERAL', nextStep: 'step31' },
      { id: '2', title: 'SERVICIOS ESPECÍFICOS', nextStep: 'step31' },
      { id: '3', title: 'OTROS', nextStep: 'step31' },
    ],
  },
  step25: {
    message: `Perfecto, si tiene alguna consulta no dude en contáctarnos.`,
    final: true,
  },
  step31: {
    message: `Muchas gracias por la información, uno de nuestros asesores le contactará en breve.

Si su consulta es muy urgente.
No dude en contactarnos al ☎️ 

🇨🇱 +56996396692 
🇵🇪 +51757382990
🇪🇸 +34660592796`,
    final: true,
  },
};

// Function to send a specific flow step to the user
async function sendFlowStep(to: string, step: FlowStep) {
  if (step.options && step.options.length > 0) {
    // Send interactive list
    await sendInteractiveList(
      to,
      step.message,
      step.options.map((option) => ({
        id: option.id,
        title: option.title,
      }))
    );
  } else {
    // Send text message
    await sendWhatsAppMessage(to, step.message);
  }
}

// Handler for Españolizate messages
export const handleEspanolizateMessage = async (
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

  // Initialize conversation state if not present
  if (!db.data.conversations[from]) {
    db.data.conversations[from] = { messages: [], state: null };
  }

  let userState = db.data.conversations[from].state || 'idle';

  // Start the flow when the user presses the 'Menu' button
  if (text === 'menu_button') {
    userState = 'step0';
    db.data.conversations[from].state = userState;
    await sendFlowStep(from, flow[userState]);
  } else if (userState && flow[userState]) {
    // User is in the flow
    const currentStep = flow[userState];
    const selectedOption = currentStep.options?.find((option) => option.id === text);

    if (selectedOption) {
      userState = selectedOption.nextStep || 'idle';
      db.data.conversations[from].state = userState;

      if (userState && flow[userState]) {
        const nextStep = flow[userState];
        await sendFlowStep(from, nextStep);
      } else {
        // Final message or undefined next step
        await sendWhatsAppMessage(
          from,
          "Gracias por tu interés. Nos pondremos en contacto contigo pronto."
        );
        db.data.conversations[from].state = null; // Reset state
      }
    } else {
      // Since using interactive lists, this block may not be reached.
      // However, keeping a generic fallback just in case.
      await sendWhatsAppMessage(
        from,
        "Parece que no has elegido una opción válida. Por favor, selecciona una opción de la lista."
      );
      await sendFlowStep(from, currentStep);
    }
  } else {
    // Default case: Process with existing chatbot logic
    const response = await server.inject({
      method: 'POST',
      url: '/generate',
      payload: { input: text, phoneNumber: from },
    });

    const { response: aiResponse } = await response.json();

    // Append the reminder to the response
    const reminder =
      "Recuerda que puedes presionar el botón 'Menu' para iniciar el proceso de incorporación una vez que se hayan respondido todas tus preguntas.";
    const finalResponse = `${reminder}\n\n${aiResponse}\n\n${reminder}`;

    await sendWhatsAppMessage(from, finalResponse, messageId, true); // Include 'Menu' button
  }

  await db.write();
};
