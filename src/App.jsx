import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { StudioProvider, useStudio } from "./StudioContext";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import ClientDashboard from "./pages/ClientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PublicBooking from "./pages/PublicBooking";
import "./App.css";

function AppInner() {
  const { studio, loading: studioLoading, error: studioError } = useStudio();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null ? saved === "true" : false;
  });

  const isPublicRoute = window.location.pathname === "/zapisy";

  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (isPublicRoute) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("getSession error:", error.message);
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(err => {
      console.error("getSession failed:", err);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) console.error("fetchProfile error:", error.message);
    setProfile(data || null);
    setLoading(false);
  }

  if (studioLoading) return (
    <div className="loading-screen"><div className="loading-logo">P</div></div>
  );

  if (studioError) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "DM Sans, sans-serif" }}>
      <p style={{ color: "var(--clay)" }}>Nie znaleziono studia dla tej domeny.</p>
    </div>
  );

  if (isPublicRoute) return <PublicBooking studioId={studio?.id} />;

  if (loading) return (
    <div className="loading-screen"><div className="loading-logo">P</div></div>
  );

  if (!session) {
    if (authMode) return <AuthPage initialMode={authMode} onBack={() => setAuthMode(null)} />;
    return <LandingPage onLogin={() => setAuthMode("login")} onRegister={() => setAuthMode("register")} />;
  }

  if (profile?.role === "admin") return (
    <AdminDashboard session={session} profile={profile} studioId={studio?.id} darkMode={darkMode} setDarkMode={setDarkMode} />
  );
  return (
    <ClientDashboard session={session} profile={profile} studioId={studio?.id} onProfileUpdate={p => setProfile(prev => ({ ...prev, ...p }))} darkMode={darkMode} setDarkMode={setDarkMode} />
  );
}

export default function App() {
  return (
    <StudioProvider>
      <AppInner />
    </StudioProvider>
  );
}
