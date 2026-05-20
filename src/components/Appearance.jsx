import React, { useEffect } from "react";
import { useSettingsStore } from "../zustand/store";

function ToggleSwitch({ checked, onClick, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-white/90">{label}</p>
        <p className="text-xs text-white/50">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onClick}
        className={`relative h-8 w-14 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4af37] ${
          checked ? "bg-[#d4af37]" : "bg-black/40"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function AppearanceModal() {
  const {
    isAppearanceModalOpen,
    closeAppearanceModal,
    arabicFontSize,
    setArabicFontSize,
    showUzbek,
    toggleUzbek,
    showLatin,
    toggleLatin,
  } = useSettingsStore();

  useEffect(() => {
    if (!isAppearanceModalOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeAppearanceModal();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isAppearanceModalOpen, closeAppearanceModal]);

  if (!isAppearanceModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#051a11]/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-settings-title"
      onMouseDown={closeAppearanceModal}
    >
      <div
        className="relative w-full max-w-md rounded-[2rem] border border-white/20 bg-[#0a2e1f]/90 p-8 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeAppearanceModal}
          aria-label="Close reading settings"
          className="absolute right-5 top-4 rounded-full px-3 py-1 text-2xl text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        >
          ×
        </button>

        <h2
          id="reading-settings-title"
          className="mb-6 bg-gradient-to-r from-[#e0f2fe] to-[#d4af37] bg-clip-text text-center font-serif text-2xl font-bold text-transparent"
        >
          Reading Settings
        </h2>

        <div className="mb-8">
          <label
            htmlFor="arabic-font-size"
            className="mb-4 flex items-end justify-between"
          >
            <span className="font-semibold text-white/90">
              Arabic text size
            </span>
            <span
              className="text-2xl text-[#d4af37]"
              style={{ fontFamily: "'Amiri', serif" }}
              aria-hidden="true"
            >
              بِسْمِ
            </span>
          </label>

          <input
            id="arabic-font-size"
            type="range"
            min="2"
            max="6"
            step="0.5"
            value={arabicFontSize}
            onChange={(event) =>
              setArabicFontSize(Number.parseFloat(event.target.value))
            }
            aria-valuemin={2}
            aria-valuemax={6}
            aria-valuenow={arabicFontSize}
            aria-label="Arabic text size"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-black/30 accent-[#d4af37]"
          />

          <div className="mt-2 flex justify-between text-xs text-white/50">
            <span>Small</span>
            <span>Medium</span>
            <span>Large</span>
          </div>
        </div>

        <div className="my-6 h-px bg-white/10" />

        <div className="space-y-6">
          <ToggleSwitch
            checked={showLatin}
            onClick={toggleLatin}
            label="Show transliteration"
            description="Example: Ihdinas-Siraatal..."
          />

          <ToggleSwitch
            checked={showUzbek}
            onClick={toggleUzbek}
            label="Show translation / tafsir"
            description="Display meaning or tafsir when available."
          />
        </div>
      </div>
    </div>
  );
}
