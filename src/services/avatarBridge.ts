/**
 * AvatarBridge: Enrutador de telemetría biométrica de alta frecuencia (60 FPS)
 * entre MediaPipe Holistic / TensorFlow.js y FocusBudLiving.
 * 
 * Permite comunicación de latencia cero (<1ms) sin disparar re-renders innecesarios
 * en la jerarquía de componentes de React.
 */

export interface BiometricAvatarFeed {
  gazeX: number;        // -1 (mirando a la izquierda) a +1 (mirando a la derecha)
  gazeY: number;        // -1 (arriba) a +1 (abajo)
  headRoll: number;     // -25 a +25 grados (inclinación lateral del cuello)
  isBlinking: boolean;  // Parpadeo del usuario detectado por EAR
  isFlow: boolean;      // Estado de Enfoque Profundo / Flow activo
  isFatigue: boolean;   // Fatiga cognitiva o bostezo detectado
  isDistress: boolean;  // Agobio postural o tensión de hombros
  ear: number;          // Eye Aspect Ratio numérico
  focusScore: number;   // 0 a 100 nivel CLAP
}

type TelemetryListener = (feed: BiometricAvatarFeed) => void;

class AvatarBridgeService {
  private listeners: Set<TelemetryListener> = new Set();
  private currentFeed: BiometricAvatarFeed = {
    gazeX: 0,
    gazeY: 0,
    headRoll: 0,
    isBlinking: false,
    isFlow: false,
    isFatigue: false,
    isDistress: false,
    ear: 0.25,
    focusScore: 100,
  };

  /**
   * Emite un frame de telemetría biométrica directa desde MediaPipe/TF.js
   */
  public emitBiometricFeed(feed: Partial<BiometricAvatarFeed>): void {
    this.currentFeed = {
      ...this.currentFeed,
      ...feed,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentFeed);
      } catch (err) {
        console.warn('[AvatarBridge] Error en listener:', err);
      }
    });
  }

  /**
   * Suscribe a FocusBudLiving u otros componentes a la telemetría en tiempo real
   */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    // Emitir estado actual inmediatamente al suscribir
    listener(this.currentFeed);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Obtiene la última instantánea de telemetría
   */
  public getSnapshot(): BiometricAvatarFeed {
    return this.currentFeed;
  }
}

export const avatarBridge = new AvatarBridgeService();
