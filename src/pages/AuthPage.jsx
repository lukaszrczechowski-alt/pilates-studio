import { useState } from "react";
import { supabase } from "../supabase";
import { sendEmail } from "../emailService";
import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";

export default function AuthPage({ initialMode = "login", onBack, studioId }) {
  const { studio } = useStudio();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const studioName = studio?.name || "Studio";
  const letter = studioName[0] || "S";
  const [mode, setMode] = useState(initialMode); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(t("Nieprawidłowy email lub hasło.", "Incorrect email or password."));
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("Podaj imię i nazwisko.", "Please enter your first and last name.")); setLoading(false); return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } }
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role: "client",
        ...(studioId ? { studio_id: studioId } : {}),
      });
      await sendEmail("welcome", email.trim(), { firstName: firstName.trim() });
      setSuccess(t("Konto zostało utworzone! Sprawdź email i potwierdź rejestrację.", "Account created! Check your email to confirm registration."));
      setEmail(""); setPassword(""); setFirstName(""); setLastName("");
      setMode("login");
    }
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(t("Nie udało się wysłać emaila. Sprawdź adres.", "Failed to send email. Please check the address."));
    else setSuccess(t("Wysłaliśmy link do resetu hasła na Twój email!", "We've sent a password reset link to your email!"));
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="auth-big-letter">{letter}</div>
          <h1>{studioName}</h1>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: onBack ? 0 : "0.5rem" }}>
            {onBack
              ? <button className="auth-back-btn" style={{ margin: 0 }} onClick={onBack}>← {t("Wróć do strony głównej", "Back to homepage")}</button>
              : <span />}
            {isMultilingual && (
              <button onClick={() => setLang(lang === "pl" ? "en" : "pl")}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.3rem 0.65rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.82rem" }}>
                {lang === "pl" ? "🇬🇧 EN" : "🇵🇱 PL"}
              </button>
            )}
          </div>

          {/* DEMO SHORTCUTS */}
          {studio?.slug === "demo" && mode === "login" && (
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--cream)", borderRadius: "0.75rem", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--mid)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("Wypróbuj demo", "Try the demo")}</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={loading} onClick={async () => {
                  setLoading(true); setError("");
                  const { error } = await supabase.auth.signInWithPassword({ email: "demo_admin@studiova.app", password: "DemoAdmin2024!" });
                  if (error) setError(t("Nie udało się zalogować do demo.", "Failed to log in to demo."));
                  setLoading(false);
                }}>
                  {loading ? "..." : t("Zaloguj jako Admin", "Log in as Admin")}
                </button>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled={loading} onClick={async () => {
                  setLoading(true); setError("");
                  const { error } = await supabase.auth.signInWithPassword({ email: "demo_user@studiova.app", password: "DemoUser2024!" });
                  if (error) setError(t("Nie udało się zalogować do demo.", "Failed to log in to demo."));
                  setLoading(false);
                }}>
                  {loading ? "..." : t("Zaloguj jako Klient", "Log in as Client")}
                </button>
              </div>
            </div>
          )}

          {/* LOGIN */}
          {mode === "login" && (
            <>
              <h2>{t("Witaj z powrotem", "Welcome back")}</h2>
              <p>{t("Zaloguj się, aby zobaczyć swoje zajęcia", "Log in to see your classes")}</p>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder={t("twoj@email.pl", "your@email.com")}
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("Hasło", "Password")}</label>
                  <input className="form-input" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? t("Logowanie...", "Logging in...") : t("Zaloguj się", "Log in")}
                </button>
              </form>
              <div className="auth-toggle" style={{ marginTop: "1rem" }}>
                <button onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}>
                  {t("Zapomniałam hasła", "Forgot password")}
                </button>
              </div>
              <div className="auth-toggle">
                {t("Nie masz konta?", "Don't have an account?")}{" "}
                <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}>
                  {t("Zarejestruj się", "Sign up")}
                </button>
              </div>
            </>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <>
              <h2>{t("Nowe konto", "New account")}</h2>
              <p>{t("Dołącz do", "Join")} {studioName}</p>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">{t("Imię", "First name")}</label>
                  <input className="form-input" type="text" placeholder={t("Anna", "Anna")}
                    value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("Nazwisko", "Last name")}</label>
                  <input className="form-input" type="text" placeholder={t("Kowalska", "Smith")}
                    value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder={t("twoj@email.pl", "your@email.com")}
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("Hasło (min. 6 znaków)", "Password (min. 6 characters)")}</label>
                  <input className="form-input" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? t("Tworzenie konta...", "Creating account...") : t("Utwórz konto", "Create account")}
                </button>
              </form>
              <div className="auth-toggle">
                {t("Masz już konto?", "Already have an account?")}{" "}
                <button onClick={() => { setMode("login"); setError(""); }}>{t("Zaloguj się", "Log in")}</button>
              </div>
            </>
          )}

          {/* RESET HASŁA */}
          {mode === "reset" && (
            <>
              <h2>{t("Reset hasła", "Password reset")}</h2>
              <p>{t("Podaj email — wyślemy link do ustawienia nowego hasła", "Enter your email — we'll send a link to set a new password")}</p>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}
              <form onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder={t("twoj@email.pl", "your@email.com")}
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? t("Wysyłanie...", "Sending...") : t("Wyślij link resetujący", "Send reset link")}
                </button>
              </form>
              <div className="auth-toggle">
                <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
                  ← {t("Wróć do logowania", "Back to login")}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
