import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";

export default function LandingPage({ onLogin, onRegister }) {
  const { studio } = useStudio();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const b = studio?.branding || {};
  const name = studio?.name || "Studio";
  const letter = name[0] || "S";
  const isDemo = studio?.features?.is_demo === true;
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const onCTA = isDemo ? onLogin : onRegister;

  return (
    <div className="landing">

      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          {b.logo_url
            ? <img src={b.logo_url} alt={name} style={{ height: 40, maxWidth: 160, objectFit: "contain" }} />
            : <><span className="landing-nav-letter">{letter}</span><span className="landing-nav-name">{b.nav_name || name}</span></>}
        </div>
        <div className="landing-nav-actions">
          <a href="/zapisy" className="btn btn-secondary btn-sm">{t("Harmonogram", "Schedule")}</a>
          {isMultilingual && (
            <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "pl" ? "en" : "pl")}>
              {lang === "pl" ? "🇬🇧 EN" : "🇵🇱 PL"}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>{t("Zaloguj się", "Log in")}</button>
          <button className="btn btn-primary btn-sm" onClick={onRegister}>{t("Dołącz", "Join")}</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <p className="landing-hero-eyebrow">{b.hero_eyebrow || name}</p>
          <h1 className="landing-hero-title">
            {b.hero_title || t("Zadbaj o siebie.", "Take care of yourself.")}
          </h1>
          <p className="landing-hero-sub">
            {b.hero_sub || t("Zajęcia w małych grupach, zapis online w kilku kliknięciach.", "Small group classes, online booking in a few clicks.")}
          </p>
          <div className="landing-hero-ctas">
            <button className="btn btn-primary landing-btn-lg" onClick={onCTA}>
              {isDemo ? t("Zaloguj się do demo", "Log in to demo") : t("Zarezerwuj miejsce", "Book a spot")}
            </button>
            <a href="/zapisy" className="btn btn-secondary landing-btn-lg">
              {t("Zobacz harmonogram", "View schedule")}
            </a>
          </div>
        </div>
        <div className="landing-hero-deco">
          <div className="landing-hero-circle landing-hero-circle-1" />
          <div className="landing-hero-circle landing-hero-circle-2" />
          <div className="landing-hero-big-p">{letter}</div>
        </div>
      </section>

      {/* OFERTA */}
      <section className="landing-section">
        <div className="landing-container">
          <p className="landing-label">{t("Co oferujemy", "What we offer")}</p>
          <h2 className="landing-section-title">{t("Znajdź zajęcia dla siebie", "Find the right class for you")}</h2>
          <div className="landing-cards">
            <div className="landing-card">
              <div className="landing-card-icon">🌱</div>
              <h3>{t("Zajęcia dla początkujących", "Beginner classes")}</h3>
              <p>{t("Idealne do startu — spokojne tempo, nauka poprawnej techniki i fundamentów pracy z ciałem.", "Perfect to start — gentle pace, learning proper technique and body movement fundamentals.")}</p>
            </div>
            <div className="landing-card">
              <div className="landing-card-icon">✨</div>
              <h3>{t("Zajęcia ogólnorozwojowe", "All-around classes")}</h3>
              <p>{t("Pełna praca ciała, wzmacnianie core, elastyczność. Dla każdego kto chce czuć się lepiej każdego dnia.", "Full-body workout, core strengthening, flexibility. For everyone who wants to feel better every day.")}</p>
            </div>
            <div className="landing-card">
              <div className="landing-card-icon">🔥</div>
              <h3>{t("Zajęcia zaawansowane", "Advanced classes")}</h3>
              <p>{t("Intensywniejszy trening dla osób z doświadczeniem — wyzwanie dla ciała i umysłu.", "More intense training for experienced participants — a challenge for body and mind.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* JAK TO DZIAŁA */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <p className="landing-label">{t("Jak to działa", "How it works")}</p>
          <h2 className="landing-section-title">{t("Trzy kroki do zajęć", "Three steps to your class")}</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">1</div>
              <h3>{t("Załóż konto", "Create an account")}</h3>
              <p>{t("Rejestracja zajmuje minutę — podaj imię, email i hasło. Bez zbędnych formalności.", "Registration takes a minute — enter your name, email and password. No fuss.")}</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">2</div>
              <h3>{t("Wybierz termin", "Pick a time slot")}</h3>
              <p>{t("Przeglądaj dostępne zajęcia i zapisz się na wybrany termin jednym kliknięciem.", "Browse available classes and book your chosen slot with one click.")}</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">3</div>
              <h3>{t("Przyjdź i ćwicz", "Come and train")}</h3>
              <p>{t("Dostaniesz potwierdzenie. Reszta należy do Ciebie — do zobaczenia!", "You'll get a confirmation. The rest is up to you — see you there!")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2>{b.cta_title || t("Gotowa, żeby zacząć?", "Ready to get started?")}</h2>
          <p>{b.cta_sub || t("Dołącz do studia — pierwsze kroki są najważniejsze.", "Join the studio — the first steps are the most important.")}</p>
          <button className="btn btn-primary landing-btn-lg" onClick={onCTA}>
            {isDemo ? t("Zaloguj się do demo", "Log in to demo") : t("Zarejestruj się za darmo", "Sign up for free")}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span className="landing-footer-logo">
            {b.logo_url
              ? <img src={b.logo_url} alt={name} style={{ height: 36, maxWidth: 140, objectFit: "contain" }} />
              : (b.nav_name || name)}
          </span>
          <span className="landing-footer-copy">© {new Date().getFullYear()} {name}. {t("Wszelkie prawa zastrzeżone.", "All rights reserved.")}</span>
        </div>
      </footer>

    </div>
  );
}
