import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";

function NavLogo({ b, name, letter }) {
  if (b.logo_url) return (
    <img src={b.logo_url} alt={name} style={{ height: 40, maxWidth: 160, objectFit: "contain" }} />
  );
  return (
    <>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#8A9E85", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.4rem", fontWeight: 300, color: "#fff", flexShrink: 0 }}>{letter}</div>
      <div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 300, color: "#2C2C2C", letterSpacing: "0.05em", lineHeight: 1.1 }}>{name}</div>
        {b.nav_name && b.nav_name !== name && (
          <div style={{ fontSize: "0.68rem", color: "#8A9E85", letterSpacing: "0.15em", textTransform: "uppercase", lineHeight: 1 }}>{b.nav_name}</div>
        )}
      </div>
    </>
  );
}

/* ─── Szablon: MINIMAL (domyślny) ─────────────────────────────────────────
   Jeden ekran, bez scrollowania. Nav + hero na całą wysokość okna.
   Idealny dla nowych studiów i branż innych niż pilates.             */
function LandingMinimal({ onLogin, onRegister }) {
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--cream)", overflow: "hidden" }}>

      {/* NAV */}
      <nav className="landing-nav" style={{ flexShrink: 0 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <NavLogo b={b} name={name} letter={letter} />
        </a>
        <div className="landing-nav-actions">
          <a href="/zapisy" className="btn btn-secondary btn-sm">{t("Harmonogram", "Schedule")}</a>
          <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "pl" ? "en" : "pl")}>
            {lang === "pl" ? "EN" : "PL"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>{t("Zaloguj się", "Log in")}</button>
          {!isDemo && <button className="btn btn-primary btn-sm" onClick={onRegister}>{t("Dołącz", "Join")}</button>}
        </div>
      </nav>

      {/* HERO — cała pozostała przestrzeń */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {/* tło */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--cream) 50%, var(--sage-light) 100%)", opacity: 0.5 }} />
        <div className="landing-hero-deco" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div className="landing-hero-circle landing-hero-circle-1" />
          <div className="landing-hero-circle landing-hero-circle-2" />
          <div className="landing-hero-big-p" style={{ fontSize: "clamp(8rem,22vw,18rem)", opacity: 0.06 }}>{letter}</div>
        </div>

        {/* treść */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "1.5rem 2rem", maxWidth: 600 }}>
          <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--sage-dark)", fontWeight: 500, marginBottom: "1rem" }}>
            {b.hero_eyebrow || name}
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(3rem,8vw,5.5rem)", fontWeight: 300, lineHeight: 1.05, color: "var(--charcoal)", marginBottom: "1.25rem" }}>
            {b.hero_title || t("Zadbaj o siebie.", "Take care of yourself.")}
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--mid)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: 440, margin: "0 auto 2rem" }}>
            {b.hero_sub || t("Rezerwuj zajęcia online w kilku kliknięciach.", "Book your classes online in a few clicks.")}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary landing-btn-lg" onClick={onCTA}>
              {isDemo ? t("Zaloguj się do demo", "Log in to demo") : t("Zarezerwuj miejsce", "Book a spot")}
            </button>
            <a href="/zapisy" className="btn btn-secondary landing-btn-lg">
              {t("Zobacz harmonogram", "View schedule")}
            </a>
          </div>
        </div>
      </div>

      {/* FOOTER — cienki pasek */}
      <footer style={{ flexShrink: 0, padding: "0.75rem 2rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--light)" }}>
        <span>{b.nav_name || name}</span>
        <span>© {new Date().getFullYear()} {name}</span>
      </footer>

    </div>
  );
}

/* ─── Szablon: CLASSIC (pełna strona, poprzednia wersja) ──────────────── */
function LandingClassic({ onLogin, onRegister }) {
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
      <nav className="landing-nav">
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <NavLogo b={b} name={name} letter={letter} />
        </a>
        <div className="landing-nav-actions">
          <a href="/zapisy" className="btn btn-secondary btn-sm">{t("Harmonogram", "Schedule")}</a>
          <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "pl" ? "en" : "pl")}>
            {lang === "pl" ? "EN" : "PL"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>{t("Zaloguj się", "Log in")}</button>
          {!isDemo && <button className="btn btn-primary btn-sm" onClick={onRegister}>{t("Dołącz", "Join")}</button>}
        </div>
      </nav>

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
            <a href="/zapisy" className="btn btn-secondary landing-btn-lg">{t("Zobacz harmonogram", "View schedule")}</a>
          </div>
        </div>
        <div className="landing-hero-deco">
          <div className="landing-hero-circle landing-hero-circle-1" />
          <div className="landing-hero-circle landing-hero-circle-2" />
          <div className="landing-hero-big-p">{letter}</div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <p className="landing-label">{t("Co oferujemy", "What we offer")}</p>
          <h2 className="landing-section-title">{t("Znajdź zajęcia dla siebie", "Find the right class for you")}</h2>
          <div className="landing-cards">
            {(b.offer_cards || [
              { icon: "🌱", title: t("Zajęcia dla początkujących","Beginner classes"), text: t("Idealne do startu — spokojne tempo, nauka poprawnej techniki.","Perfect to start — gentle pace, proper technique.") },
              { icon: "✨", title: t("Zajęcia ogólnorozwojowe","All-around classes"), text: t("Pełna praca ciała, wzmacnianie core, elastyczność.","Full-body workout, core strengthening, flexibility.") },
              { icon: "🔥", title: t("Zajęcia zaawansowane","Advanced classes"), text: t("Intensywniejszy trening dla osób z doświadczeniem.","More intense training for experienced participants.") },
            ]).map((card, i) => (
              <div key={i} className="landing-card">
                <div className="landing-card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <p className="landing-label">{t("Jak to działa", "How it works")}</p>
          <h2 className="landing-section-title">{t("Trzy kroki do zajęć", "Three steps to your class")}</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">1</div>
              <h3>{t("Załóż konto", "Create an account")}</h3>
              <p>{t("Rejestracja zajmuje minutę.", "Registration takes a minute.")}</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">2</div>
              <h3>{t("Wybierz termin", "Pick a time slot")}</h3>
              <p>{t("Przeglądaj dostępne zajęcia i zapisz się jednym kliknięciem.", "Browse and book with one click.")}</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">3</div>
              <h3>{t("Przyjdź i ćwicz", "Come and train")}</h3>
              <p>{t("Dostaniesz potwierdzenie. Do zobaczenia!", "You'll get a confirmation. See you there!")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2>{b.cta_title || t("Gotowa, żeby zacząć?", "Ready to get started?")}</h2>
          <p>{b.cta_sub || t("Dołącz do studia — pierwsze kroki są najważniejsze.", "Join the studio — the first steps are the most important.")}</p>
          <button className="btn btn-primary landing-btn-lg" onClick={onCTA}>
            {isDemo ? t("Zaloguj się do demo", "Log in to demo") : t("Zarejestruj się za darmo", "Sign up for free")}
          </button>
        </div>
      </section>

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

/* ─── Szablon: BOLD (split-screen) ───────────────────────────────────────
   Lewa połowa: sage z dużą literą. Prawa połowa: cream z treścią + nav.
   Mocny, wyrazisty charakter — dobry dla studiów z silną marką.        */
function LandingBold({ onLogin, onRegister }) {
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
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}>

      {/* LEWA — sage panel */}
      <div style={{ width: "42%", flexShrink: 0, background: "var(--sage)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", fontSize: "clamp(10rem,28vw,22rem)", fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, color: "rgba(255,255,255,0.12)", lineHeight: 1, userSelect: "none", bottom: "-2rem", right: "-1rem" }}>
          {letter}
        </div>
        <a href="/" style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "2rem", textDecoration: "none", display: "block" }}>
          {b.logo_url
            ? <img src={b.logo_url} alt={name} style={{ height: 56, maxWidth: 200, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            : <>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", color: "white" }}>{letter}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.4rem,3vw,2rem)", fontWeight: 300, color: "white", letterSpacing: "0.08em" }}>{b.nav_name || name}</div>
              </>}
          <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.4)", margin: "1.5rem auto" }} />
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.2em" }}>
            {b.hero_eyebrow || t("Twoje studio", "Your studio")}
          </p>
        </a>
      </div>

      {/* PRAWA — treść */}
      <div style={{ flex: 1, background: "var(--cream)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* mini nav */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", height: 64, padding: "0 2rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <a href="/zapisy" className="btn btn-secondary btn-sm">{t("Harmonogram", "Schedule")}</a>
          <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "pl" ? "en" : "pl")}>
            {lang === "pl" ? "EN" : "PL"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>{t("Zaloguj się", "Log in")}</button>
          {!isDemo && <button className="btn btn-primary btn-sm" onClick={onRegister}>{t("Dołącz", "Join")}</button>}
        </div>

        {/* hero treść */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "2rem 3rem" }}>
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(2.8rem,5vw,4.5rem)", fontWeight: 300, lineHeight: 1.05, color: "var(--charcoal)", marginBottom: "1.25rem" }}>
              {b.hero_title || t("Zadbaj o siebie.", "Take care of yourself.")}
            </h1>
            <p style={{ fontSize: "1rem", color: "var(--mid)", lineHeight: 1.75, marginBottom: "2.5rem", maxWidth: 400 }}>
              {b.hero_sub || t("Rezerwuj zajęcia online w kilku kliknięciach.", "Book your classes online in a few clicks.")}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary landing-btn-lg" onClick={onCTA}>
                {isDemo ? t("Zaloguj się do demo", "Log in to demo") : t("Zarezerwuj miejsce", "Book a spot")}
              </button>
              <a href="/zapisy" className="btn btn-secondary landing-btn-lg">
                {t("Zobacz harmonogram", "View schedule")}
              </a>
            </div>
          </div>
        </div>

        {/* footer */}
        <footer style={{ flexShrink: 0, padding: "0.75rem 2rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--light)" }}>
          <span>{b.nav_name || name}</span>
          <span>© {new Date().getFullYear()} {name}</span>
        </footer>
      </div>
    </div>
  );
}

/* ─── Router szablonów ────────────────────────────────────────────────────
   Dostępne: "minimal" (domyślny), "classic", "bold"
   Zmiana: panel admina → Ustawienia → Wygląd → Szablon strony głównej  */
export default function LandingPage({ onLogin, onRegister }) {
  const { studio } = useStudio();
  const template = studio?.features?.landing_template || "minimal";

  if (template === "classic") return <LandingClassic onLogin={onLogin} onRegister={onRegister} />;
  if (template === "bold")    return <LandingBold    onLogin={onLogin} onRegister={onRegister} />;
  return <LandingMinimal onLogin={onLogin} onRegister={onRegister} />;
}
