import React, { useState } from 'react';

interface GroundingBreakProps {
  remainingSeconds: number;
  onSkipBreak: () => void;
  formatTime: (sec: number) => string;
}

type GroundingCategory = 'menu' | '54321' | 'propiocepcion' | 'termico' | 'mental' | 'realidad';

export const GroundingBreak: React.FC<GroundingBreakProps> = ({
  remainingSeconds,
  onSkipBreak,
  formatTime
}) => {
  const [activeTab, setActiveTab] = useState<GroundingCategory>('menu');

  return (
    <div className="flex flex-col items-center justify-between p-6 h-full text-zinc-200 animate-fadeIn">
      {/* Break Header */}
      <div className="text-center">
        <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
          ☕ Restoration Break
        </span>
        <h2 className="text-4xl font-bold font-mono text-white mt-3 tracking-wider">
          {formatTime(remainingSeconds)}
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Time to unplug your mind and recharge your attention.
        </p>
      </div>

      {/* Dynamic Grounding Content */}
      <div className="w-full max-w-md my-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 text-sm backdrop-blur-sm min-h-[190px] flex flex-col justify-center">
        {activeTab === 'menu' && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 text-center mb-3">
              Select a quick grounding technique or simply rest in silence:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('54321')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-emerald-300 text-xs">👀 5-4-3-2-1 Technique</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Guided sensory anchoring</div>
              </button>
              <button
                onClick={() => setActiveTab('propiocepcion')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-cyan-300 text-xs">🧘 Physical Grounding</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Feet, palms & shoulders</div>
              </button>
              <button
                onClick={() => setActiveTab('termico')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-sky-300 text-xs">❄️ Thermal Contrast</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Cool sensory reset</div>
              </button>
              <button
                onClick={() => setActiveTab('mental')}
                className="p-2.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-left transition-colors cursor-pointer"
              >
                <div className="font-semibold text-amber-300 text-xs">🧠 Neutral Counting</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Visual categorization</div>
              </button>
            </div>
            <button
              onClick={() => setActiveTab('realidad')}
              className="w-full mt-2 py-1.5 text-center text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              🌿 Present Reality Descriptors
            </button>
          </div>
        )}

        {activeTab === '54321' && (
          <div className="space-y-1.5 text-xs text-zinc-300">
            <div className="font-semibold text-emerald-400 text-sm mb-1">5-4-3-2-1 Sensory Technique</div>
            <div>• <strong className="text-white">5 things</strong> you can see around you.</div>
            <div>• <strong className="text-white">4 things</strong> you can touch (clothes, desk, chair).</div>
            <div>• <strong className="text-white">3 sounds</strong> you can hear in the distance.</div>
            <div>• <strong className="text-white">2 scents</strong> in your environment.</div>
            <div>• <strong className="text-white">1 taste</strong> currently in your mouth.</div>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-emerald-400 underline mt-2 block cursor-pointer">← Back to menu</button>
          </div>
        )}

        {activeTab === 'propiocepcion' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-cyan-400 text-sm mb-1">Proprioceptive Grounding</div>
            <p>1. Plant both feet firmly on the floor, feeling the weight of your body.</p>
            <p>2. Gently press your palms flat against the desk for 5 seconds.</p>
            <p>3. Lift your shoulders toward your ears, inhale deeply, and drop them as you exhale.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-cyan-400 underline mt-2 block cursor-pointer">← Back to menu</button>
          </div>
        )}

        {activeTab === 'termico' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-sky-400 text-sm mb-1">Safe Thermal Reset</div>
            <p>• Hold a glass of cool water or touch a cool/metal surface on your desk.</p>
            <p>• Notice the temperature difference on your fingertips for 15 seconds.</p>
            <p>• If you prefer, stand up and rinse your hands with cool water to refresh your eyes.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-sky-400 underline mt-2 block cursor-pointer">← Back to menu</button>
          </div>
        )}

        {activeTab === 'mental' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-amber-400 text-sm mb-1">Neutral Categorization</div>
            <p>• Pick a color (e.g., green or blue) and spot 4 objects of that color around you.</p>
            <p>• Observe any single object and mentally describe its geometric shape, texture, and approximate weight.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-amber-400 underline mt-2 block cursor-pointer">← Back to menu</button>
          </div>
        )}

        {activeTab === 'realidad' && (
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="font-semibold text-purple-400 text-sm mb-1">Environment Facts</div>
            <p className="italic text-zinc-300">
              "I am sitting in my chair. The floor supports my feet. This is my desk and the room is calm."
            </p>
            <p className="text-[11px] text-zinc-400">Silently repeat factual, neutral statements about your present physical space.</p>
            <button onClick={() => setActiveTab('menu')} className="text-xs text-purple-400 underline mt-2 block cursor-pointer">← Back to menu</button>
          </div>
        )}
      </div>

      {/* Skip / Finish Break Button */}
      <div className="w-full flex justify-between items-center pt-2">
        <span className="text-[11px] text-zinc-500">Ready ahead of time?</span>
        <button
          onClick={onSkipBreak}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>Continue session</span> ▶️
        </button>
      </div>
    </div>
  );
};
