import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useStore } from "../zustand/store";

function cleanMessage(value) {
  return decodeURIComponent(String(value || "").replace(/\+/g, " "));
}

export default function QuranOAuthFeedback() {
  const location = useLocation();
  const navigate = useNavigate();
  const loadQuranSession = useStore((state) => state.loadQuranSession);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get("qf_connected");
    const error = params.get("qf_error");

    if (!connected && !error) return;

    async function handleOAuthReturn() {
      if (error) {
        toast.error(`Quran.com connection failed: ${cleanMessage(error)}`, {
          duration: 7000,
        });

        navigate(location.pathname, { replace: true });
        return;
      }

      const toastId = toast.loading("Checking your Quran.com session...");

      const ok = await loadQuranSession({ silent: true });

      if (ok) {
        toast.success("Your Quran.com account is connected ✅", {
          id: toastId,
          duration: 4500,
        });
      } else {
        toast.error("No Quran.com session was found. Please sign in again.", {
          id: toastId,
          duration: 6000,
        });
      }

      navigate(location.pathname, { replace: true });
    }

    handleOAuthReturn();
  }, [location.pathname, location.search, navigate, loadQuranSession]);

  return null;
}
