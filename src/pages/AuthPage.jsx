import { useState } from "react";
import { supabase } from "../supabase";
import { sendEmail } from "../emailService";

export default function AuthPage({ initialMode = "login", onBack }) {
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
    if (error) setError("Nieprawidłowy email lub hasło.");
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    if (!firstName.trim() || !lastName.trim()) {
      setError("Podaj imię i nazwisko."); setLoading(false); return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } }
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role: "client",
      });
      await sendEmail("welcome", email.trim(), { firstName: firstName.trim() });
      setSuccess("Konto zostało utworzone! Sprawdź email i potwierdź rejestrację.");
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
    if (error) setError("Nie udało się wysłać emaila. Sprawdź adres.");
    else setSuccess("Wysłaliśmy link do resetu hasła na Twój email!");
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="auth-big-letter">P</div>
          <h1>Pilates</h1>
          <p>Studio by Paulina</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-box">
          {onBack && (
            <button className="auth-back-btn" onClick={onBack}>← Wróć do strony głównej</button>
          )}

          {/* LOGIN */}
          {mode === "login" && (
            <>
              <h2>Witaj z powrotem</h2>
              <p>Zaloguj się, aby zobaczyć swoje zajęcia</p>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="twoj@email.pl"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hasło</label>
                  <input className="form-input" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? "Logowanie..." : "Zaloguj się"}
                </button>
              </form>
              <div className="auth-toggle" style={{ marginTop: "1rem" }}>
                <button onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}>
                  Zapomniałam hasła
                </button>
              </div>
              <div className="auth-toggle">
                Nie masz konta?{" "}
                <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}>
                  Zarejestruj się
                </button>
              </div>
            </>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <>
              <h2>Nowe konto</h2>
              <p>Dołącz do studia Pilates Pauliny</p>
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">Imię</label>
                  <input className="form-input" type="text" placeholder="Anna"
                    value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Nazwisko</label>
                  <input className="form-input" type="text" placeholder="Kowalska"
                    value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="twoj@email.pl"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hasło (min. 6 znaków)</label>
                  <input className="form-input" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? "Tworzenie konta..." : "Utwórz konto"}
                </button>
              </form>
              <div className="auth-toggle">
                Masz już konto?{" "}
                <button onClick={() => { setMode("login"); setError(""); }}>Zaloguj się</button>
              </div>
            </>
          )}

          {/* RESET HASŁA */}
          {mode === "reset" && (
            <>
              <h2>Reset hasła</h2>
              <p>Podaj email — wyślemy link do ustawienia nowego hasła</p>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}
              <form onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="twoj@email.pl"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? "Wysyłanie..." : "Wyślij link resetujący"}
                </button>
              </form>
              <div className="auth-toggle">
                <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
                  ← Wróć do logowania
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
