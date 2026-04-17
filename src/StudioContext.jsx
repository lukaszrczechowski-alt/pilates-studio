import { createContext, useContext, useEffect, useState } from "react";

const StudioContext = createContext(null);

export function useStudio() {
  return useContext(StudioContext);
}

export function StudioProvider({ children }) {
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const hostname = window.location.hostname;

    // Localhost dev — zwróć studio Pauliny na podstawie env var lub hardcode slug
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const devSlug = import.meta.env.VITE_DEV_STUDIO_SLUG || "paula";
      fetch(`/api/get-studio?domain=${devSlug}.studiova.app`)
        .then(r => r.json())
        .then(data => { setStudio(data); setLoading(false); })
        .catch(() => {
          // Fallback gdy API jeszcze nie działa (brak migracji) — mock studio
          setStudio({ id: null, name: "Paula Pilates", slug: "paula", domain: "paulapilates.pl", features: {} });
          setLoading(false);
        });
      return;
    }

    fetch(`/api/get-studio?domain=${hostname}`)
      .then(r => {
        if (!r.ok) throw new Error("Studio not found");
        return r.json();
      })
      .then(data => { setStudio(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  return (
    <StudioContext.Provider value={{ studio, loading, error }}>
      {children}
    </StudioContext.Provider>
  );
}
