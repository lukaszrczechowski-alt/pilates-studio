import { createContext, useContext, useEffect, useState } from "react";

const StudioContext = createContext(null);

export function useStudio() {
  return useContext(StudioContext);
}

export function StudioProvider({ children }) {
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;

    fetch(`/api/get-studio?domain=${hostname}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setStudio(data || { id: null, features: {} }); setLoading(false); })
      .catch(() => { setStudio({ id: null, features: {} }); setLoading(false); });
  }, []);

  return (
    <StudioContext.Provider value={{ studio, loading }}>
      {children}
    </StudioContext.Provider>
  );
}
