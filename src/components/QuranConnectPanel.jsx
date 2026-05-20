import { useEffect, useState } from "react";
import {
  addQuranBookmark,
  connectQuranCom,
  disconnectQuranCom,
  getQuranBookmarks,
  getQuranConnectionStatus,
  getQuranProfile,
  getQuranStreaks,
} from "../utils/quranUserApi";

export default function QuranConnectPanel() {
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadQuranUserData = async () => {
    setLoading(true);

    try {
      const status = await getQuranConnectionStatus();
      setConnected(Boolean(status.connected));

      if (status.connected) {
        const [profileJson, bookmarksJson, streaksJson] = await Promise.all([
          getQuranProfile(),
          getQuranBookmarks(),
          getQuranStreaks(),
        ]);

        setProfile(profileJson);
        setBookmarks(bookmarksJson.data || []);
        setStreaks(streaksJson.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuranUserData();
  }, []);

  return (
    <div className="rounded-3xl border border-[#d4af37]/30 bg-[#0a2e1f]/95 text-[#fdf8ed] p-5 shadow-2xl max-w-md">
      <h2 className="text-xl font-bold text-[#d4af37]">Quran.com ulanishi</h2>

      <p className="mt-2 text-sm text-white/70">
        Bookmark, reading progress va streaklarni Quran.com akkauntingiz bilan
        sinxron qiling.
      </p>

      {loading ? (
        <p className="mt-4 text-[#d4af37]">Tekshirilmoqda...</p>
      ) : connected ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="font-bold text-[#d4af37]">Ulangan ✅</p>
            <p className="text-sm text-white/70">
              {profile?.firstName || profile?.username || "Quran.com user"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold text-[#d4af37]">
                {bookmarks.length}
              </p>
              <p className="text-xs text-white/70">Quran.com bookmarks</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold text-[#d4af37]">
                {streaks[0]?.days || 0}
              </p>
              <p className="text-xs text-white/70">Active streak</p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await addQuranBookmark({
                surahNumber: 1,
                ayahNumber: 1,
              });

              await loadQuranUserData();
            }}
            className="w-full rounded-full bg-[#d4af37] text-[#0a2e1f] px-4 py-3 font-bold hover:scale-[1.02] transition-transform"
          >
            Test bookmark: Al-Fatihah 1
          </button>

          <button
            type="button"
            onClick={async () => {
              await disconnectQuranCom();
              setConnected(false);
              setProfile(null);
              setBookmarks([]);
              setStreaks([]);
            }}
            className="w-full rounded-full border border-[#d4af37]/40 px-4 py-3 font-bold text-[#d4af37]"
          >
            Quran.com’dan uzish
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={connectQuranCom}
          className="mt-5 w-full rounded-full bg-[#d4af37] text-[#0a2e1f] px-4 py-3 font-bold hover:scale-[1.02] transition-transform"
        >
          Quran.com akkauntni ulash
        </button>
      )}
    </div>
  );
}
