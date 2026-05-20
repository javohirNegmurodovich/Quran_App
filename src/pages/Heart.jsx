// ─────────────────────────────────────────────────────────────────────────────
// Heart.jsx  —  Performance-optimised edition
// Changes vs original:
//   • preloadAsset("/heart14.glb") called ONCE (was called twice)
//   • Search input debounced 120 ms → avoids per-keystroke filteredData memo
//   • Canvas DPR capped tighter on mobile; frameloop="demand" saves GPU
//   • ModelLoadingOverlay extracted + memo'd
//   • SearchDropdown extracted + memo'd — only re-renders when results change
//   • handleSurahIntent stable via useCallback
//   • StatusBadge extracted + memo'd
//   • No duplicate warmBootQuranData calls across render cycles
// ─────────────────────────────────────────────────────────────────────────────

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Model from "../components/Model";
import { uzbekSurahMeanings } from "../utils/uzbekSuraMeaning";
import {
  STATIC_CHAPTERS,
  getChapters,
  readCachedChapters,
  warmBootQuranData,
  prefetchSurah,
  preloadAsset,
  normalizeId,
} from "../utils/quranClientCache";
import { useSettingsStore } from "../zustand/store";

// ─── Sub-components ───────────────────────────────────────────────────────────

const ModelLoadingOverlay = memo(function ModelLoadingOverlay() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[5] flex items-center justify-center pointer-events-none">
      <div className="rounded-3xl border border-[#d4af37]/30 bg-[#061d14]/80 backdrop-blur-md px-6 py-5 text-center shadow-2xl">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-[#d4af37] border-t-transparent animate-spin" />
        <p className="mt-4 text-[#d4af37] font-bold">Heart is connecting...</p>
        <p className="mt-1 text-xs text-white/50">{Math.round(progress)}%</p>
      </div>
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({ apiStatus }) {
  const label =
    {
      warming: "Preparing datas...",
      cached: "Load from cashe",
      ready: "Quran Foundation API connected",
      fallback: "Worked from cashed data",
      error: "API is slow — cashed data shown",
    }[apiStatus] ?? "";

  const dotClass =
    apiStatus === "ready" || apiStatus === "cached"
      ? "bg-emerald-400"
      : apiStatus === "warming"
        ? "bg-[#d4af37] animate-pulse"
        : "bg-orange-400";

  return (
    <div className="pointer-events-auto absolute bottom-2 left-2 leading-2 rounded-full border border-[#d4af37]/30 bg-[#061d14]/70 backdrop-blur-md px-4 py-2 text-xs sm:text-sm text-[#fdf8ed]/85 shadow-lg">
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${dotClass}`} />
      {label}
    </div>
  );
});

const SearchDropdown = memo(function SearchDropdown({
  filteredData,
  searchQuery,
  onSelect,
  onIntent,
}) {
  if (!searchQuery) return null;

  return (
    <div className="absolute top-full left-0 w-full mt-3 bg-[#fdf8ed]/98 border border-[#d4af37]/40 max-h-[420px] overflow-y-auto rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.7)] z-30 custom-scrollbar backdrop-blur-xl">
      {filteredData.length > 0 ? (
        filteredData.map((surah, index) => (
          <button
            type="button"
            key={surah.number}
            className={`w-full px-5 py-4 cursor-pointer transition-colors duration-200 flex justify-between items-center gap-4 text-left group hover:bg-[#d4af37] hover:text-[#0f3b25] ${
              index !== filteredData.length - 1
                ? "border-b border-[#d4af37]/20"
                : ""
            }`}
            onPointerEnter={() => onIntent(surah.number)}
            onFocus={() => onIntent(surah.number)}
            onClick={() => onSelect(surah)}
          >
            <div className="min-w-0">
              <strong className="block text-base sm:text-lg text-[#0f3b25] group-hover:text-[#0a2e1f] truncate">
                {surah.number}. {surah.englishName}
              </strong>
              <span className="block text-[#666] text-sm group-hover:text-[#0a2e1f] truncate">
                {uzbekSurahMeanings[surah.number] || "Qur'on surasi"}
              </span>
            </div>
            <span className="text-xl sm:text-2xl text-[#0f3b25] font-serif opacity-80 group-hover:opacity-100 shrink-0">
              {surah.name}
            </span>
          </button>
        ))
      ) : (
        <div className="px-5 py-5 text-[#0f3b25]/70 font-medium">
          Surah not found. e.g: <b>Sharh</b>, <b>Fatiha</b>, <b>Ya Sin</b>, or{" "}
          <b>94</b>.
        </div>
      )}
    </div>
  );
});

// ─── Canvas config (stable objects → no re-creation each render) ──────────────

const CAMERA_MOBILE = { position: [0, 0, 4.3], fov: 23 };
const CAMERA_DESKTOP = { position: [0, 0, 4.8], fov: 15 };
const GL_OPTIONS = {
  antialias: false,
  powerPreference: "high-performance",
  alpha: true,
};
const PERF_OPTIONS = { min: 0.45, max: 1, debounce: 250 };

// ─── Main component ───────────────────────────────────────────────────────────

function Heart() {
  const { recitationId = "7", tafsirId = "169" } = useSettingsStore();

  const safeRecitationId = normalizeId(recitationId, "7");
  const safeTafsirId = normalizeId(tafsirId, "169");

  // Raw search state (updates every keystroke for controlled input)
  const [searchQuery, setSearchQuery] = useState("");
  // Debounced query used for filtering (prevents per-keystroke re-computation)
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [searchedSurahIndex, setSearchedSurahIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [data, setData] = useState(
    () => readCachedChapters() || STATIC_CHAPTERS,
  );
  const [apiStatus, setApiStatus] = useState(
    readCachedChapters() ? "cached" : "warming",
  );

  // Stable ref for debounce timer
  const debounceRef = useRef(null);
  const lastIntentRef = useRef(new Map());
  // Track whether warm-boot was already triggered for this settings combo
  const warmBootKeyRef = useRef(null);

  // ── GLB preload — runs once on mount ────────────────────────────────────────
  useEffect(() => {
    preloadAsset("/heart14.glb", "fetch");
  }, []);

  // ── Warm-boot + chapter fetch — only when reciter/tafsir actually change ────
  useEffect(() => {
    const bootKey = `${safeRecitationId}:${safeTafsirId}`;
    if (warmBootKeyRef.current !== bootKey) {
      warmBootKeyRef.current = bootKey;
      warmBootQuranData({
        recitationId: safeRecitationId,
        tafsirId: safeTafsirId,
      });
    }

    const ctrl = new AbortController();

    getChapters({ signal: ctrl.signal })
      .then((chapters) => {
        if (!chapters?.length) return;
        setData(chapters);
        setApiStatus(chapters.some((c) => c.isFallback) ? "fallback" : "ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to load chapters:", err);
        setData((cur) => (cur?.length ? cur : STATIC_CHAPTERS));
        setApiStatus("fallback");
      });

    return () => ctrl.abort();
  }, [safeRecitationId, safeTafsirId]);

  // ── Resize listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Debounce search input 120 ms ────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 120);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  // ── Surah intent prefetch (throttled per key, 3.5 s) ────────────────────────
  const handleSurahIntent = useCallback(
    (surahNumber) => {
      if (!surahNumber) return Promise.resolve(null);
      const key = `${surahNumber}:${safeRecitationId}:${safeTafsirId}`;
      const now = Date.now();
      const last = lastIntentRef.current.get(key) || 0;
      if (now - last < 3500) return Promise.resolve(null);
      lastIntentRef.current.set(key, now);
      return prefetchSurah(surahNumber, safeRecitationId, safeTafsirId);
    },
    [safeRecitationId, safeTafsirId],
  );

  // ── Filter against debounced query ──────────────────────────────────────────
  const filteredData = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return [];

    return data
      .filter((surah) => {
        const en = String(surah.englishName || "").toLowerCase();
        const ar = String(surah.name || "");
        const meaning = String(
          uzbekSurahMeanings[surah.number] || "",
        ).toLowerCase();
        return (
          en.includes(query) ||
          ar.includes(debouncedQuery.trim()) ||
          meaning.includes(query) ||
          String(surah.number) === query
        );
      })
      .slice(0, 12);
  }, [debouncedQuery, data]);

  // ── Dropdown handlers ───────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (surah) => {
      handleSurahIntent(surah.number);
      setSearchedSurahIndex(surah.number - 1);
      setSearchQuery("");
    },
    [handleSurahIntent],
  );

  const camera = isMobile ? CAMERA_MOBILE : CAMERA_DESKTOP;
  const dpr = isMobile ? [0.6, 0.9] : [1, 1.25];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed w-screen h-dvh bg-[radial-gradient(circle_at_center,#11402d_0%,#05140e_80%,#000000_100%)] font-sans overflow-hidden flex flex-col items-center">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 z-20 w-full pointer-events-none">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 pt-4">
          {/* Search bar */}
          <div className="relative tour-search-bar w-[92vw] sm:w-[430px] pointer-events-auto">
            <div className="relative shadow-[0_15px_30px_rgba(0,0,0,0.6)] rounded-full">
              <span className="absolute inset-y-0 z-20 left-0 flex items-center pl-6 text-[#d4af37] text-2xl">
                🔍
              </span>
              <input
                id="search"
                type="search"
                placeholder="Search surah: Sharh, Ya Sin, 94..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#fdf8ed]/95 backdrop-blur-md border border-[#d4af37]/50 text-[#0f3b25] pl-14 pr-6 py-3.5 rounded-full outline-none focus:ring-2 focus:ring-[#d4af37] transition-all text-base sm:text-lg placeholder-[#0f3b25]/50 font-medium"
              />
            </div>

            <SearchDropdown
              filteredData={filteredData}
              searchQuery={searchQuery}
              onSelect={handleSelect}
              onIntent={handleSurahIntent}
            />
          </div>
        </div>
      </div>
      <StatusBadge apiStatus={apiStatus} />

      {/* ── 3D loader overlay ─────────────────────────────────────────────── */}
      <ModelLoadingOverlay />

      {/* ── Three.js canvas ───────────────────────────────────────────────── */}
      <div className="absolute tour-heart-canvas inset-0 z-0 flex items-center justify-center">
        <Canvas
          dpr={dpr}
          performance={PERF_OPTIONS}
          gl={GL_OPTIONS}
          camera={camera}
          // "demand" → only re-renders when something changes; saves GPU on idle
          frameloop="demand"
        >
          <ambientLight intensity={1.25} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={2.0}
            color="#c4d4d8"
          />
          <directionalLight
            position={[-5, -5, -5]}
            intensity={0.7}
            color="#d4af37"
          />

          <Suspense fallback={null}>
            <Model
              isMobile={isMobile}
              scale={1.3}
              data={data}
              searchedIndex={searchedSurahIndex}
              onSurahIntent={handleSurahIntent}
            />
          </Suspense>

          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.65}
            minDistance={3.5}
            maxDistance={8}
            makeDefault
          />
        </Canvas>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(212,175,55,0.05); margin: 10px 0; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 10px; }
      `}</style>

      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-5 z-10 text-right pointer-events-none select-none flex flex-col items-end">
        <div className="flex items-center gap-2 opacity-50">
          <svg
            className="w-3 h-3 text-[#d4af37]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <p className="text-xs font-serif font-bold tracking-widest text-[#d4af37]">
            NABZI SAKINAH
            <span className="text-sm block font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#fef3c7] via-[#d4af37] to-[#92400e] opacity-70">
              Javohir Hasanov
            </span>
          </p>
        </div>
        <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 mt-1 font-mono">
          Versiya 1.0
        </p>
      </div>
    </div>
  );
}

export default Heart;
