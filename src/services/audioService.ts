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
  private ttsEnabled: boolean = true;
  private earconsEnabled: boolean = true;
  private preferredLang: 'es' | 'en' = 'es';
  private isMicRecordingMutex: boolean = false;

  public setLanguage(lang: 'es' | 'en'): void {
    this.preferredLang = lang;
  }

  public getLanguage(): 'es' | 'en' {
    return this.preferredLang;
  }

  public setTtsEnabled(enabled: boolean): void {
    this.ttsEnabled = enabled;
    if (!enabled) {
      this.stopSpeaking();
    }
  }

  public setEarconsEnabled(enabled: boolean): void {
    this.earconsEnabled = enabled;
  }

  public setMicRecordingMutex(active: boolean): void {
    this.isMicRecordingMutex = active;
    if (active) {
      this.stopSpeaking();
    }
  }

  /**
   * Lazily initializes or retrieves the native Web Audio API AudioContext.
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
        // Silently ignore if user interaction hasn't happened yet
      });
    }

    return this.audioCtx;
  }

  /**
   * Toggles global audio mute state.
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Indicates whether audio is currently muted.
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Explicitly sets mute state.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Plays synthesized harmonic notes via pure Web Audio API.
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
   * Plays synthesized state sound ("Earcon") matching FocusBud's state.
   */
  public playStateSound(state: FocusState): void {
    if (this.muted || !this.earconsEnabled) return;

    const config = AVATAR_CONFIG[state]?.audioConfig;
    if (!config) return;

    const now = Date.now();
    const lastPlayed = this.lastPlayedMap.get(state) || 0;

    // Anti-fatigue per-state cooldown
    if (config.cooldown > 0 && now - lastPlayed < config.cooldown) {
      return;
    }

    switch (state) {
      case 'ENFOQUE':
        this.playHarmonicNotes([
          { freq: 440.0, type: 'sine', startTimeOffset: 0, duration: 0.25, gain: 0.06 },
        ]);
        break;

      case 'ALERTA_SUAVE':
        this.playHarmonicNotes([
          { freq: 528.0, type: 'sine', startTimeOffset: 0, duration: 0.3, gain: 0.1 },
          { freq: 659.0, type: 'sine', startTimeOffset: 0.12, duration: 0.35, gain: 0.1 },
        ]);
        break;

      case 'FATIGA':
        this.playHarmonicNotes([
          { freq: 330.0, endFreq: 220.0, type: 'triangle', startTimeOffset: 0, duration: 0.5, gain: 0.09 },
        ], 'triangle');
        break;

      case 'PARALISIS':
        this.playHarmonicNotes([
          { freq: 261.63, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
          { freq: 329.63, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
          { freq: 392.00, type: 'sine', startTimeOffset: 0, duration: 0.7, gain: 0.08 },
        ]);
        break;

      case 'CELEBRACION':
        this.playHarmonicNotes([
          { freq: 523.25, type: 'sine', startTimeOffset: 0, duration: 0.15, gain: 0.12 },
          { freq: 659.25, type: 'sine', startTimeOffset: 0.07, duration: 0.15, gain: 0.13 },
          { freq: 783.99, type: 'sine', startTimeOffset: 0.14, duration: 0.18, gain: 0.14 },
          { freq: 1046.50, type: 'sine', startTimeOffset: 0.21, duration: 0.3, gain: 0.15 },
        ]);
        break;

      case 'PAUSA':
        this.playHarmonicNotes([
          { freq: 392.0, type: 'sine', startTimeOffset: 0, duration: 0.3, gain: 0.08 },
          { freq: 493.88, type: 'sine', startTimeOffset: 0.1, duration: 0.4, gain: 0.08 },
        ]);
        break;
    }

    this.lastPlayedMap.set(state, now);
  }

  /**
   * Synthesizes empathetic voice using native Web Speech API.
   * Automatically detects whether `text` is in Spanish or English so the voice
   * engine NEVER reads English words with a Spanish voice (or vice versa).
   */
  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: 'es' | 'en';
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): void {
    if (
      this.muted ||
      !this.ttsEnabled ||
      this.isMicRecordingMutex ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    try {
      // Cancel any previous utterance to prevent overlap
      window.speechSynthesis.cancel();

      const cleanText = String(text || '').trim();
      if (!cleanText) {
        if (options?.onEnd) options.onEnd();
        return;
      }

      // Detect language of the actual text to prevent reading English with Spanish accent (or vice versa)
      let targetLang: 'es' | 'en' = options?.lang || this.preferredLang;
      if (!options?.lang) {
        const hasSpanishChars = /[áéíóúñ¿¡]/i.test(cleanText);
        const spanishStopWords = /\b(el|la|los|las|de|del|que|qué|como|cómo|para|con|por|una|uno|este|esta|paso|meta|ahora|respira|enfoque|pausa|bien|excelente)\b/i.test(cleanText);
        const englishStopWords = /\b(the|and|your|with|for|step|focus|take|breath|zero|pressure|steady|pace|complete|let's|right|now|goal)\b/i.test(cleanText);
        if (hasSpanishChars || (spanishStopWords && !englishStopWords)) {
          targetLang = 'es';
        } else if (englishStopWords && !spanishStopWords) {
          targetLang = 'en';
        }
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();

      if (targetLang === 'es') {
        const spanishVoice =
          voices.find(v => v.lang.toLowerCase().startsWith('es-mx') && /natural|neural|google|sabina|dalia|jorge/i.test(v.name)) ||
          voices.find(v => v.lang.toLowerCase().startsWith('es-mx')) ||
          voices.find(v => v.lang.toLowerCase().startsWith('es-es')) ||
          voices.find(v => v.lang.toLowerCase().startsWith('es'));
        if (spanishVoice) {
          utterance.voice = spanishVoice;
        }
        utterance.lang = spanishVoice ? spanishVoice.lang : 'es-MX';
      } else {
        const englishVoice =
          voices.find(v => v.lang.toLowerCase().startsWith('en-us') && /natural|neural|google|aria|jenny|guy/i.test(v.name)) ||
          voices.find(v => v.lang.toLowerCase().startsWith('en-us')) ||
          voices.find(v => v.lang.toLowerCase().startsWith('en-gb')) ||
          voices.find(v => v.lang.toLowerCase().startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        utterance.lang = englishVoice ? englishVoice.lang : 'en-US';
      }
      utterance.rate = options?.rate ?? 0.98;
      utterance.pitch = options?.pitch ?? 1.05;
      utterance.volume = options?.volume ?? 0.95;

      utterance.onstart = () => {
        if (options?.onStart) options.onStart();
      };

      utterance.onend = () => {
        if (options?.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('[AudioService] Speech error event:', e);
        if (options?.onEnd) options.onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[AudioService] Error synthesizing speech:', err);
      if (options?.onEnd) options.onEnd();
    }
  }

  /**
   * Immediately stops any ongoing speech utterance.
   */
  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioService = new AudioService();
