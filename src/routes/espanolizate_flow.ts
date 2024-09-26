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
    message: `Bienvenido a www.españolizate.es 🇪🇸

Nos complace atenderle. ¿En qué podemos ayudarle? 👨🏽‍💻👩‍💻

Ofrecemos servicios especializados en:

• Obtención de nacionalidad española para descendientes de españoles 🇪🇸
• Oportunidades laborales en España para ciudadanos chilenos y peruanos 🇨🇱🇵🇪🇪🇸
• Trámites de nacionalidad española para ciudadanos chilenos y peruanos 🇨🇱🇵🇪🇪🇸

Nuestro equipo se especializa en asesorar, gestionar y representar a nuestros clientes, proporcionando soluciones integrales en procesos migratorios. 🎯

Ofrecemos servicios en Chile, Perú y España 🇨🇱🇵🇪🇪🇸

Su puerta de entrada legal a Europa 🇪🇺

Por favor, seleccione la opción que corresponda a su consulta:`,
    options: [
      { id: '1', title: 'Padres o Abuelos' }, // Título ajustado
      { id: '2', title: 'Trabajar en España' }, // 19 caracteres
      { id: '3', title: 'Obtener Nacionalidad' }, // 21 caracteres
      { id: '4', title: 'Estudios y Postgrados' }, // 22 caracteres
      { id: '5', title: 'Otros Servicios' }, // Título ajustado
      { id: '6', title: 'No Necesito Ayuda' }, // Título ajustado
    ],
  },
  step3: {
    message: `¿Podría indicarnos qué tipo de gestión específica necesita tramitar?`,
    options: [
      { id: '1', title: 'Nacionalidad por padre español', nextStep: 'step31' },
      { id: '2', title: 'Nacionalidad por abuelo español', nextStep: 'step31' },
      { id: '3', title: 'Reunificación familiar', nextStep: 'step31' },
      { id: '4', title: 'Otras gestiones relacionadas', nextStep: 'step31' },
    ],
  },
  step6: {
    message: `¿Qué tipo de trabajo en España le interesa?`,
    options: [
      { id: '1', title: 'Trabajo por cuenta propia', nextStep: 'step31' },
      { id: '2', title: 'Trabajo por cuenta ajena', nextStep: 'step31' },
      { id: '3', title: 'Profesional altamente cualificado', nextStep: 'step31' },
      { id: '4', title: 'Otras opciones laborales', nextStep: 'step31' },
    ],
  },
  step9: {
    message: `¿Qué tipo de trámite de nacionalidad española desea realizar?`,
    options: [
      { id: '1', title: 'Trámite individual', nextStep: 'step31' },
      { id: '2', title: 'Trámite familiar', nextStep: 'step31' },
    ],
  },
  step2: {
    message: `¿Qué tipo de estudios le interesan en España?`,
    options: [
      { id: '1', title: 'Estudios de pregrado', nextStep: 'step31' },
      { id: '2', title: 'Estudios de postgrado', nextStep: 'step31' },
      { id: '3', title: 'Información sobre becas', nextStep: 'step31' },
      { id: '4', title: 'Otros programas educativos', nextStep: 'step31' },
    ],
  },
  step34: {
    message: `¿Qué otro tipo de servicio está buscando?`,
    options: [
      { id: '1', title: 'Consultoría general', nextStep: 'step31' },
      { id: '2', title: 'Servicios específicos', nextStep: 'step31' },
      { id: '3', title: 'Otras consultas', nextStep: 'step31' },
    ],
  },
  step25: {
    message: `Entendido. Si en el futuro tiene alguna consulta, no dude en contactarnos. Estaremos encantados de ayudarle.`,
    final: true,
  },
  step31: {
    message: `Gracias por proporcionarnos esta información. Uno de nuestros asesores especializados se pondrá en contacto con usted a la brevedad.

Si su consulta es urgente, no dude en llamarnos directamente:

🇨🇱 Chile: +56 99 639 6692 
🇵🇪 Perú: +51 75 738 2990
🇪🇸 España: +34 660 592 796

Estamos aquí para ayudarle en su proceso migratorio. ¡Que tenga un excelente día!`,
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
