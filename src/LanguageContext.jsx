import { createContext, useContext } from "react";
import { useStudio } from "./StudioContext";

const LanguageContext = createContext("pl");

export function useLang() {
  return useContext(LanguageContext);
}

// t(pl, en) — returns en when lang=en, pl otherwise
export function useT() {
  const lang = useLang();
  return (pl, en) => lang === "en" ? (en ?? pl) : pl;
}

export function LanguageProvider({ children }) {
  const { studio } = useStudio();
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const browserLang = navigator.language?.startsWith("pl") ? "pl" : "en";
  const lang = isMultilingual ? browserLang : "pl";

  return (
    <LanguageContext.Provider value={lang}>
      {children}
    </LanguageContext.Provider>
  );
}
