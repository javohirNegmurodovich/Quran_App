import React, { useState } from "react";

export default function SupportModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("uzum");

  if (!isOpen) return null;

  const qrData = {
    click: { name: "Click", color: "#00a3ff", img: "/assets/click.png" },
    uzum: { name: "Uzum Bank", color: "#7c3aed", img: "/assets/uzum.png" },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a2e1f]/80 backdrop-blur-md">
      <div className="relative w-full max-w-md p-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-2xl text-white text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-6 text-white/50 hover:text-white text-xl"
        >
          ✕
        </button>

        {/* Updated Header: "Gift of the Heart" */}
        <h3 className="text-2xl font-bold mb-2 text-[#d4af37]">Qalb Hadyasi</h3>

        {/* Updated Main Text: Polite, indirect, and focused on development */}
        <p className="text-sm text-white/60 mb-6 px-4 leading-relaxed">
          Agar ushbu ilova qalbingizga xotirjamlik olib kirgan bo'lsa va
          loyihamiz kelajakda yanada go'zal imkoniyatlar bilan rivojlanishini
          istasangiz, ixtiyoriy ravishda o'z hadyangizni yo'llashingiz mumkin.
        </p>

        {/* Tab Selection */}
        <div className="flex bg-black/30 p-1 rounded-2xl mb-8">
          {Object.keys(qrData).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === key
                  ? "bg-white/20 text-white shadow-lg"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {qrData[key].name}
            </button>
          ))}
        </div>

        {/* QR Display Area */}
        <div className="relative group mx-auto w-64 h-64 bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          <img
            src={qrData[activeTab].img}
            alt="Hadya QR kodi"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>

        {/* Dynamic Instruction */}
        <div className="mt-8 space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
            Yo'riqnoma
          </p>
          <p className="text-sm text-white/80 italic">
            "Hadyangizni yo'llash uchun{" "}
            <span style={{ color: qrData[activeTab].color }}>
              {qrData[activeTab].name}
            </span>{" "}
            ilovangizdan ushbu kodni skanerlang."
          </p>
          <p className="text-[10px] text-white/30 mt-4 leading-tight">
            Agar siz smartfondan foydalanayotgan bo'lsangiz, skrinshot oling va
            ilovangizdagi "Galereyadan skanerlash" xususiyatidan foydalaning.
          </p>
        </div>
      </div>
    </div>
  );
}
