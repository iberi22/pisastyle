import type { PisaLocale } from './pisa-i18n';

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
}

export const ONBOARDING_STEPS: Record<PisaLocale, OnboardingStep[]> = {
  es: [
    {
      id: 'no-account',
      title: 'Uso sin registro',
      body: 'Puedes empezar a usar PISAStyle sin registro ni correo electrónico. Tu aprendizaje empieza al instante.'
    },
    {
      id: 'on-device',
      title: 'Privacidad local',
      body: 'Tus respuestas y progreso se guardan localmente en tu navegador. Nosotros no tenemos acceso a tus datos de estudio.'
    },
    {
      id: 'local-ai',
      title: 'Asistente IA integrado',
      body: 'El modelo de IA corre en tu navegador cuando está soportado, sin límites de nube, complementando tu estudio de manera eficiente.'
    },
    {
      id: 'device-lock',
      title: 'Protege tu avance',
      body: 'Próximamente podrás proteger tu sesión de estudio usando el PIN o biometría de tu dispositivo.'
    },
    {
      id: 'own-your-data',
      title: 'Exporta tu progreso',
      body: 'Puedes descargar todos tus datos en cualquier momento para mantener el control total sobre tu información.'
    }
  ],
  en: [
    {
      id: 'no-account',
      title: 'Use with no sign-up',
      body: 'You can start using PISAStyle with no sign-up and no email required. Your learning begins instantly.'
    },
    {
      id: 'on-device',
      title: 'Local Privacy',
      body: 'Your answers and progress are saved locally in your browser. We do not have access to your study data.'
    },
    {
      id: 'local-ai',
      title: 'Built-in AI Assistant',
      body: 'The AI model runs in your browser when supported, with no cloud limits, complementing your study efficiently.'
    },
    {
      id: 'device-lock',
      title: 'Protect your progress',
      body: 'Coming soon, you will be able to protect your study session using your device PIN or biometric authentication.'
    },
    {
      id: 'own-your-data',
      title: 'Export your data',
      body: 'You can download all your data at any time to keep full control over your information.'
    }
  ],
  pt: [
    {
      id: 'no-account',
      title: 'Uso sem cadastro',
      body: 'Você pode começar a usar o PISAStyle sem cadastro e sem e-mail. Seu aprendizado começa instantaneamente.'
    },
    {
      id: 'on-device',
      title: 'Privacidade local',
      body: 'Suas respostas e progresso são salvos localmente no seu navegador. Nós não temos acesso aos seus dados de estudo.'
    },
    {
      id: 'local-ai',
      title: 'Assistente de IA integrado',
      body: 'O modelo de IA roda no seu navegador quando suportado, sem limites de nuvem, complementando seu estudo eficientemente.'
    },
    {
      id: 'device-lock',
      title: 'Proteja seu avanço',
      body: 'Em breve, você poderá proteger sua sessão de estudo usando o PIN ou biometria do seu dispositivo.'
    },
    {
      id: 'own-your-data',
      title: 'Exporte seu progresso',
      body: 'Você pode baixar todos os seus dados a qualquer momento para manter controle total sobre sua informação.'
    }
  ]
};

export function onboardingStepIds(locale: PisaLocale): string[] {
  return ONBOARDING_STEPS[locale].map(step => step.id);
}
