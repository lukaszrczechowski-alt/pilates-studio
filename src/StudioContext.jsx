import { createContext, useContext, useEffect, useState } from "react";
import { setEmailStudio } from "./emailService";

const StudioContext = createContext(null);

export function useStudio() {
  return useContext(StudioContext);
}

function applyBranding(studio) {
  const branding = studio?.branding || {};
  const root = document.documentElement;
  const colors = branding.colors || {};
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  if (studio?.name) document.title = studio.name;
  if (branding.favicon_url) {
    document.querySelectorAll("link[rel~='icon']").forEach(el => { el.href = branding.favicon_url; });
  }
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
        if (data) { applyBranding(data); setEmailStudio(data); }
        window.__isDemo = data?.features?.is_demo === true;
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
