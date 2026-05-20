import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import Heart from "./pages/Heart";
import UserMenu from "./components/UserMenu";

import AboutModal from "./components/AboutModal";
import Surah from "./pages/Surah";
import AppearanceModal from "./components/Appearance";
import QuranOAuthFeedback from "./components/QuranOAuthFeedback";
import { useStore, useSettingsStore } from "./zustand/store";
export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0a2e1f",
            color: "#d4af37",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            borderRadius: "15px",
            backdropFilter: "blur(10px)",
          },
        }}
      />
      <QuranOAuthFeedback />
      <Routes>
        <Route path="/" element={<Heart />} />
        <Route path="/surah/:sura" element={<Surah />} />
        <Route path="/quran-logout" element={<Heart />} />
      </Routes>
      <UserMenu />
      <Analytics />
      <AppearanceModal />
      <AboutModal />
      {/* <SupportModal isOpen={isSupportModalOpen} onClose={closeSupportModal} /> */}
    </>
  );
}
