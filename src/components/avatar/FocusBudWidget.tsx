import React, { useEffect, useState } from 'react';
import { FocusState, getRandomStateMessage } from '../../config/avatarConfig';
import { audioService } from '../../services/audioService';
import { FocusBudLiving } from './FocusBudLiving';

export type FocusBudState = FocusState;

export interface FocusBudWidgetProps {
  state: FocusBudState;
  message?: string | null;
  className?: string;
  size?: number;
  gazeX?: number;
  gazeY?: number;
  headRoll?: number;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  isBlinkingManual?: boolean;
  isFlow?: boolean;
  isFatigue?: boolean;
  isDistress?: boolean;
}

/**
 * FocusBudWidget: Componente Black Box para el robot FocusBud.
 * Integra el Avatar reactivo, el bocadillo estilizado de acompañamiento empático
 * y la reproducción de voz/earcons procedurales mediante audioService.
 */
export const FocusBudWidget: React.FC<FocusBudWidgetProps> = React.memo(({
  state,
  message,
  className = '',
  size = 360,
  gazeX,
  gazeY,
  headRoll,
  isStreaming = false,
  isSpeaking = false,
  isBlinkingManual = false,
  isFlow,
  isFatigue,
  isDistress,
}) => {
  const [currentMessage, setCurrentMessage] = useState<string>('');


  // Reproducción automática de sonido al cambiar de estado biométrico
  useEffect(() => {
    if (state) {
      audioService.playStateSound(state);
    }
  }, [state]);

  // Selección dinámica y sanitización estricta de la frase de acompañamiento (Body Doubling)
  useEffect(() => {
    let raw = message !== undefined && message !== null ? message : getRandomStateMessage(state);
    
    // Limpiar cualquier residuo de razonamiento en inglés o tags
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/[*_#"`]/g, '').trim();
    if (/Starts with an? uppercase|Need to consider:|Count:\s*\d|User prompt:/i.test(cleaned)) {
      cleaned = getRandomStateMessage(state);
    }
    
    // Capped a máximo 90 caracteres para que nunca deforme el layout
    if (cleaned.length > 95) {
      cleaned = cleaned.substring(0, 92).trim() + '...';
    }
    
    setCurrentMessage(cleaned);
  }, [state, message]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full max-w-[420px] select-none ${className}`}>
      <style>{`
        @keyframes fadeInBubble {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-bubble-fadeIn {
          animation: fadeInBubble 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Bocadillo de Diálogo Compacto de FocusBud (Flotando sobre la cabeza sin desplazar al avatar) */}
      <div className="h-16 w-full flex items-center justify-center relative mb-1">
        {currentMessage && (
          <div className="animate-bubble-fadeIn pointer-events-none w-full max-w-[340px] flex flex-col items-center">
            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/70 shadow-2xl rounded-2xl px-4 py-2 text-xs sm:text-[13px] font-medium text-zinc-100 text-center w-full max-h-[68px] overflow-hidden leading-snug line-clamp-2">
              {currentMessage}
            </div>
            {/* Apuntador hacia la cabeza del robot */}
            <div className="w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-zinc-900/95" />
          </div>
        )}
      </div>

      {/* Organismo Biométrico Vectorial FocusBud 2.0 (Posición central fija) */}
      <div className="w-full flex items-center justify-center relative z-10 shrink-0">
        <FocusBudLiving
          state={state}
          size={size}
          gazeX={gazeX}
          gazeY={gazeY}
          headRoll={headRoll}
          isStreaming={isStreaming}
          isSpeaking={isSpeaking}
          isBlinkingManual={isBlinkingManual}
          isFlow={isFlow}
          isFatigue={isFatigue}
          isDistress={isDistress}
        />
      </div>
    </div>
  );
});

FocusBudWidget.displayName = 'FocusBudWidget';

export default FocusBudWidget;
