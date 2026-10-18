import type { PisaLocale } from './pisa-i18n';

export interface ModellingNode {
  id: 'formulate' | 'employ' | 'interpret';
  label: string;
  description: string;
}

export const MODELLING_CYCLE_NODES: Record<PisaLocale, Array<ModellingNode>> = {
  es: [
    {
      id: 'formulate',
      label: 'Formular',
      description: 'Identificar oportunidades matemáticas en un problema del mundo real y transformarlo en un modelo matemático.'
    },
    {
      id: 'employ',
      label: 'Emplear',
      description: 'Aplicar razonamiento, conceptos y procedimientos matemáticos para resolver el modelo matemático.'
    },
    {
      id: 'interpret',
      label: 'Interpretar',
      description: 'Reflexionar sobre las soluciones matemáticas en el contexto del problema original del mundo real.'
    }
  ],
  en: [
    {
      id: 'formulate',
      label: 'Formulate',
      description: 'Identify mathematical opportunities in a real-world problem and transform it into a mathematical model.'
    },
    {
      id: 'employ',
      label: 'Employ',
      description: 'Apply mathematical reasoning, concepts, and procedures to solve the mathematical model.'
    },
    {
      id: 'interpret',
      label: 'Interpret',
      description: 'Reflect upon mathematical solutions in the context of the original real-world problem.'
    }
  ],
  pt: [
    {
      id: 'formulate',
      label: 'Formular',
      description: 'Identificar oportunidades matemáticas em um problema do mundo real e transformá-lo em um modelo matemático.'
    },
    {
      id: 'employ',
      label: 'Empregar',
      description: 'Aplicar raciocínio, conceitos e procedimentos matemáticos para resolver o modelo matemático.'
    },
    {
      id: 'interpret',
      label: 'Interpretar',
      description: 'Refletir sobre as soluções matemáticas no contexto do problema original do mundo real.'
    }
  ]
};

export function modellingCycleLabels(locale: PisaLocale): Record<'formulate'|'employ'|'interpret', string> {
  const nodes = MODELLING_CYCLE_NODES[locale] ?? MODELLING_CYCLE_NODES['en'];
  const labels: Partial<Record<'formulate'|'employ'|'interpret', string>> = {};
  for (const node of nodes) {
    labels[node.id] = node.label;
  }
  return labels as Record<'formulate'|'employ'|'interpret', string>;
}
