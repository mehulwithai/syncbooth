'use client';
import { useEffect, useState } from 'react';
import { composeStripImage } from '../lib/composeStrip';

const THEMES = {
  black: {
    bg: 'bg-[#141018]',
    text: 'text-white',
    subtext: 'text-white/40',
    accentBg: 'bg-white/20',
    previewBg: '#141018',
    label: 'Black'
  },
  white: {
    bg: 'bg-white border border-black/10',
    text: 'text-[#333333]',
    subtext: 'text-[#333333]/50',
    accentBg: 'bg-[#888888]',
    previewBg: '#ffffff',
    label: 'White'
  },
  cream: {
    bg: 'bg-[#f6ebd4]',
    text: 'text-[#7c6a51]',
    subtext: 'text-[#7c6a51]/60',
    accentBg: 'bg-[#8b7355]',
    previewBg: '#f6ebd4',
    label: 'Cream'
  },
  pink: {
    bg: 'bg-[#f7d1d9]',
    text: 'text-[#9c4b5e]',
    subtext: 'text-[#9c4b5e]/60',
    accentBg: 'bg-[#be185d]',
    previewBg: '#f7d1d9',
    label: 'Pink'
  },
  blue: {
    bg: 'bg-[#cedbf2]',
    text: 'text-[#49648c]',
    subtext: 'text-[#49648c]/60',
    accentBg: 'bg-[#1d4ed8]',
    previewBg: '#cedbf2',
    label: 'Blue'
  },
  mint: {
    bg: 'bg-[#cbd9d0]',
    text: 'text-[#436651]',
    subtext: 'text-[#436651]/60',
    accentBg: 'bg-[#047857]',
    previewBg: '#cbd9d0',
    label: 'Mint'
  }
};

export default function PhotoStrip({ rounds, onRequestRetake }) {
  const [activeTheme, setActiveTheme] = useState('black');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [composing, setComposing] = useState(true);

  const theme = THEMES[activeTheme];

  useEffect(() => {
    let cancelled = false;
    setComposing(true);
    composeStripImage(rounds, activeTheme)
      .then((dataUrl) => {
        if (!cancelled) setDownloadUrl(dataUrl);
      })
      .catch((err) => console.error('Strip compose failed:', err))
      .finally(() => !cancelled && setComposing(false));
    return () => {
      cancelled = true;
    };
  }, [rounds, activeTheme]);

  return (
    <div className="flex flex-col items-center gap-6 animate-fadeInUp w-full max-w-sm pb-10">
      <p className="text-white/70 text-xs tracking-[0.3em] uppercase">All done ♡</p>

      {/* Theme Selector */}
      <div className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-4 w-full">
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          Choose Theme
        </span>
        <div className="flex justify-center gap-3 mt-1 flex-wrap">
          {Object.entries(THEMES).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setActiveTheme(key)}
              title={value.label}
              className={`w-8 h-8 rounded-full transition-all duration-200 focus:outline-none relative ${
                activeTheme === key
                  ? 'ring-2 ring-pink-500 scale-110 shadow-lg shadow-pink-500/20'
                  : 'hover:scale-105 border border-white/10'
              }`}
              style={{ backgroundColor: value.previewBg }}
            >
              {activeTheme === key && (
                <span className="absolute inset-0 flex items-center justify-center text-xs">
                  ✨
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Photostrip Preview */}
      <div className={`relative w-[240px] rounded-none p-3.5 shadow-2xl shadow-black/50 transition-all duration-300 ${theme.bg}`}>
        <div className="flex flex-col gap-2">
          {rounds.map((r) => (
            <div key={r.round} className="grid grid-cols-2 gap-0">
              <img
                src={r.slot1_url}
                alt={`Round ${r.round} — partner 1`}
                className="w-full aspect-[3/4] object-cover"
              />
              <img
                src={r.slot2_url}
                alt={`Round ${r.round} — partner 2`}
                className="w-full aspect-[3/4] object-cover"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center mt-4 gap-3">
          <div className={`w-16 h-1.5 rounded-none ${theme.accentBg}`} />
          <p className={`font-mono text-[9px] font-semibold tracking-[0.25em] text-center ${theme.text}`}>
            SYNCBOOTH.COM
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full">
        <a
          href={downloadUrl || '#'}
          download={`syncbooth-strip-${activeTheme}.png`}
          aria-disabled={composing}
          className={`w-full bg-pink-500 hover:bg-pink-400 active:scale-95 transition-all duration-200 rounded-xl py-3 font-semibold text-center shadow-lg shadow-pink-500/20 text-white ${
            composing ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {composing ? 'Preparing download...' : 'Download strip'}
        </a>

        {/* Re-take Shot Section */}
        <div className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-4 w-full">
          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Re-take a Shot
          </span>
          <div className="grid grid-cols-2 gap-2 w-full mt-1">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => onRequestRetake?.(num)}
                className="bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-pink-500/50 rounded-xl py-2.5 text-xs font-semibold text-white/80 transition-all duration-200"
              >
                🔄 Shot {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
