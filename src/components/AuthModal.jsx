import React, { useState } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firestore";
import { useStore } from "../zustand/store";
import toast from "react-hot-toast";
export default function AuthModal() {
  const isAuthModalOpen = useStore((state) => state.isAuthModalOpen);
  const closeAuthModal = useStore((state) => state.closeAuthModal);
  const setUser = useStore((state) => state.setUser);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      closeAuthModal();
      toast.success("Qur’on safaringizga xush kelibsiz");
    } catch (err) {
      setError("Failed to sign in with Google.");
      toast.error("Nimadir xato ketdi, qaytadan urining");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        toast.success("Qur’on safaringizga xush kelibsiz");
      } else {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        setUser(result.user);
        toast.success("Qur’on safaringizga xush kelibsiz");
      }
      closeAuthModal();
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      toast.error("Nimadir xato ketdi, qaytadan urining");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a2e1f]/80 backdrop-blur-md transition-opacity">
      {/* Magical Icy Glassmorphism Card */}
      <div className="relative w-full max-w-md p-8 overflow-hidden bg-white/10 backdrop-blur-xl border border-white/30 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.2)]">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-6 text-white/70 hover:text-white text-2xl"
        >
          ✕
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#e0f2fe] to-[#d4af37] mb-2">
            Qur’on nuri bilan porlang
          </h2>
          <p className="text-[#e0f2fe]/80 text-sm">
            Yuragingizni hayotga qaytarish va quron yod olish sayohatingizni
            boshlash ushun tizimga kiring
          </p>
        </div>

        {error && (
          <p className="text-red-300 text-sm text-center mb-4 bg-red-900/30 p-2 rounded-lg">
            {error}
          </p>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-5 py-3 bg-black/20 border border-white/20 text-white placeholder-white/50 rounded-xl focus:outline-none focus:border-[#d4af37] transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-5 py-3 bg-black/20 border border-white/20 text-white placeholder-white/50 rounded-xl focus:outline-none focus:border-[#d4af37] transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full py-3 font-bold text-[#0f3b25] bg-gradient-to-r from-[#d4af37] to-[#fde047] rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(212,175,55,0.4)]"
          >
            {isLogin ? "Kirish" : "Hisob yaratish"}
          </button>
        </form>

        <div className="my-6 flex items-center justify-center gap-4">
          <div className="h-px bg-white/20 flex-1"></div>
          <span className="text-white/50 text-xs">Yoki</span>
          <div className="h-px bg-white/20 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all"
        >
          Google bilan kirish
        </button>

        <p className="text-center text-white/60 text-sm mt-6">
          {isLogin ? "Hisobingiz mavjud emasmi " : "Hisobingiz mavjudmi "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#d4af37] hover:underline font-bold"
          >
            {isLogin ? "Ro'yxatdan o'tish" : "Kirih"}
          </button>
        </p>
      </div>
    </div>
  );
}
