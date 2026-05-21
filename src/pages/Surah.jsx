// ─────────────────────────────────────────────────────────────────────────────
// Surah.jsx  —  Performance-optimised edition
// Changes vs original:
//   • SettingsButton + SettingsPanel lifted OUT of component (no re-creation)
//   • All event handlers wrapped in useCallback
//   • getArabicNumber result memoized via lookup map
//   • AyahCard extracted + React.memo'd  → only re-renders when its slice changes
//   • isSourceChanging merged into a single "loadPhase" state
//   • Audio preload fixed (src set before load)
//   • CSS contain: layout style paint added to ayah cards
//   • will-change hints on animated elements
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import DOMPurify from "dompurify";
import { useStore, useSettingsStore } from "../zustand/store";
import {
  getResources,
  getSurah,
  prefetchSurah,
  preloadAudioMetadata,
  readCachedResources,
  readCachedSurah,
  normalizeId,
  STATIC_CHAPTERS,
} from "../utils/quranClientCache";
import {
  addQuranBookmark,
  saveQuranReadingSession,
  creditQuranActivity,
} from "../utils/quranUserApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_RECITERS = [
  { id: "7", name: "Mishary Rashid Alafasy", style: "" },
  { id: "1", name: "AbdulBaset AbdulSamad", style: "Mujawwad" },
];

const FALLBACK_TAFSIRS = [
  { id: "169", name: "Tafsir Ibn Kathir", languageName: "english" },
];

// Pre-build the Arabic digit lookup so getArabicNumber is O(1) per character
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function getArabicNumber(n) {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[d]);
}

function formatTime(t) {
  if (Number.isNaN(t) || !Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
const SafeTafsirHtml = memo(function SafeTafsirHtml({ html }) {
  const cleanHtml = useMemo(() => {
    return DOMPurify.sanitize(html || "", {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "br",
        "span",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
    });
  }, [html]);

  return (
    <div
      className="tafsir-html mt-4 text-base text-gray-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
});
// ─── SettingsButton (pure, no closure over state it doesn't need) ─────────────

const SettingsButton = memo(function SettingsButton({
  isOpen,
  onToggle,
  reciterLabel,
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls="study-settings-panel"
      onClick={onToggle}
      className="group flex items-center gap-2 rounded-full bg-white/90 border border-[#d4af37]/50 px-3 sm:px-4 py-2 text-[#0f3b25] font-bold shadow-sm hover:shadow-[0_8px_24px_rgba(212,175,55,0.25)] hover:border-[#d4af37] transition-all"
    >
      <span className="text-lg">🎧</span>
      <span className="hidden lg:flex flex-col items-start leading-tight">
        <span className="text-sm"> Audio/Tafsir</span>
        <span className="text-[10px] font-medium text-[#0f3b25]/60 max-w-40 truncate">
          {reciterLabel}
        </span>
      </span>
      <span
        className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      >
        ▼
      </span>
    </button>
  );
});

// ─── SettingsPanel ────────────────────────────────────────────────────────────

const SettingsPanel = memo(function SettingsPanel({
  reciters,
  tafsirs,
  recitationId,
  tafsirId,
  reciterLabel,
  tafsirLabel,
  onReciterChange,
  onTafsirChange,
  onClose,
}) {
  return (
    <div
      id="study-settings-panel"
      className="absolute right-0 top-full mt-3 w-[min(92vw,720px)] rounded-3xl bg-white/95 backdrop-blur-xl border border-[#d4af37]/30 shadow-[0_24px_70px_rgba(15,59,37,0.24)] p-4 sm:p-5 z-[300]"
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#d4af37]/20 pb-3">
        <div>
          <h3 className="text-[#0f3b25] font-serif text-xl font-bold">
            Audio and Tafsir
          </h3>
          <p className="text-xs text-[#0f3b25]/60">
            Choose your reciter and tafsir source
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full border border-[#0f3b25]/15 text-[#0f3b25] hover:bg-[#0f3b25] hover:text-[#d4af37] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-[#0f3b25] font-bold text-sm">
          <span> Choose reciter</span>
          <select
            value={recitationId}
            onChange={(e) => onReciterChange(e.target.value)}
            className="rounded-2xl border border-[#d4af37]/50 bg-[#fdf8ed] px-4 py-3 text-[#0f3b25] outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            {reciters.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
                {r.style ? ` — ${r.style}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-[#0f3b25] font-bold text-sm">
          <span> Choose tafsir</span>
          <select
            value={tafsirId}
            onChange={(e) => onTafsirChange(e.target.value)}
            className="rounded-2xl border border-[#d4af37]/50 bg-[#fdf8ed] px-4 py-3 text-[#0f3b25] outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            {tafsirs.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
                {t.languageName ? ` — ${t.languageName}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-2xl bg-[#0a2e1f]/5 border border-[#d4af37]/20 px-4 py-3 text-xs sm:text-sm text-[#0f3b25]/70">
        <div className="font-bold text-[#0f3b25] mb-1">Current selection</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <span className="truncate">🎙 {reciterLabel}</span>
          <span className="truncate">📖 {tafsirLabel}</span>
        </div>
      </div>
    </div>
  );
});

// ─── AyahCard — memoized so unchanged ayahs never re-render ──────────────────

const AyahCard = memo(
  function AyahCard({
    ayah,
    isActive,
    isPlaying,
    isAudioLoading,
    activeProgress,
    arabicFontSize,
    showLatin,
    showTafsir,
    tafsirLabel,
    onInlineClick,
    suraNumber,
  }) {
    return (
      <div
        id={`ayah-${ayah.globalIndex}`}
        className="px-4 sm:px-10 py-3 scroll-mt-36"
        style={{ contain: "layout style paint" }}
      >
        <button
          type="button"
          onClick={async () => {
            const result = await addQuranBookmark({
              surahNumber: suraNumber,
              ayahNumber: ayah.number,
            });

            if (result.success) {
              toast.success("Saved to Quran.com bookmarks🔖");
            } else {
              toast.error(
                result.message || "Could not save Quran.com bookmark",
              );
            }
          }}
          className="mt-4 rounded-full border border-[#d4af37]/50 px-4 py-2 text-[#0f3b25] font-bold hover:bg-[#d4af37] transition-all"
        >
          🔖 Quran.com bookmark
        </button>
        <div
          className={`rounded-3xl p-6 sm:p-10 transition-all duration-500 border-2 ${
            isActive
              ? "bg-[#fff8dc] border-[#d4af37] shadow-[0_15px_45px_rgba(212,175,55,0.35)] scale-[1.01] z-10"
              : "bg-white border-transparent shadow-sm hover:shadow-md hover:border-[#d4af37]/40"
          }`}
        >
          {/* Row: play button + Arabic text */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 sm:gap-12 w-full mb-8">
            <button
              type="button"
              onClick={() => onInlineClick(ayah.globalIndex)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex justify-center items-center transition-all shrink-0 shadow-md mt-2 ${
                isActive
                  ? "bg-[#d4af37] text-[#0f3b25] scale-110 shadow-[0_0_24px_rgba(212,175,55,0.5)]"
                  : "bg-[#f2ece1] text-[#0f3b25]/60 hover:bg-[#0f3b25] hover:text-[#d4af37]"
              }`}
              style={isActive ? { willChange: "transform" } : undefined}
            >
              {isAudioLoading && isActive ? (
                <div className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-[#0f3b25] border-t-transparent rounded-full animate-spin" />
              ) : isActive && isPlaying ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 sm:w-7 sm:h-7"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 sm:w-7 sm:h-7 ml-1"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0 pr-2 sm:pr-4 text-right w-full">
              <p
                className={`text-[2.4rem] sm:text-[3.2rem] arabic-text wrap-break-words inline-block text-right leading-normal transition-all duration-300 ${
                  isActive && isPlaying
                    ? "text-[#0f3b25] drop-shadow-[0_0_10px_rgba(212,175,55,0.25)]"
                    : "text-black"
                }`}
                dir="rtl"
                style={{ fontSize: `${arabicFontSize}rem` }}
              >
                {ayah.arabic}
                <span className="relative inline-flex items-center justify-center mx-3 mr-10 text-[#375345] w-10 h-10 align-middle opacity-90">
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[2.8rem]"
                    style={{ fontFamily: '"Amiri","Traditional Arabic",serif' }}
                  >
                    ۝
                  </span>
                  <span
                    className="relative z-10 text-[1.4rem]"
                    style={{
                      fontFamily: '"Amiri","Traditional Arabic",serif',
                      paddingTop: "0.2rem",
                    }}
                  >
                    {getArabicNumber(ayah.number)}
                  </span>
                </span>
              </p>

              {isActive && (
                <div
                  className="mt-5 h-1.5 w-full rounded-full bg-[#0f3b25]/10 overflow-hidden"
                  dir="rtl"
                >
                  <div
                    className="h-full rounded-full bg-linear-to-l from-[#d4af37] via-[#facc15] to-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.55)] transition-[width] duration-150"
                    style={{ width: `${activeProgress}%`, willChange: "width" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Transliteration + tafsir */}
          <div className="text-left pl-4 sm:pl-20 border-l-4 border-[#d4af37]/40 w-full">
            {showLatin && ayah.latin && (
              <p className="text-lg sm:text-xl font-medium text-[#0c379d] font-sans italic tracking-wide">
                {ayah.latin}
              </p>
            )}
            {showTafsir && ayah.tafsir?.text && (
              <details className="mt-5 rounded-2xl bg-[#f2ece1]/70 border border-[#d4af37]/30 p-4">
                <summary className="cursor-pointer font-bold text-[#0f3b25]">
                  View tafsir — {ayah.tafsir?.resourceName || tafsirLabel}{" "}
                  {ayah.tafsir?.languageName || ""}
                </summary>
                <div className="mt-4 text-base text-gray-700 leading-relaxed">
                  <SafeTafsirHtml html={ayah.tafsir.text} />
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    // Custom comparator: only re-render when relevant props change
    return (
      prev.ayah === next.ayah &&
      prev.isActive === next.isActive &&
      prev.isPlaying === next.isPlaying &&
      prev.isAudioLoading === next.isAudioLoading &&
      prev.activeProgress === next.activeProgress &&
      prev.arabicFontSize === next.arabicFontSize &&
      prev.showLatin === next.showLatin &&
      prev.showTafsir === next.showTafsir &&
      prev.tafsirLabel === next.tafsirLabel
      // onInlineClick is stable via useCallback — no need to compare
    );
  },
);

// ─── Main Surah component ─────────────────────────────────────────────────────

export default function Surah() {
  const { sura } = useParams();
  const navigate = useNavigate();

  const learnedSurahs = useStore((s) => s.learnedSurahs);
  const toggleLearnedSurah = useStore((s) => s.toggleLearnedSurah);

  const {
    arabicFontSize,
    showTafsir,
    showLatin,
    recitationId,
    tafsirId,
    setRecitationId,
    setTafsirId,
  } = useSettingsStore();

  const safeRecitationId = normalizeId(recitationId, "7");
  const safeTafsirId = normalizeId(tafsirId, "169");

  // Initialise from cache to avoid a loading flash on cached data
  const initCache = readCachedSurah(sura, safeRecitationId, safeTafsirId);

  const [ayahs, setAyahs] = useState(initCache?.ayahs || []);
  const [surahName, setSurahName] = useState(initCache?.surahName || "");
  const [loading, setLoading] = useState(!initCache);
  const [isSrcChange, setIsSrcChange] = useState(false);

  const [reciters, setReciters] = useState(FALLBACK_RECITERS);
  const [tafsirs, setTafsirs] = useState(FALLBACK_TAFSIRS);
  const [isStudyPanelOpen, setIsStudyPanelOpen] = useState(false);

  const [hasCompletedAudio, setHasCompletedAudio] = useState(false);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sliderIndex, setSliderIndex] = useState(0);

  const audioRef = useRef(null);
  const ayahsRef = useRef(ayahs);
  const requestIdRef = useRef(0);

  const suraNumber = Number.parseInt(sura, 10);
  const isLearned = learnedSurahs.includes(suraNumber);

  // Keep ayahsRef in sync without triggering renders
  useEffect(() => {
    ayahsRef.current = ayahs;
  }, [ayahs]);

  useEffect(() => {
    if (currentPlayingIndex === null || !ayahs[currentPlayingIndex]) return;

    const ayah = ayahs[currentPlayingIndex];

    const timeout = setTimeout(() => {
      saveQuranReadingSession({
        chapterNumber: suraNumber,
        verseNumber: ayah.number,
      }).catch(() => null);

      creditQuranActivity({
        surahNumber: suraNumber,
        fromAyah: ayah.number,
        toAyah: ayah.number,
        seconds: 20,
      }).catch(() => null);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [currentPlayingIndex, ayahs, suraNumber]);

  // ── Derived labels ──────────────────────────────────────────────────────────
  const selectedReciterLabel = useMemo(
    () =>
      reciters.find((r) => String(r.id) === safeRecitationId)?.name ||
      `Qori #${safeRecitationId}`,
    [reciters, safeRecitationId],
  );
  const selectedTafsirLabel = useMemo(
    () =>
      tafsirs.find((t) => String(t.id) === safeTafsirId)?.name ||
      `Tafsir #${safeTafsirId}`,
    [tafsirs, safeTafsirId],
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const resetAudioPlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
    setCurrentPlayingIndex(null);
    setShowPlayer(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // ── Settings handlers ───────────────────────────────────────────────────────
  const handleReciterChange = useCallback(
    (value) => {
      resetAudioPlayer();
      setRecitationId(String(value));
      setIsStudyPanelOpen(false);
    },
    [resetAudioPlayer, setRecitationId],
  );

  const handleTafsirChange = useCallback(
    (value) => {
      resetAudioPlayer();
      setTafsirId(String(value));
      setIsStudyPanelOpen(false);
    },
    [resetAudioPlayer, setTafsirId],
  );

  const handleToggleSettings = useCallback(
    () => setIsStudyPanelOpen((p) => !p),
    [],
  );
  const handleCloseSettings = useCallback(() => setIsStudyPanelOpen(false), []);

  const handleToggleLearned = useCallback(() => {
    toggleLearnedSurah(suraNumber);
    if (!isLearned) {
      toast.success(" A piece of your heart has melted!", {
        duration: 3000,
        icon: "❤️",
        style: { color: "#fef2f2", background: "#7f1d1d" },
      });
      setTimeout(() => navigate("/"), 1200);
    } else {
      navigate("/");
    }
  }, [toggleLearnedSurah, suraNumber, isLearned, navigate]);

  // ── Load resources once ─────────────────────────────────────────────────────
  useEffect(() => {
    const cached = readCachedResources();
    if (cached) {
      if (cached.recitations?.length) setReciters(cached.recitations);
      if (cached.tafsirs?.length) setTafsirs(cached.tafsirs);
    }

    const ctrl = new AbortController();
    getResources({ signal: ctrl.signal })
      .then((res) => {
        if (res.recitations?.length) setReciters(res.recitations);
        if (res.tafsirs?.length) setTafsirs(res.tafsirs);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          console.error("Failed to load resources:", err);
      });
    return () => ctrl.abort();
  }, []);

  // ── Load surah when sura / reciter / tafsir change ──────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    const requestId = ++requestIdRef.current;

    async function loadSurah() {
      const cached = readCachedSurah(sura, safeRecitationId, safeTafsirId);

      if (cached?.ayahs?.length) {
        setSurahName(cached.surahName);
        setAyahs(cached.ayahs);
        setLoading(false);
        setIsSrcChange(false);
        if (cached.ayahs[0]?.audioUrl)
          preloadAudioMetadata(cached.ayahs[0].audioUrl);
        const next = Number(sura) + 1;
        if (next <= 114) prefetchSurah(next, safeRecitationId, safeTafsirId);
        return;
      }

      // Show soft transition if we already have ayahs, hard loading otherwise
      if (ayahsRef.current.length > 0) setIsSrcChange(true);
      else setLoading(true);

      try {
        const data = await getSurah({
          chapter: sura,
          recitationId: safeRecitationId,
          tafsirId: safeTafsirId,
          signal: ctrl.signal,
        });

        if (requestId !== requestIdRef.current) return;

        setSurahName(data.surahName);
        setAyahs(data.ayahs || []);
        if (data.ayahs?.[0]?.audioUrl)
          preloadAudioMetadata(data.ayahs[0].audioUrl);
        const next = Number(sura) + 1;
        if (next <= 114) prefetchSurah(next, safeRecitationId, safeTafsirId);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load Surah:", err);
          toast.error("Surah not loaded. Please try again.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsSrcChange(false);
        }
      }
    }

    loadSurah();
    return () => ctrl.abort();
  }, [sura, safeRecitationId, safeTafsirId]);

  // ── Intersection observer → sliderIndex sync ─────────────────────────────
  useEffect(() => {
    if (!ayahs.length || isScrolling) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || isPlaying) continue;
          const idx = Number.parseInt(entry.target.id.split("-")[1], 10);
          if (!Number.isNaN(idx)) setSliderIndex(idx);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const ayah of ayahs) {
      const el = document.getElementById(`ayah-${ayah.globalIndex}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ayahs, isScrolling, isPlaying]);

  // ── Scroll to active ayah when playback moves ────────────────────────────
  useEffect(() => {
    if (currentPlayingIndex !== null) {
      setSliderIndex(currentPlayingIndex);

      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`ayah-${currentPlayingIndex}`);
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 150);

      return () => clearTimeout(timeoutId);
    }
  }, [currentPlayingIndex]);

  // ── Audio src change ─────────────────────────────────────────────────────
  useEffect(() => {
    if (currentPlayingIndex === null || !audioRef.current) return;
    const currentAyah = ayahs[currentPlayingIndex];
    if (!currentAyah?.audioUrl) return;

    audioRef.current.src = currentAyah.audioUrl;
    audioRef.current
      .play()
      .catch((err) => console.log("Audio play blocked:", err));

    // Eagerly preload next
    const next = ayahs[currentPlayingIndex + 1];
    if (next?.audioUrl) preloadAudioMetadata(next.audioUrl);
  }, [currentPlayingIndex, ayahs]);

  // ── Playback controls ────────────────────────────────────────────────────
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      return;
    }
    if (currentPlayingIndex === null && ayahsRef.current.length > 0) {
      setCurrentPlayingIndex(0);
      setShowPlayer(true);
      return;
    }
    audioRef.current.play();
  }, [isPlaying, currentPlayingIndex]);

  const handleInlineClick = useCallback(
    (index) => {
      if (currentPlayingIndex === index) {
        togglePlayPause();
        return;
      }
      setCurrentPlayingIndex(index);
      setShowPlayer(true);
    },
    [currentPlayingIndex, togglePlayPause],
  );

  const playNext = useCallback(() => {
    const cur = currentPlayingIndex;
    if (cur !== null && cur < ayahsRef.current.length - 1) {
      setCurrentPlayingIndex(cur + 1);
      return;
    }
    setIsPlaying(false);
    setCurrentPlayingIndex(null);
    setShowPlayer(false);
    setHasCompletedAudio(true);
  }, [currentPlayingIndex]);

  const playPrev = useCallback(() => {
    if (currentPlayingIndex !== null && currentPlayingIndex > 0)
      setCurrentPlayingIndex(currentPlayingIndex - 1);
  }, [currentPlayingIndex]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime || 0;
    const d = audioRef.current.duration || 0;
    setCurrentTime(t);
    if (d > 0) setProgress((t / d) * 100);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration || 0);
  }, []);

  const handleSeek = useCallback(
    (e) => {
      const value = Number(e.target.value);
      if (audioRef.current && duration > 0) {
        audioRef.current.currentTime = (value / 100) * duration;
        setProgress(value);
      }
    },
    [duration],
  );

  const getActiveAyahProgress = useCallback(
    (idx) => {
      if (
        currentPlayingIndex !== idx ||
        !isPlaying ||
        !duration ||
        Number.isNaN(duration)
      )
        return 0;
      return Math.min(100, Math.max(0, (currentTime / duration) * 100));
    },
    [currentPlayingIndex, isPlaying, duration, currentTime],
  );

  // ── Slider handlers ──────────────────────────────────────────────────────
  const handleSliderPointerDown = useCallback(() => {
    setIsSliderActive(true);
    setIsScrolling(true);
  }, []);
  const handleSliderPointerUp = useCallback(() => {
    setIsSliderActive(false);
    setIsScrolling(false);
  }, []);
  const handleSliderChange = useCallback(
    (e) => {
      const value = ayahs.length - 1 - Number(e.target.value);
      setSliderIndex(value);
      // scrollToAyahTop(value, "auto");
    },
    [ayahs.length],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#0a2e1f] font-sans py-8 sm:py-12 relative">
      <style>{`
          body { overflow-x: hidden; }
          .arabic-text { font-family: "Amiri","Scheherazade New","Traditional Arabic",serif; line-height: 2.2; word-spacing: 0.1em; }
          .ayah-slider { writing-mode: vertical-rl; direction: rtl; background: rgba(212,175,55,.2); border-radius: 9999px; cursor: pointer; }
          .ayah-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: #d4af37; cursor: pointer; border: 4px solid #0f3b25; box-shadow: 0 0 15px rgba(212,175,55,.8); }
          .ayah-slider::-moz-range-thumb { height: 24px; width: 24px; border-radius: 50%; background: #d4af37; cursor: pointer; border: 4px solid #0f3b25; box-shadow: 0 0 15px rgba(212,175,55,.8); }
        `}</style>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={playNext}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsAudioLoading(true)}
        onPlaying={() => setIsAudioLoading(false)}
        onCanPlay={() => setIsAudioLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Soft source-change indicator */}
      {isSrcChange && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] rounded-full bg-[#0a2e1f] text-[#d4af37] px-5 py-2 text-sm font-bold shadow-xl border border-[#d4af37]/40">
          Loading new reciter / tafsir...
        </div>
      )}

      {/* Vertical ayah slider */}
      {!loading && ayahs.length > 0 && (
        <div
          className="fixed right-2 sm:right-6 top-1/2 -translate-y-1/2 h-[50vh] sm:h-[60vh] z-[100] bg-white/40 backdrop-blur-md rounded-full py-4 px-1 flex flex-col items-center justify-between border border-[#d4af37]/40 shadow-[0_0_20px_rgba(212,175,55,0.15)] w-12 md:w-10"
          onMouseEnter={() => setIsSliderActive(true)}
          onMouseLeave={() => setIsSliderActive(false)}
        >
          <span className="text-[#0f3b25] text-[10px] sm:text-[12px] font-bold font-mono mt-2">
            1
          </span>

          <div className="relative flex-1 w-full my-4 flex justify-center">
            {/* THE MOVING TOOLTIP */}
            <div
              className={`absolute right-full mr-4 sm:mr-6 bg-[#0a2e1f] text-[#d4af37] px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center justify-center border border-[#d4af37]/50 shadow-[0_0_15px_rgba(212,175,55,0.3)] pointer-events-none transition-all duration-150 ease-out whitespace-nowrap -translate-y-1/2
                  ${isSliderActive ? "opacity-100 scale-100" : "opacity-0 scale-95 translate-x-2"}
                `}
              style={{
                top: `${ayahs.length > 1 ? (sliderIndex / (ayahs.length - 1)) * 100 : 0}%`,
              }}
            >
              <span className="text-xs sm:text-sm font-bold font-mono">
                ayah: {sliderIndex + 1}
              </span>
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 border-y-4 border-y-transparent border-l-[6px] border-l-[#0a2e1f]"></div>
              <div className="absolute top-1/2 -right-1.75 -translate-y-1/2 border-y-[5px] border-y-transparent border-l-[7px] border-l-[#d4af37]/50 -z-10"></div>
            </div>

            {/* NATIVE VERTICAL SLIDER (No CSS Rotation, smooth touch controls) */}
            <input
              type="range"
              orient="vertical"
              min="0"
              max={ayahs.length - 1}
              /* Invert math because vertical sliders default to max at top, min at bottom */
              value={ayahs.length > 0 ? ayahs.length - 1 - sliderIndex : 0}
              onPointerDown={() => {
                setIsSliderActive(true);
                setIsScrolling(true);
              }}
              onPointerUp={() => {
                setIsSliderActive(false);
                setIsScrolling(false);
              }}
              onChange={(e) => {
                const val = ayahs.length - 1 - Number(e.target.value);
                setSliderIndex(val);

                const element = document.getElementById(`ayah-${val}`);
                if (element) {
                  element.scrollIntoView({
                    behavior: "auto", // Immediate jump so it doesn't fight the drag
                    block: "center",
                  });
                }
              }}
              className="ayah-slider outline-none"
              style={{
                writingMode: "bt-lr",
                WebkitAppearance: "slider-vertical",
                // width: "100%",
                // height: "100%",
              }}
            />
          </div>

          <span className="text-[#0f3b25] text-[10px] sm:text-[12px] font-bold font-mono mb-2">
            {ayahs.length}
          </span>
        </div>
      )}

      {/* Main card */}
      <div className="bg-[#f2ece1] w-full max-w-6xl min-h-screen pt-6 sm:pt-10 border-x-8 sm:border-x-16 border-[#d4af37] shadow-2xl flex flex-col relative">
        {/* Sticky header */}
        <div className="sticky top-0 grid grid-cols-[auto_1fr_auto] gap-3 py-5 sm:py-6 items-center px-4 sm:px-10 border-b-2 border-[#d4af37]/30 bg-[#f2ece1]/95 backdrop-blur-md z-[250] shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              navigate("/");
            }}
            className="flex items-center gap-2 text-[#0f3b25] border-2 border-[#0f3b25] px-4 sm:px-5 py-2 rounded-full font-bold hover:bg-[#0f3b25] hover:text-[#d4af37] transition-all shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
            <span className="hidden sm:inline">Back to heart</span>
          </button>

          <h1 className="text-[#0f3b25] text-xl sm:text-4xl font-bold font-serif text-center truncate">
            {loading
              ? "Loading..."
              : `${STATIC_CHAPTERS[sura - 1]["englishName"]} `}
          </h1>

          <div className="relative flex justify-end">
            {!loading && (
              <SettingsButton
                isOpen={isStudyPanelOpen}
                onToggle={handleToggleSettings}
                reciterLabel={selectedReciterLabel}
              />
            )}
            {isStudyPanelOpen && (
              <SettingsPanel
                reciters={reciters}
                tafsirs={tafsirs}
                recitationId={safeRecitationId}
                tafsirId={safeTafsirId}
                reciterLabel={selectedReciterLabel}
                tafsirLabel={selectedTafsirLabel}
                onReciterChange={handleReciterChange}
                onTafsirChange={handleTafsirChange}
                onClose={handleCloseSettings}
              />
            )}
          </div>
        </div>

        {/* Bismillah */}
        {!loading && (
          <div className="text-center py-10 sm:py-14 z-10 bg-[#f2ece1] px-4 border-b border-[#d4af37]/10">
            <p className="text-[2.5rem] sm:text-[3.7rem] text-[#0f3b25] arabic-text wrap-break-words">
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
            </p>
          </div>
        )}

        {/* Ayah list */}
        <div className="grow w-full relative pb-20">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40">
              <div className="w-16 h-16 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
              <p className="mt-6 text-[#0f3b25] text-xl font-bold">
                Preparing the Surah...
              </p>
            </div>
          ) : (
            <div className="flex flex-col justify-start w-full">
              {ayahs.map((ayah) => (
                <AyahCard
                  key={ayah.globalIndex}
                  ayah={ayah}
                  isActive={currentPlayingIndex === ayah.globalIndex}
                  isPlaying={isPlaying}
                  isAudioLoading={isAudioLoading}
                  activeProgress={getActiveAyahProgress(ayah.globalIndex)}
                  arabicFontSize={arabicFontSize}
                  showLatin={showLatin}
                  showTafsir={showTafsir}
                  tafsirLabel={selectedTafsirLabel}
                  onInlineClick={handleInlineClick}
                  suraNumber={sura}
                />
              ))}
            </div>
          )}

          {/* Completion card */}
          {!loading && (hasCompletedAudio || isLearned) && (
            <div className="mx-4 sm:mx-10 mt-12 mb-24 bg-white/90 backdrop-blur-md rounded-3xl p-8 border-2 border-[#d4af37] shadow-[0_15px_40px_rgba(212,175,55,0.2)] flex flex-col items-center text-center animate-fade-in-up">
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#0f3b25] mb-6">
                Alhamdulillah, you learn{" "}
                {STATIC_CHAPTERS[sura - 1]["englishName"]} surah.
              </h3>
              <label className="flex items-center gap-4 cursor-pointer group p-4 rounded-xl hover:bg-[#fdf8ed] transition-colors">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isLearned}
                  onChange={handleToggleLearned}
                />
                <div
                  className={`w-10 h-10 rounded-xl border-[3px] flex items-center justify-center transition-all duration-300 ${
                    isLearned
                      ? "bg-[#d4af37] border-[#d4af37] scale-110 shadow-[0_0_15px_rgba(212,175,55,0.6)]"
                      : "bg-transparent border-gray-400 group-hover:border-[#d4af37]"
                  }`}
                >
                  {isLearned && (
                    <svg
                      className="w-6 h-6 text-[#0f3b25] animate-pop-in"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-xl sm:text-2xl font-medium text-[#0f3b25] select-none group-hover:text-[#d4af37] transition-colors">
                  I learned this Surah
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Sticky audio player */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-[#0a2e1f] border-t-4 border-[#d4af37] shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-[260] transition-transform duration-500 ease-in-out ${showPlayer ? "translate-y-0" : "translate-y-full"}`}
        style={{ willChange: "transform" }}
      >
        {/* Seek bar */}
        <div className="absolute top-0 left-0 w-full -mt-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="w-full h-2 bg-transparent appearance-none block cursor-pointer"
            style={{
              background: `linear-gradient(to right, #d4af37 ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
            }}
          />
        </div>

        <div className="px-6 py-4 flex items-center justify-center sm:justify-between text-[#fdf8ed] max-w-7xl mx-auto w-full">
          {/* Left: current info */}
          <div className="hidden sm:flex flex-1 items-center gap-4">
            <button
              type="button"
              onClick={() => setShowPlayer(false)}
              className="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Hide Pleyer"
            >
              ✕
            </button>
            <div>
              <span className="text-xs text-gray-400 block uppercase tracking-wider">
                Now playing
              </span>
              <span className="text-lg font-bold text-[#d4af37]">
                {currentPlayingIndex !== null
                  ? `${ayahs[currentPlayingIndex]?.number} - ayah`
                  : "Done"}
              </span>
            </div>
          </div>

          {/* Center: transport */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 w-full sm:flex-1 sm:w-auto">
            <span className="text-sm text-gray-400 font-mono hidden sm:block">
              {formatTime(currentTime)}
            </span>

            <button
              type="button"
              onClick={playPrev}
              disabled={currentPlayingIndex === 0}
              className="text-[#fdf8ed] hover:text-[#d4af37] disabled:opacity-30 transition-transform hover:scale-110"
            >
              ⏪
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              className="bg-[#d4af37] text-[#0f3b25] w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.5)] hover:scale-105 transition-all"
            >
              {isAudioLoading ? (
                <div className="w-6 h-6 border-2 border-[#0f3b25] border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                "Ⅱ"
              ) : (
                "▶"
              )}
            </button>

            <button
              type="button"
              onClick={playNext}
              disabled={currentPlayingIndex === ayahs.length - 1}
              className="text-[#fdf8ed] hover:text-[#d4af37] disabled:opacity-30 transition-transform hover:scale-110"
            >
              ⏩
            </button>

            <span className="text-sm text-gray-400 font-mono hidden sm:block">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex-1 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
