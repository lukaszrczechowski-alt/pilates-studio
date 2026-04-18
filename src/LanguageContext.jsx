import { createContext, useContext, useState } from "react";
import { useStudio } from "./StudioContext";

const LanguageContext = createContext({ lang: "pl", setLang: () => {} });

export function useLang() {
  return useContext(LanguageContext).lang;
}

export function useSetLang() {
  return useContext(LanguageContext).setLang;
}

export function useT() {
  const lang = useLang();
  return (pl, en) => lang === "en" ? (en ?? pl) : pl;
}

export function LanguageProvider({ children }) {
  const { studio } = useStudio();
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;

  // Initialize from localStorage first, then browser — niezależnie od isMultilingual
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "pl" || saved === "en") return saved;
    return navigator.language?.startsWith("pl") ? "pl" : "en";
  });

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  return (
    <LanguageContext.Provider value={{ lang: isMultilingual ? lang : "pl", setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
