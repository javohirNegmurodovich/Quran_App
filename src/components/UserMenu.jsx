import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useStore, useSettingsStore } from "../zustand/store";

function MenuItem({ icon, children, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
        danger
          ? "text-red-300 hover:bg-red-400/10"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}

function SmallPill({ children }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/65">
      {children}
    </span>
  );
}

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const menuRef = useRef(null);

  const user = useStore((state) => state.user);
  const quranConnected = useStore((state) => state.quranConnected);
  const sessionLoading = useStore((state) => state.sessionLoading);
  const sessionError = useStore((state) => state.sessionError);
  const learnedSurahs = useStore((state) => state.learnedSurahs);
  const ayahBookmarks = useStore((state) => state.ayahBookmarks);
  const streaks = useStore((state) => state.streaks);
  const goals = useStore((state) => state.goals);
  const lastRead = useStore((state) => state.lastRead);
  const lastSyncedAt = useStore((state) => state.lastSyncedAt);

  const loginWithQuran = useStore((state) => state.loginWithQuran);
  const logout = useStore((state) => state.logout);
  const loadQuranSession = useStore((state) => state.loadQuranSession);
  const getProfileName = useStore((state) => state.getProfileName);
  const getProfileAvatar = useStore((state) => state.getProfileAvatar);
  const getProgressPercentage = useStore(
    (state) => state.getProgressPercentage,
  );
  const getStreakCount = useStore((state) => state.getStreakCount);

  const openAboutModal = useStore((state) => state.openAboutModal);
  const openAppearanceModal = useSettingsStore(
    (state) => state.openAppearanceModal,
  );
  const openSupportModal = useSettingsStore((state) => state.openSupportModal);
  const startTutorial = useSettingsStore((state) => state.startTutorial);

  const profileName = getProfileName();
  const avatar = getProfileAvatar();
  const progress = getProgressPercentage();
  const streakCount = getStreakCount();

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setActivePanel(null);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const handleLogin = () => {
    toast.loading("Opening Quran.com sign-in...", {
      duration: 1200,
    });
    loginWithQuran();
  };

  const handleRefresh = async () => {
    const toastId = toast.loading("Syncing your Quran.com data...");
    const ok = await loadQuranSession({ silent: true });
    if (ok) toast.success("Quran.com sync updated ✅", { id: toastId });
    else toast.error("ync failed. Please sign in again.", { id: toastId });
  };

  const handleLogout = async () => {
    const toastId = toast.loading("CSigning out...");
    await logout();
    toast.success("Signed out from Quran.com.", { id: toastId });
    setIsOpen(false);
  };

  return (
    <div className="fixed right-6 top-6 z-[500]" ref={menuRef}>
      <button
        type="button"
        aria-label="Open profile menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#082719]/75 text-[#d4af37] shadow-2xl backdrop-blur-xl transition-all hover:scale-105 hover:bg-[#0a2e1f]"
      >
        {avatar ? (
          <img
            src={avatar}
            alt={profileName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-xl">♙</span>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#082719] ${quranConnected ? "bg-emerald-400" : "bg-white/35"}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[min(92vw,350px)] overflow-hidden rounded-[1.75rem] border border-[#d4af37]/25 bg-[#061f15]/95 text-white shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div className="border-b border-white/10 p-4">
            {!quranConnected ? (
              <div>
                <h2 className="text-lg font-black text-[#fdf8ed]">
                  Sign in with Quran.com
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  One account syncs your progress, bookmarks, streak, and heart
                  state.
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="mt-4 w-full rounded-full bg-[#d4af37] px-4 py-3 text-sm font-black text-[#061f15] hover:scale-[1.02] transition-transform"
                >
                  Sign in / Sign up
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d4af37] text-lg font-black text-[#061f15]">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={profileName}
                        className="h-12 w-12 rounded-2xl object-cover"
                      />
                    ) : (
                      profileName[0]?.toUpperCase() || "Q"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-[#fdf8ed]">
                      {profileName}
                    </p>
                    <p className="text-xs text-emerald-300">
                      Connected with Quran.com
                    </p>
                    <p className="text-[11px] text-white/40">
                      {sessionLoading
                        ? "Sync..."
                        : lastSyncedAt
                          ? "Synced"
                          : "Ready"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-[#d4af37]">
                    <span>Heart progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-[#38bdf8] via-[#d4af37] to-[#fb923c] transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <SmallPill>{learnedSurahs.length}/114 sura</SmallPill>
                  <SmallPill>{ayahBookmarks.length} bookmarks</SmallPill>
                  <SmallPill>{streakCount} streak</SmallPill>
                  <SmallPill>{goals.length} goals</SmallPill>
                </div>

                {sessionError && (
                  <p className="mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-200">
                    {sessionError}
                  </p>
                )}
              </div>
            )}
          </div>

          {activePanel && quranConnected && (
            <div className="border-b border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-[#d4af37]">{activePanel}</p>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {activePanel === "Profile" && (
                <div className="space-y-2 text-white/65">
                  <p>
                    Name: <span className="text-white">{profileName}</span>
                  </p>
                  <p>
                    Learned:{" "}
                    <span className="text-white">
                      {learnedSurahs.length}/114
                    </span>
                  </p>
                  <p>
                    Bookmarks:{" "}
                    <span className="text-white">{ayahBookmarks.length}</span>
                  </p>
                  {lastRead && (
                    <p>
                      Last read:{" "}
                      <span className="text-white">
                        {lastRead.surahNumber || lastRead.chapterNumber}:
                        {lastRead.ayahNumber || lastRead.verseNumber}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {activePanel === "Streak" && (
                <div className="space-y-2 text-white/65">
                  <p>
                    Current streak:{" "}
                    <span className="text-white">{streakCount} days</span>
                  </p>
                  <p>Activity data is synced when you listen/read ayahs.</p>
                </div>
              )}

              {activePanel === "Bookmarks" && (
                <div className="space-y-2 text-white/65">
                  <p>
                    Total ayah bookmarks:{" "}
                    <span className="text-white">{ayahBookmarks.length}</span>
                  </p>
                  <p>
                    Latest:{" "}
                    <span className="text-white">
                      {ayahBookmarks[0]?.verseKey || "No bookmarks yet"}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="p-2">
            {quranConnected ? (
              <>
                <MenuItem icon="👤" onClick={() => setActivePanel("Profile")}>
                  Profile
                </MenuItem>

                <MenuItem icon="🔄" onClick={handleRefresh}>
                  Sync now
                </MenuItem>
              </>
            ) : (
              <MenuItem icon="🔐" onClick={handleLogin}>
                Sign in with Quran.com
              </MenuItem>
            )}

            <MenuItem
              icon="⚙️"
              onClick={() => {
                setIsOpen(false);
                openAppearanceModal();
              }}
            >
              Reading settings
            </MenuItem>

            <MenuItem
              icon="ℹ️"
              onClick={() => {
                setIsOpen(false);
                openAboutModal();
              }}
            >
              About the app
            </MenuItem>

            <div className="mx-3 my-2 h-px bg-white/10" />

            {quranConnected && (
              <MenuItem icon="↩" danger onClick={handleLogout}>
                Sign out
              </MenuItem>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
