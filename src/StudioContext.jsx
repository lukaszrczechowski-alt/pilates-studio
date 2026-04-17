import { createContext, useContext, useEffect, useState } from "react";

const StudioContext = createContext(null);

export function useStudio() {
  return useContext(StudioContext);
}

function applyBranding(branding) {
  if (!branding) return;
  const root = document.documentElement;
  const colors = branding.colors || {};
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}

export function StudioProvider({ children }) {
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname.replace(/^www\./, "");

    fetch(`/api/get-studio?domain=${hostname}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setStudio(data || { id: null, features: {}, branding: {} });
        if (data?.branding) applyBranding(data.branding);
        setLoading(false);
      })
      .catch(() => {
        setStudio({ id: null, features: {}, branding: {} });
        setLoading(false);
      });
  }, []);

  return (
    <StudioContext.Provider value={{ studio, loading }}>
      {children}
    </StudioContext.Provider>
  );
}
