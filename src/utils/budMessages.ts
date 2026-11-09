import { getCurrentAppLanguage } from '../context/SettingsContext';

export type FocusState =
  | 'ENFOQUE'
  | 'DISTRACCION'
  | 'ALERTA_SUAVE'
  | 'FATIGA'
  | 'PARALISIS'
  | 'AGOBIO_POSTURAL'
  | 'SOBREESTIMULACION'
  | 'CELEBRACION'
  | 'PAUSA'
  | 'ESTUDIO_NORMAL_/_NEUTRO'
  | 'ESTUDIO_NORMAL'
  | 'ENFOQUE_PROFUNDO_(FLOW)'
  | 'NORMAL_STUDY_/_NEUTRAL'
  | 'DEEP_FOCUS_(FLOW)'
  | 'DISTRACTION'
  | 'COGNITIVE_DISTRACTION'
  | 'FATIGUE'
  | 'EYE_FATIGUE_/_DROWSINESS'
  | 'OVERSTIMULATION'
  | 'POSTURAL_STRAIN';

interface BudContext {
  stepText?: string;
  distractionCount?: number;
  lang?: 'es' | 'en';
}

const extractCoreTarget = (stepText?: string, lang: 'es' | 'en' = 'es'): string => {
  if (!stepText) return lang === 'es' ? 'tu meta' : 'the goal';

  const quotedMatch = stepText.match(/['"“](.*?)['"”]/);
  if (quotedMatch && quotedMatch[1] && quotedMatch[1].length > 3) {
    let topic = quotedMatch[1].trim();
    topic = topic.replace(
      /^(study(ing)?\s+(for\s+my\s+|for\s+the\s+|for\s+|the\s+)?|estudiar\s+(para\s+el\s+|para\s+mi\s+|para\s+|el\s+)?)/i,
      ''
    );
    if (topic.length <= 26) return topic.toLowerCase();
    const cut = topic.substring(0, 24).lastIndexOf(' ');
    return (cut > 4 ? topic.substring(0, cut) : topic.substring(0, 24)).toLowerCase();
  }

  let clean = stepText
    .replace(/^(\d+(\.\d+)*\s*[-–—.:]?\s*|[•\-*]\s*|((STEP|PASO)\s*\d+\s*[-–—.:]?\s*))/i, '')
    .trim();
  clean = clean.replace(/^[A-ZÁÉÍÓÚÑ]+\s+/i, '').trim();

  const clauseIdx = clean.search(
    /(\s+(in order to|by|using|according to|while|para|resolviendo|mediante)\s+|,|\.)/i
  );
  if (clauseIdx !== -1 && clauseIdx > 5) {
    clean = clean.substring(0, clauseIdx).trim();
  }

  if (clean.length > 25) {
    const spaceIdx = clean.substring(0, 24).lastIndexOf(' ');
    clean = (spaceIdx > 4 ? clean.substring(0, spaceIdx) : clean.substring(0, 24)).trim();
  }

  clean = clean
    .replace(/\s+(and|or|of|to|with|in|on|for|by|the|a|an|from|at|y|o|de|del|en|con|por|el|la|los|las)$/i, '')
    .trim();

  return clean.replace(/[.,;:]+$/, '').trim().toLowerCase() || (lang === 'es' ? 'este paso' : 'this block');
};

export const getBudContextualMessage = (rawState: string, context: BudContext = {}): string => {
  const lang = context.lang || getCurrentAppLanguage();
  const normalized = (rawState || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_') as FocusState;

  const target = extractCoreTarget(context.stepText, lang);
  const count = context.distractionCount || 0;

  if (lang === 'es') {
    switch (normalized) {
      case 'POSTURAL_STRAIN':
      case 'AGOBIO_POSTURAL':
        return 'Notamos tensión postural. Relaja los hombros y respira profundo.';

      case 'OVERSTIMULATION':
      case 'SOBREESTIMULACION':
        return 'Mente sobrecargada. Hagamos una breve pausa para respirar.';

      case 'FATIGUE':
      case 'EYE_FATIGUE_/_DROWSINESS':
      case 'FATIGA':
        return 'Fatiga ocular detectada. Parpadea suave y toma aire.';

      case 'PARALISIS':
        return `Paso denso. Enfoquémonos solo en ${target}.`;

      case 'ALERTA_SUAVE':
      case 'DISTRACTION':
      case 'COGNITIVE_DISTRACTION':
      case 'DISTRACCION': {
        if (count > 1) {
          return `Paso a paso. Volvamos a centrarnos en: ${target}.`;
        }
        return `Seguimos aquí juntos. Regresemos a ${target}.`;
      }

      case 'NORMAL_STUDY_/_NEUTRAL':
      case 'ESTUDIO_NORMAL_/_NEUTRO':
      case 'ESTUDIO_NORMAL':
        return `Ritmo constante y claro. Avanzando en ${target}.`;

      case 'DEEP_FOCUS_(FLOW)':
      case 'ENFOQUE_PROFUNDO_(FLOW)':
      case 'ENFOQUE': {
        const focusTemplatesEs = [
          `Excelente ritmo. Avanzando con ${target}.`,
          `Concentración sólida. Seguimos en ${target}.`,
          `En sintonía total. Manteniendo el foco en ${target}.`
        ];
        return focusTemplatesEs[Math.floor(Math.random() * focusTemplatesEs.length)];
      }

      case 'CELEBRACION':
        return '¡Paso completado! Vamos juntos por el siguiente.';

      case 'PAUSA':
        return 'Pausa activa. Listo para cuando decidas continuar.';

      default:
        return `Enfoque activo. Continuando con ${target}.`;
    }
  }

  switch (normalized) {
    case 'POSTURAL_STRAIN':
    case 'AGOBIO_POSTURAL':
      return `Heavy posture tension. Let's drop our shoulders and breathe.`;

    case 'OVERSTIMULATION':
    case 'SOBREESTIMULACION':
      return `Mind feels overloaded. Let's take a quick breathing pause.`;

    case 'FATIGUE':
    case 'EYE_FATIGUE_/_DROWSINESS':
    case 'FATIGA':
      return `Fatigue detected. Let's blink slowly and take a breath.`;

    case 'PARALISIS':
      return `Dense step. Let's focus strictly on ${target}.`;

    case 'ALERTA_SUAVE':
    case 'DISTRACTION':
    case 'COGNITIVE_DISTRACTION':
    case 'DISTRACCION': {
      if (count > 1) {
        return `Step by step. Let's narrow in on: ${target}.`;
      }
      return `Still here together. Let's return to ${target}.`;
    }

    case 'NORMAL_STUDY_/_NEUTRAL':
    case 'ESTUDIO_NORMAL_/_NEUTRO':
    case 'ESTUDIO_NORMAL': {
      return `Steady, clear pace. Staying focused on ${target}.`;
    }

    case 'DEEP_FOCUS_(FLOW)':
    case 'ENFOQUE_PROFUNDO_(FLOW)':
    case 'ENFOQUE': {
      const focusTemplates = [
        `Great rhythm. Keeping up with ${target}.`,
        `Solid concentration. Continuing with ${target}.`,
        `Locked in together. Staying on ${target}.`
      ];
      return focusTemplates[Math.floor(Math.random() * focusTemplates.length)];
    }

    case 'CELEBRACION':
      return `Step complete! Let's tackle the next one together.`;

    case 'PAUSA':
      return `Active pause. Ready whenever you choose to resume.`;

    default:
      return `Active focus. Continuing with ${target}.`;
  }
};
