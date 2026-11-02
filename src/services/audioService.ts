import { AVATAR_CONFIG, FocusState } from '../config/avatarConfig';

interface NoteSpec {
  freq: number;
  type?: OscillatorType;
  startTimeOffset: number;
  duration: number;
  gain?: number;
  endFreq?: number;
}

class AudioService {
  private audioCtx: AudioContext | null = null;
  private lastPlayedMap: Map<FocusState, number> = new Map();
  private muted: boolean = false;

  /**
   * Obtiene o inicializa perezosamente el AudioContext nativo de Web Audio API.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // Ignora silenciosamente si aún no ha ocurrido interacción de usuario
      });
    }

    return this.audioCtx;
  }

  /**
   * Alterna el estado global de silencio del audio.
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Indica si el servicio de audio se encuentra en silencio.
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Establece explícitamente el estado de silencio.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Reproduce notas armónicas sintetizadas mediante Web Audio API pura.
   */
  private playHarmonicNotes(notes: NoteSpec[], defaultType: OscillatorType = 'sine'): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = note.type || defaultType;
        const noteStart = now + note.startTimeOffset;
        const noteDuration = Math.max(note.duration, 0.05);
        const peakGain = note.gain ?? 0.12;

        osc.frequency.setValueAtTime(note.freq, noteStart);
        if (note.endFreq) {
          osc.frequency.exponentialRampToValueAtTime(note.endFreq, noteStart + noteDuration);
        }

        const attackTime = 0.03;
        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(peakGain, noteStart + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + noteDuration);
      });
    } catch (err) {
      console.warn('AudioContext error:', err);
    }
  }

  /**
   * Reproduce el sonido de estado sintetizado ("Earcon") según el estado de FocusBud.
   */
  public playStateSound(state: FocusState): void {
    if (this.muted) return;

    const config = AVATAR_CONFIG[state]?.audioConfig;
    if (!config) return;

    const now = Date.now();
    const lastPlayed = this.lastPlayedMap.get(state) || 0;

    // Regla anti-fatiga con cooldown por estado
    if (config.cooldown > 0 && now - lastPlayed < config.cooldown) {
      return;
    }

    switch (state) {
      case 'ENFOQUE':
        // ENFOQUE: Tono armónico tenue y casi imperceptible de inicio (sine 440 Hz suave)
        this.playHarmonicNotes([
          { freq: 440.0, type: 'sine', startTimeOffset: 0, duration: 0.25, gain: 0.06 },
        ]);
        break;

      case 'ALERTA_SUAVE':
        // ALERTA_SUAVE: Dos pings suaves armónicos (528 Hz y 659 Hz) con envolvente suave de ganancia
        this.playHarmonicNotes([
          { freq: 528.0, type: 'sine', startTimeOffset: 0, duration: 0.3, gain: 0.1 },
          { freq: 659.0, type: 'sine', startTimeOffset: 0.12, duration: 0.35, gain: 0.1 },
        ]);
        break;

      case 'FATIGA':
        // FATIGA: Tono grave y cálido descendente de baja intensidad (330 Hz -> 220 Hz)
        this.playHarmonicNotes([
          { freq: 330.0, endFreq: 220.0, type: 'triangle', startTimeOffset: 0, duration: 0.5, gain: 0.09 },
        ], 'triangle');
        break;

      case 'PARALISIS':
        // PARALISIS: Tríada reconfortante en modo sostenido (Do4 261.63Hz, Mi4 329.63Hz, Sol4 392Hz)
        this.playHarmonicNotes([
          { freq: 261.63, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
          { freq: 329.63, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
          { freq: 392.00, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
        ]);
        break;

      case 'CELEBRACION':
        // CELEBRACION: Arpegio brillante ascendente en Do Mayor con notas cortas y festivas (Do5, Mi5, Sol5, Do6)
        this.playHarmonicNotes([
          { freq: 523.25, type: 'sine', startTimeOffset: 0, duration: 0.15, gain: 0.12 },
          { freq: 659.25, type: 'sine', startTimeOffset: 0.07, duration: 0.15, gain: 0.13 },
          { freq: 783.99, type: 'sine', startTimeOffset: 0.14, duration: 0.18, gain: 0.14 },
          { freq: 1046.50, type: 'sine', startTimeOffset: 0.21, duration: 0.3, gain: 0.15 },
        ]);
        break;

      case 'PAUSA':
        // PAUSA: Tono suave relajante
        this.playHarmonicNotes([
          { freq: 392.0, type: 'sine', startTimeOffset: 0, duration: 0.3, gain: 0.08 },
          { freq: 493.88, type: 'sine', startTimeOffset: 0.1, duration: 0.4, gain: 0.08 },
        ]);
        break;
    }

    this.lastPlayedMap.set(state, now);
  }

  /**
   * Sintetiza voz empática en español usando Web Speech API nativa.
   * Adapta automáticamente el rate (velocidad) y tono (pitch) para sonar cálido y humano.
   */
  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): void {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    try {
      // Cancelar cualquier alocución anterior para evitar superposiciones
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      // Buscar voz nativa en español
      const spanishVoice = voices.find(v =>
        v.lang.toLowerCase().startsWith('es-mx') ||
        v.lang.toLowerCase().startsWith('es-es') ||
        v.lang.toLowerCase().startsWith('es-us') ||
        v.lang.toLowerCase().startsWith('es')
      );

      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }
      utterance.lang = spanishVoice ? spanishVoice.lang : 'es-MX';
      utterance.rate = options?.rate ?? 0.95;
      utterance.pitch = options?.pitch ?? 1.05;
      utterance.volume = options?.volume ?? 0.95;

      utterance.onstart = () => {
        if (options?.onStart) options.onStart();
      };

      utterance.onend = () => {
        if (options?.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('[AudioService] Evento de error en habla:', e);
        if (options?.onEnd) options.onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[AudioService] Error al sintetizar voz:', err);
      if (options?.onEnd) options.onEnd();
    }
  }

  /**
   * Detiene de inmediato cualquier alocución en curso.
   */
  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioService = new AudioService();

