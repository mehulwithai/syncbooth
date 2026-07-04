import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-white/[0.01] backdrop-blur-sm py-6 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-white/30 tracking-wider font-sans">
        <div className="flex items-center gap-1.5 hover:text-white/50 transition-colors duration-300 select-none">
          <span>&copy; Dadits Media 2026</span>
        </div>
        <div className="text-center sm:text-right select-none">
          Created by <span className="text-pink-400/80 font-semibold hover:text-pink-400 transition-colors duration-300">Mehul</span> for <span className="text-purple-400/80 font-semibold hover:text-purple-400 transition-colors duration-300">Someone</span>...🫶
        </div>
      </div>
    </footer>
  );
}
