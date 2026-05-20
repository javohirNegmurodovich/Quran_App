import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "../zustand/store";

export default function ProtectedRoute({ children }) {
  const user = useStore((state) => state.user);
  const openAuthModal = useStore((state) => state.openAuthModal);

  useEffect(() => {
    // If they bypass the heart and type the URL, trigger the login popup
    // if (!user) {
    //   openAuthModal();
    // }
  }, [user, openAuthModal]);

  // If there is no user, kick them back to the home page immediately
  // if (!user) {
  //   return <Navigate to="/" replace />;
  // }

  // If they ARE logged in, let them through to the Surah page
  return children;
}
