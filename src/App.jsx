import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import ClientDashboard from "./pages/ClientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PublicBooking from "./pages/PublicBooking";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = landing, "login" = formularz logowania, "register" = formularz rejestracji
  const [authMode, setAuthMode] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    return false;
  });

  // Sprawdź czy to publiczny link /zapisy
  const isPublicRoute = window.location.pathname === "/zapisy";

  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (isPublicRoute) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    setLoading(false);
  }

  // Publiczna strona zajęć
  if (isPublicRoute) return <PublicBooking />;

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">P</div>
    </div>
  );

  if (!session) {
    if (authMode) return <AuthPage initialMode={authMode} onBack={() => setAuthMode(null)} />;
    return <LandingPage onLogin={() => setAuthMode("login")} onRegister={() => setAuthMode("register")} />;
  }
  if (profile?.role === "admin") return <AdminDashboard session={session} profile={profile} darkMode={darkMode} setDarkMode={setDarkMode} />;
  return <ClientDashboard session={session} profile={profile} onProfileUpdate={p => setProfile(prev => ({ ...prev, ...p }))} darkMode={darkMode} setDarkMode={setDarkMode} />;
}
