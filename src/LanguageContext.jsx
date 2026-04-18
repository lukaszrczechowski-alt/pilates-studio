import { createContext, useContext } from "react";
import { useStudio } from "./StudioContext";

function getSavedLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "pl" || saved === "en") return saved;
  } catch {}
  return navigator.language?.startsWith("pl") ? "pl" : "en";
}

const lang = getSavedLang(); // moduł-level — stały przez całą sesję

const LanguageContext = createContext(lang);

export function LanguageProvider({ children }) {
  const { studio } = useStudio();
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const effectiveLang = isMultilingual ? lang : "pl";
  return (
    <LanguageContext.Provider value={effectiveLang}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

export function useSetLang() {
  return (l) => {
    localStorage.setItem("lang", l);
    window.location.reload();
  };
}

export function useT() {
  const l = useLang();
  return (pl, en) => l === "en" ? (en ?? pl) : pl;
}
