import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Flame, Zap, Heart, Trophy, Star, Crown, Smile, Compass, Coffee } from 'lucide-react';

export interface RewardArchetype {
  id: string;
  kaomoji: string;
  title: string;
  badge: string;
  subtitle: string;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  icon: 'star' | 'flame' | 'zap' | 'heart' | 'trophy' | 'sparkle' | 'crown' | 'smile' | 'compass' | 'coffee';
  particleType: 'stars' | 'sparks' | 'petals' | 'bolts' | 'hearts' | 'crystals';
}

export const REWARD_ARCHETYPES: RewardArchetype[] = [
  {
    id: 'supernova',
    kaomoji: '(๑˃̵ᴗ˂̵)و ✨',
    title: '¡ESTELAR!',
    badge: '+100 CLAP • IMPACTO CRÍTICO',
    subtitle: '¡Enfoque en nivel legendario!',
    primaryColor: '#34d399', // Emerald
    accentColor: '#fbbf24',  // Amber gold
    glowColor: 'rgba(52, 211, 153, 0.55)',
    icon: 'star',
    particleType: 'stars'
  },
  {
    id: 'fuego_shonen',
    kaomoji: '🔥 (ง\'̀-\'́)ง 🔥',
    title: '¡FUEGO KAIZEN!',
    badge: 'RACHA ARDIENTE • MOMENTUM S+',
    subtitle: '¡Tu persistencia rompió la inercia!',
    primaryColor: '#f97316', // Orange
    accentColor: '#ef4444',  // Red
    glowColor: 'rgba(249, 115, 22, 0.55)',
    icon: 'flame',
    particleType: 'sparks'
  },
  {
    id: 'sakura_flow',
    kaomoji: '🌸 (◕‿◕✿) 🌸',
    title: 'SAKURA FLOW',
    badge: '+100 CLAP • ESTADO DE FLUJO',
    subtitle: 'Mente despejada, serenidad y avance',
    primaryColor: '#f472b6', // Pink
    accentColor: '#38bdf8',  // Sky blue
    glowColor: 'rgba(244, 114, 182, 0.55)',
    icon: 'heart',
    particleType: 'petals'
  },
  {
    id: 'cyber_boost',
    kaomoji: '⚡️ ٩(ˊᗜˋ*)و ⚡️',
    title: 'HIPER-SINAPSIS',
    badge: 'RANGO S+ • SINAPSIS RÁPIDA',
    subtitle: 'Sincronía biométrica perfecta',
    primaryColor: '#06b6d4', // Cyan
    accentColor: '#10b981',  // Emerald
    glowColor: 'rgba(6, 182, 212, 0.55)',
    icon: 'zap',
    particleType: 'bolts'
  },
  {
    id: 'sugar_dopamine',
    kaomoji: '🍬 (*＾▽＾)／ 🍬',
    title: 'DULCE VICTORIA',
    badge: '+100 CLAP • DOPAMINA PURA',
    subtitle: '¡Un paso menos, el objetivo está cerca!',
    primaryColor: '#c084fc', // Purple
    accentColor: '#f472b6',  // Pink
    glowColor: 'rgba(192, 132, 252, 0.55)',
    icon: 'sparkle',
    particleType: 'hearts'
  },
  {
    id: 'apex_victory',
    kaomoji: '👑 ＼(＾▽＾)／ 👑',
    title: '¡DOMINIO TOTAL!',
    badge: 'LOGRO DESBLOQUEADO • CLAP MAX',
    subtitle: '¡Paso completado con maestría!',
    primaryColor: '#eab308', // Gold
    accentColor: '#14b8a6',  // Teal
    glowColor: 'rgba(234, 179, 8, 0.55)',
    icon: 'crown',
    particleType: 'crystals'
  },
  {
    id: 'star_eyes',
    kaomoji: '✨ (★ω★) ✧',
    title: 'VISIÓN CÓSMICA',
    badge: 'RANGO EX • BRILLO ABSOLUTO',
    subtitle: '¡Claridad mental y ejecución impecable!',
    primaryColor: '#facc15', // Yellow
    accentColor: '#ec4899',  // Hot pink
    glowColor: 'rgba(250, 204, 21, 0.55)',
    icon: 'star',
    particleType: 'stars'
  },
  {
    id: 'body_doubling_hug',
    kaomoji: '💖 (づ｡◕‿‿◕｡)づ 💕',
    title: 'CONEXIÓN TOTAL',
    badge: '+100 CLAP • ENERGÍA VITAL',
    subtitle: 'FocusBud y tú en sincronía imparable',
    primaryColor: '#fb7185', // Rose
    accentColor: '#a855f7',  // Purple
    glowColor: 'rgba(251, 113, 133, 0.55)',
    icon: 'smile',
    particleType: 'hearts'
  },
  {
    id: 'ultra_shonen',
    kaomoji: '💥 ᕙ(⇀‸↼‶)ᕗ 💥',
    title: '¡PLUS ULTRA!',
    badge: 'SUPERACIÓN TOTAL • SIN LÍMITES',
    subtitle: '¡Demostraste de lo que eres capaz!',
    primaryColor: '#ef4444', // Red
    accentColor: '#f59e0b',  // Amber
    glowColor: 'rgba(239, 68, 68, 0.55)',
    icon: 'trophy',
    particleType: 'sparks'
  },
  {
    id: 'zen_harmony',
    kaomoji: '🍃 (✿◠‿◠) 🍵',
    title: 'ARMONÍA ZEN',
    badge: 'SERENIDAD PURA • FOCO 100%',
    subtitle: 'Avanzando en paz, sin fricción',
    primaryColor: '#10b981', // Emerald
    accentColor: '#6ee7b7',  // Light mint
    glowColor: 'rgba(16, 185, 129, 0.55)',
    icon: 'coffee',
    particleType: 'petals'
  }
];

interface ParticleData {
  id: number;
  angle: number;
  distance: number;
  size: number;
  rotation: number;
  delay: number;
}

interface KawaiiRewardCelebrationProps {
  isVisible: boolean;
  archetypeIndex?: number;
  comboCount?: number;
}

export const KawaiiRewardCelebration: React.FC<KawaiiRewardCelebrationProps> = ({
  isVisible,
  archetypeIndex = 0,
  comboCount = 1
}) => {
  const archetype = useMemo(() => {
    const idx = Math.abs(archetypeIndex) % REWARD_ARCHETYPES.length;
    return REWARD_ARCHETYPES[idx];
  }, [archetypeIndex]);

  // Generar 20 partículas orbitales precalculadas (CERO filtros pesados, 100% transform hardware)
  const particles: ParticleData[] = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => {
      const angle = (i * 360) / 20 + (Math.sin(i * 1.7) * 10);
      const distance = 85 + (i % 4) * 28;
      const size = 11 + (i % 3) * 5;
      const rotation = (i * 54) % 360;
      const delay = (i % 5) * 0.025;
      return { id: i, angle, distance, size, rotation, delay };
    });
  }, []);

  const renderIcon = (type: string) => {
    const className = "w-4 h-4 animate-pulse";
    switch (type) {
      case 'flame': return <Flame className={className} style={{ color: archetype.accentColor }} />;
      case 'zap': return <Zap className={className} style={{ color: archetype.primaryColor }} />;
      case 'heart': return <Heart className={className} style={{ color: archetype.primaryColor }} />;
      case 'trophy': return <Trophy className={className} style={{ color: archetype.accentColor }} />;
      case 'sparkle': return <Sparkles className={className} style={{ color: archetype.primaryColor }} />;
      case 'crown': return <Crown className={className} style={{ color: archetype.accentColor }} />;
      case 'smile': return <Smile className={className} style={{ color: archetype.primaryColor }} />;
      case 'coffee': return <Coffee className={className} style={{ color: archetype.primaryColor }} />;
      default: return <Star className={className} style={{ color: archetype.accentColor }} />;
    }
  };

  const renderParticleShape = (type: string, color: string) => {
    switch (type) {
      case 'stars':
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" />
          </svg>
        );
      case 'sparks':
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
          </svg>
        );
      case 'petals':
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <path d="M12 2C8 6 6 12 12 22C18 12 16 6 12 2Z" />
          </svg>
        );
      case 'bolts':
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
          </svg>
        );
      case 'hearts':
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" className="w-full h-full" fill={color}>
            <polygon points="12 2 22 12 12 22 2 12" />
          </svg>
        );
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="kawaii-reward-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        >
          {/* 1. Anillo de Onda de Choque Anime (Shockwave Ring - Acelerado por GPU) */}
          <motion.div
            initial={{ scale: 0.2, opacity: 0.95 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.95, ease: "easeOut" }}
            className="absolute w-44 h-44 rounded-full border-2 pointer-events-none"
            style={{
              borderColor: archetype.primaryColor,
              boxShadow: `0 0 40px ${archetype.glowColor}`,
              willChange: 'transform, opacity'
            }}
          />

          {/* 2. Ráfaga de Partículas Vectoriales Kawaii (Cero filtros CPU, puro translate3d) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {particles.map((p) => {
              const rad = (p.angle * Math.PI) / 180;
              const targetX = Math.cos(rad) * p.distance;
              const targetY = Math.sin(rad) * p.distance;
              const particleColor = p.id % 2 === 0 ? archetype.primaryColor : archetype.accentColor;

              return (
                <motion.div
                  key={p.id}
                  initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
                  animate={{
                    x: targetX,
                    y: targetY,
                    scale: [0, 1.3, 0.75],
                    rotate: p.rotation + 180,
                    opacity: [1, 1, 0]
                  }}
                  transition={{
                    duration: 1.15,
                    delay: p.delay,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  style={{
                    position: 'absolute',
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    willChange: 'transform, opacity'
                  }}
                >
                  {renderParticleShape(archetype.particleType, particleColor)}
                </motion.div>
              );
            })}
          </div>

          {/* 3. Tarjeta de Celebración Kawaii Anime (Pop con rebote de física elástica) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.35, y: 50, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.25, y: -20 }}
            transition={{
              type: "spring",
              damping: 14,
              stiffness: 260,
              mass: 0.8
            }}
            className="relative px-5 py-5 sm:px-7 sm:py-6 rounded-[2.5rem] bg-zinc-950/95 border-2 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-2.5 w-[92%] max-w-[390px] text-center"
            style={{
              borderColor: archetype.primaryColor,
              boxShadow: `0 0 60px ${archetype.glowColor}, inset 0 0 25px rgba(0,0,0,0.85)`,
              willChange: 'transform, opacity'
            }}
          >
            {/* Combo Badge Superior */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-700/60 shadow-inner">
              {renderIcon(archetype.icon)}
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-300 whitespace-nowrap">
                PASO SUPERADO • RACHA x{comboCount}
              </span>
            </div>

            {/* Kaomoji Masivo Estilo Anime - En una sola línea sin desbordes */}
            <div className="space-y-1 my-0.5 w-full flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] whitespace-nowrap tracking-wide leading-normal block select-none">
                {archetype.kaomoji}
              </span>
              <h3
                className="text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, #ffffff 0%, ${archetype.primaryColor} 60%, ${archetype.accentColor} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: `drop-shadow(0 0 16px ${archetype.glowColor})`
                }}
              >
                {archetype.title}
              </h3>
            </div>

            {/* Píldora de Recompensa XP & Dopamina */}
            <div
              className="px-4 py-1.5 rounded-2xl border font-mono text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                borderColor: archetype.primaryColor,
                color: archetype.primaryColor,
                boxShadow: `0 0 24px ${archetype.glowColor}`
              }}
            >
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              <span>{archetype.badge}</span>
            </div>

            {/* Subtítulo Motivacional */}
            <p className="text-[11px] font-sans font-medium text-zinc-400 mt-0.5">
              {archetype.subtitle}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KawaiiRewardCelebration;
