import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addQuranAyahBookmark,
  bootstrapQuranUser,
  connectQuranCom,
  createQuranGoal,
  creditQuranActivity,
  logoutQuranCom,
  markQuranSurahLearned,
  saveQuranReadingSession,
  unmarkQuranSurahLearned,
} from "../utils/quranUserApi";

function normalizeNumberArray(values = []) {
  return [...new Set(values.map(Number))]
    .filter((number) => Number.isFinite(number) && number >= 1 && number <= 114)
    .sort((a, b) => a - b);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.bookmarks)) return value.bookmarks;
  if (Array.isArray(value?.nodes)) return value.nodes;
  return [];
}

function getProfileName(profile) {
  return (
    profile?.firstName ||
    profile?.username ||
    profile?.email ||
    profile?.data?.firstName ||
    profile?.data?.username ||
    profile?.data?.email ||
    "Quran.com user"
  );
}

function getProfileAvatar(profile) {
  return (
    profile?.photoUrl ||
    profile?.avatarUrls?.small ||
    profile?.avatarUrls?.medium ||
    profile?.data?.photoUrl ||
    profile?.data?.avatarUrls?.small ||
    ""
  );
}

function getStreakCount(streaks = []) {
  const first = streaks[0];
  return (
    Number(first?.days) ||
    Number(first?.length) ||
    Number(first?.currentStreak) ||
    Number(first?.current_streak) ||
    0
  );
}

export const useStore = create((set, get) => ({
  user: null,
  quranConnected: false,
  sessionLoading: false,
  sessionError: null,
  learnedSurahs: [],
  ayahBookmarks: [],
  readingSessions: [],
  streaks: [],
  goals: [],
  lastRead: null,
  lastSyncedAt: null,

  isAuthModalOpen: false,
  isAboutModalOpen: false,

  openAboutModal: () => set({ isAboutModalOpen: true }),
  closeAboutModal: () => set({ isAboutModalOpen: false }),
  openAuthModal: () => connectQuranCom(),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  setUser: (user) => set({ user }),

  getProfileName: () => getProfileName(get().user),
  getProfileAvatar: () => getProfileAvatar(get().user),
  getProgressPercentage: () =>
    Math.round((get().learnedSurahs.length / 114) * 100),
  getStreakCount: () => getStreakCount(get().streaks),

  loadQuranSession: async ({ silent = false } = {}) => {
    if (!silent) set({ sessionLoading: true, sessionError: null });

    try {
      const session = await bootstrapQuranUser();

      if (!session.connected) {
        set({
          user: null,
          quranConnected: false,
          learnedSurahs: [],
          ayahBookmarks: [],
          readingSessions: [],
          streaks: [],
          goals: [],
          lastRead: null,
          lastSyncedAt: null,
          sessionLoading: false,
          sessionError: session.error || null,
        });
        return false;
      }

      const profile =
        session.profile?.data || session.profile || session.user || null;
      const learnedSurahs = normalizeNumberArray(session.learnedSurahs || []);
      const ayahBookmarks = Array.isArray(session.bookmarkedAyahs)
        ? session.bookmarkedAyahs
        : normalizeArray(session.bookmarks);

      set({
        user: profile,
        quranConnected: true,
        learnedSurahs,
        ayahBookmarks,
        readingSessions: Array.isArray(session.readingSessions)
          ? session.readingSessions
          : [],
        streaks: Array.isArray(session.streaks) ? session.streaks : [],
        goals: Array.isArray(session.goals) ? session.goals : [],
        lastRead: session.lastRead || null,
        lastSyncedAt: Date.now(),
        sessionLoading: false,
        sessionError: null,
      });

      return true;
    } catch (error) {
      set({
        sessionLoading: false,
        sessionError: error.message || "Quran.com session failed.",
      });
      return false;
    }
  },

  loginWithQuran: () => connectQuranCom(),

  logout: async () => {
    try {
      await logoutQuranCom();
    } finally {
      set({
        user: null,
        quranConnected: false,
        learnedSurahs: [],
        ayahBookmarks: [],
        readingSessions: [],
        streaks: [],
        goals: [],
        lastRead: null,
        lastSyncedAt: null,
        sessionLoading: false,
        sessionError: null,
      });
    }
  },

  clearProgress: () =>
    set({
      learnedSurahs: [],
      ayahBookmarks: [],
      readingSessions: [],
      streaks: [],
      goals: [],
      lastRead: null,
    }),
  setLearnedSurahs: (surahs) =>
    set({ learnedSurahs: normalizeNumberArray(surahs || []) }),

  toggleLearnedSurah: async (surahNumber) => {
    const state = get();
    const number = Number(surahNumber);
    if (!Number.isFinite(number) || number < 1 || number > 114) return;

    if (!state.quranConnected) {
      connectQuranCom();
      return;
    }

    const previous = state.learnedSurahs;
    const alreadyLearned = previous.includes(number);
    const next = alreadyLearned
      ? previous.filter((item) => item !== number)
      : normalizeNumberArray([...previous, number]);

    set({ learnedSurahs: next });

    try {
      const result = alreadyLearned
        ? await unmarkQuranSurahLearned({ surahNumber: number })
        : await markQuranSurahLearned({ surahNumber: number });

      if (result?.success === false)
        throw new Error(result.message || "Quran.com sync failed.");

      window.setTimeout(() => get().loadQuranSession({ silent: true }), 700);
    } catch (error) {
      console.error("Failed to sync learned surah:", error);
      set({
        learnedSurahs: previous,
        sessionError: error.message || "Failed to sync learned surah.",
      });
    }
  },

  addAyahBookmark: async ({ surahNumber, ayahNumber, localData = {} }) => {
    const state = get();
    if (!state.quranConnected) {
      connectQuranCom();
      return;
    }

    const optimisticBookmark = {
      id: `${surahNumber}:${ayahNumber}`,
      verseKey: `${surahNumber}:${ayahNumber}`,
      key: Number(surahNumber),
      verseNumber: Number(ayahNumber),
      surahNumber: Number(surahNumber),
      ayahNumber: Number(ayahNumber),
      type: "ayah",
      createdAt: Date.now(),
      ...localData,
    };

    const previous = state.ayahBookmarks;
    const exists = previous.some(
      (bookmark) => bookmark.id === optimisticBookmark.id,
    );
    set({
      ayahBookmarks: exists ? previous : [optimisticBookmark, ...previous],
    });

    try {
      const result = await addQuranAyahBookmark({ surahNumber, ayahNumber });
      if (result?.success === false)
        throw new Error(result.message || "Failed to bookmark ayah.");
      window.setTimeout(() => get().loadQuranSession({ silent: true }), 700);
    } catch (error) {
      console.error("Failed to bookmark ayah:", error);
      set({
        ayahBookmarks: previous,
        sessionError: error.message || "Failed to bookmark ayah.",
      });
      throw error;
    }
  },

  saveReadingProgress: async ({ chapterNumber, verseNumber }) => {
    const state = get();
    if (!state.quranConnected) return;

    const lastRead = {
      chapterNumber: Number(chapterNumber),
      verseNumber: Number(verseNumber),
      surahNumber: Number(chapterNumber),
      ayahNumber: Number(verseNumber),
      updatedAt: new Date().toISOString(),
    };

    set({ lastRead });
    await saveQuranReadingSession({ chapterNumber, verseNumber }).catch(
      () => null,
    );
  },

  creditReadingActivity: async ({
    surahNumber,
    fromAyah,
    toAyah,
    seconds = 30,
  }) => {
    if (!get().quranConnected) return;
    await creditQuranActivity({ surahNumber, fromAyah, toAyah, seconds }).catch(
      () => null,
    );
  },

  createGoal: async ({ amount = 10, duration } = {}) => {
    if (!get().quranConnected) {
      connectQuranCom();
      return;
    }
    const result = await createQuranGoal({ amount, duration });
    if (result?.success !== false) get().loadQuranSession({ silent: true });
    return result;
  },
}));

export const useSettingsStore = create(
  persist(
    (set) => ({
      isAppearanceModalOpen: false,
      arabicFontSize: 3.5,
      showTafsir: true,
      showUzbek: true,
      showLatin: true,
      hasSeenTutorial: false,
      runTutorial: true,
      tutorialKey: 0,
      isSupportModalOpen: false,
      recitationId: "7",
      tafsirId: "169",
      setRecitationId: (id) => set({ recitationId: String(id) }),
      setTafsirId: (id) => set({ tafsirId: String(id) }),
      openSupportModal: () => set({ isSupportModalOpen: true }),
      closeSupportModal: () => set({ isSupportModalOpen: false }),
      startTutorial: () =>
        set((state) => ({
          runTutorial: true,
          tutorialKey: state.tutorialKey + 1,
        })),
      finishTutorial: () => set({ hasSeenTutorial: true, runTutorial: false }),
      openAppearanceModal: () => set({ isAppearanceModalOpen: true }),
      closeAppearanceModal: () => set({ isAppearanceModalOpen: false }),
      setArabicFontSize: (size) => set({ arabicFontSize: Number(size) }),
      toggleTafsir: () =>
        set((state) => ({
          showTafsir: !state.showTafsir,
          showUzbek: !state.showTafsir,
        })),
      toggleUzbek: () =>
        set((state) => ({
          showUzbek: !state.showUzbek,
          showTafsir: !state.showUzbek,
        })),
      toggleLatin: () => set((state) => ({ showLatin: !state.showLatin })),
    }),
    {
      name: "qalb-appearance-settings",
      partialize: (state) => ({
        arabicFontSize: state.arabicFontSize,
        showTafsir: state.showTafsir,
        showUzbek: state.showUzbek,
        showLatin: state.showLatin,
        hasSeenTutorial: state.hasSeenTutorial,
        recitationId: state.recitationId,
        tafsirId: state.tafsirId,
      }),
    },
  ),
);
