export type FocusState = 'ENFOQUE' | 'ALERTA_SUAVE' | 'FATIGA' | 'PARALISIS' | 'CELEBRACION' | 'PAUSA';

export interface AudioConfig {
  frequency: number;
  type: 'sine' | 'triangle';
  duration: number;
  cooldown: number;
}

export interface StateAvatarConfig {
  messages: string[];
  audioConfig: AudioConfig;
}

export const AVATAR_CONFIG: Record<FocusState, StateAvatarConfig> = {
  ENFOQUE: {
    messages: [
      "We are moving forward together at a steady pace.",
      "Staying locked in on this micro-step.",
      "Right here with you. Keeping our focus sharp.",
      "Great rhythm. One step at a time.",
      "We are in the zone. Let's keep going.",
    ],
    audioConfig: {
      frequency: 440,
      type: 'sine',
      duration: 0.25,
      cooldown: 60000,
    },
  },
  ALERTA_SUAVE: {
    messages: [
      "Let's ease back toward our goal.",
      "No rush: let's pick up right where we left off.",
      "Reconnecting with the active micro-step.",
      "Take a breath and return to your flow.",
      "Right here with you. Eyes back on the goal.",
    ],
    audioConfig: {
      frequency: 528,
      type: 'sine',
      duration: 0.3,
      cooldown: 45000,
    },
  },
  FATIGA: {
    messages: [
      "Sensing fatigue. Let's take a gentle breath.",
      "Blinking and hydrating is progress too.",
      "Let's ease the pace for a few seconds.",
      "Protecting your energy. Moving at our own rhythm.",
      "Quick breather to recharge clarity.",
    ],
    audioConfig: {
      frequency: 330,
      type: 'triangle',
      duration: 0.5,
      cooldown: 60000,
    },
  },
  PARALISIS: {
    messages: [
      "No rush at all. Just make the first click.",
      "Let's simplify: focus on a single tiny action.",
      "Right here with you. Moving forward with zero pressure.",
      "Break inertia with the smallest possible step.",
      "Zero pressure. We advance whenever you are ready.",
    ],
    audioConfig: {
      frequency: 261.63,
      type: 'sine',
      duration: 0.7,
      cooldown: 45000,
    },
  },
  CELEBRACION: {
    messages: [
      "Great job! Onward to the next step.",
      "One step down! Feel that momentum.",
      "Nailed it! Moving forward with confidence.",
      "Awesome work! Stacking up wins.",
      "Step complete! Let's tackle the next one.",
    ],
    audioConfig: {
      frequency: 523.25,
      type: 'sine',
      duration: 0.3,
      cooldown: 0,
    },
  },
  PAUSA: {
    messages: [
      "Taking a well-deserved break.",
      "Unplugging for a few minutes to recharge.",
      "Time to stretch and rest your eyes.",
      "Active break: taking care of your mind.",
    ],
    audioConfig: {
      frequency: 392,
      type: 'sine',
      duration: 0.3,
      cooldown: 30000,
    },
  },
};

/**
 * Returns a random Body Doubling companion phrase in English for the current state.
 */
export const getRandomStateMessage = (state: FocusState): string => {
  const messages = AVATAR_CONFIG[state]?.messages;
  if (!messages || messages.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};
