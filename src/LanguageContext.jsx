import { createContext, useContext, useState } from "react";
import { useStudio } from "./StudioContext";

// Osobny kontekst tylko dla surowego stanu języka — bez zależności od studio
const LangStateContext = createContext({ lang: "pl", setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "pl" || saved === "en") return saved;
    } catch {}
    return navigator.language?.startsWith("pl") ? "pl" : "en";
  });

  function setLang(l) {
    localStorage.setItem("lang", l);
    setLangState(l);
  }

  return (
    <LangStateContext.Provider value={{ lang, setLang }}>
      {children}
    </LangStateContext.Provider>
  );
}

// useLang: filtruje przez isMultilingual — każdy komponent liczy to sam
export function useLang() {
  const { studio } = useStudio();
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const { lang } = useContext(LangStateContext);
  return isMultilingual ? lang : "pl";
}

// useSetLang: zawsze zwraca setter — niezależnie od isMultilingual
export function useSetLang() {
  return useContext(LangStateContext).setLang;
}

export function useT() {
  const lang = useLang();
  return (pl, en) => lang === "en" ? (en ?? pl) : pl;
}
