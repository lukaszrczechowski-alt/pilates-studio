export default function LandingPage({ onLogin, onRegister }) {
  return (
    <div className="landing">

      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <span className="landing-nav-letter">P</span>
          <span className="landing-nav-name">Pilates <em>by Paulina</em></span>
        </div>
        <div className="landing-nav-actions">
          <a href="/zapisy" className="btn btn-secondary btn-sm">Harmonogram</a>
          <button className="btn btn-secondary btn-sm" onClick={onLogin}>Zaloguj się</button>
          <button className="btn btn-primary btn-sm" onClick={onRegister}>Dołącz</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <p className="landing-hero-eyebrow">Studio by Paulina</p>
          <h1 className="landing-hero-title">
            Zadbaj<br />o siebie.
          </h1>
          <p className="landing-hero-sub">
            Pilates dla każdego — zajęcia w małych grupach,<br />
            zapis online w kilku kliknięciach.
          </p>
          <div className="landing-hero-ctas">
            <button className="btn btn-primary landing-btn-lg" onClick={onRegister}>
              Zarezerwuj miejsce
            </button>
            <a href="/zapisy" className="btn btn-secondary landing-btn-lg">
              Zobacz harmonogram
            </a>
          </div>
        </div>
        <div className="landing-hero-deco">
          <div className="landing-hero-circle landing-hero-circle-1" />
          <div className="landing-hero-circle landing-hero-circle-2" />
          <div className="landing-hero-big-p">P</div>
        </div>
      </section>

      {/* OFERTA */}
      <section className="landing-section">
        <div className="landing-container">
          <p className="landing-label">Co oferujemy</p>
          <h2 className="landing-section-title">Znajdź zajęcia dla siebie</h2>
          <div className="landing-cards">
            <div className="landing-card">
              <div className="landing-card-icon">🌱</div>
              <h3>Pilates dla początkujących</h3>
              <p>Idealne do startu — spokojne tempo, nauka poprawnej techniki i fundamentów pracy z ciałem.</p>
            </div>
            <div className="landing-card">
              <div className="landing-card-icon">✨</div>
              <h3>Pilates ogólnorozwojowy</h3>
              <p>Pełna praca ciała, wzmacnianie core, elastyczność. Dla każdego kto chce czuć się lepiej każdego dnia.</p>
            </div>
            <div className="landing-card">
              <div className="landing-card-icon">🔥</div>
              <h3>Pilates zaawansowany</h3>
              <p>Intensywniejszy trening dla osób z doświadczeniem — wyzwanie dla ciała i umysłu.</p>
            </div>
          </div>
        </div>
      </section>

      {/* JAK TO DZIAŁA */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <p className="landing-label">Jak to działa</p>
          <h2 className="landing-section-title">Trzy kroki do zajęć</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">1</div>
              <h3>Załóż konto</h3>
              <p>Rejestracja zajmuje minutę — podaj imię, email i hasło. Bez zbędnych formalności.</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">2</div>
              <h3>Wybierz termin</h3>
              <p>Przeglądaj dostępne zajęcia i zapisz się na wybrany termin jednym kliknięciem.</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">3</div>
              <h3>Przyjdź i ćwicz</h3>
              <p>Dostaniesz potwierdzenie. Reszta należy do Ciebie — do zobaczenia na macie!</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <h2>Gotowa, żeby zacząć?</h2>
          <p>Dołącz do studia — pierwsze kroki są najważniejsze.</p>
          <button className="btn btn-primary landing-btn-lg" onClick={onRegister}>
            Zarejestruj się za darmo
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <span className="landing-footer-logo">Pilates <em>by Paulina</em></span>
          <span className="landing-footer-copy">© {new Date().getFullYear()}</span>
        </div>
      </footer>

    </div>
  );
}
