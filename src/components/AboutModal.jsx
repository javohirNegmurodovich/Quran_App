import React from "react";
import { useStore } from "../zustand/store";

export default function AboutModal() {
  const isAboutModalOpen = useStore((state) => state.isAboutModalOpen);
  const closeAboutModal = useStore((state) => state.closeAboutModal);

  if (!isAboutModalOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center  bg-[#051a11]/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-[95%] max-w-lg p-4  bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(212,175,55,0.15)] text-center overflow-hidden">
        {/* Decorative Gold Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#d4af37]/20 blur-[100px] rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#0284c7]/20 blur-[100px] rounded-full"></div>

        <button
          onClick={closeAboutModal}
          className="absolute top-6 right-8 text-white/30 hover:text-white transition-colors text-2xl"
        >
          ✕
        </button>

        {/* The "Gold" Icon */}
        <div className="mb-6 flex justify-center ">
          <div className="w-20 h-20 rounded-full  bg-gradient-to-tr from-[#d4af37] to-[#fde047] p-1 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#0a2e1f] flex items-center justify-center">
              <img src="/assets/App_logo.png" alt="" />
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#fef3c7] via-[#d4af37] to-[#92400e] mb-4">
          Quran: Nabzi Sakinah
        </h2>

        <div className="space-y-6 text-white/80 leading-relaxed font-light italic">
          <p className="text-lg text-[#e0f2fe]">
            “Surely, in the remembrance of Allah do hearts find peace.” <br />
            <span className="text-xs font-sans not-italic text-white/40 tracking-widest">
              — AR-RA'D 13:28
            </span>
          </p>

          <div className="h-px w-20 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mx-auto"></div>

          <p className="text-sm sm:text-base">
            <span className="text-[#d4af37] font-medium">Nabzi Sakinah </span>-
            is not just a Quran learning app. It is a digital reflection of your
            heart. As the Quran enters the heart, it guides the person closer to
            the Creator and purifies the soul. Without the Quran, the heart can
            grow cold and lifeless.
          </p>

          <p className="text-sm sm:text-base">
            Every piece of your digital heart represents one Surah of the Quran.
            As you read, listen, and memorize Surahs, each frozen piece begins
            to melt and come back to life. Your heart starts beating again.
          </p>
        </div>

        {/* Adorable Credits */}
        <div className="mt-10 pt-6 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-2">
            Built with love
          </p>
          <p className="text-[#d4af37] font-serif text-xl font-bold tracking-tight">
            Javohir Hasanov
          </p>
          <p className="text-[10px] text-white/20 mt-1">
            {new Date().getFullYear()} • Tashkent, Uzbekistan
          </p>
        </div>
      </div>
    </div>
  );
}
