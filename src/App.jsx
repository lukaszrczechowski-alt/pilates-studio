import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { StudioProvider, useStudio } from "./StudioContext";
import { LanguageProvider } from "./LanguageContext";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import ClientDashboard from "./pages/ClientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PublicBooking from "./pages/PublicBooking";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import "./App.css";

function AppInner() {
  const { studio, loading: studioLoading } = useStudio();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState(null);
  const [wrongStudio, setWrongStudio] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null ? saved === "true" : false;
  });

  const path = window.location.pathname;
  const isPublicRoute = path === "/zapisy";
  const isSuperAdminRoute = path === "/superadmin";
  const isLoginRoute = path === "/login";
  const isRegisterRoute = path === "/register";

  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (isLoginRoute) setAuthMode("login");
    if (isRegisterRoute) setAuthMode("register");
  }, []);

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
      if (session) {
        fetchProfile(session.user.id);
        // Wyczyść /login lub /register z URL po zalogowaniu
        if (["/login", "/register"].includes(window.location.pathname)) {
          window.history.replaceState({}, "", "/app");
        }
      } else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.studio_id && studio?.id && profile.studio_id !== studio.id) {
      setWrongStudio(true);
      supabase.auth.signOut();
    }
  }, [profile, studio]);

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) console.error("fetchProfile error:", error.message);
    // Jeśli profil nie ma studio_id a wiemy z domeny — przypisz
    if (data && !data.studio_id && studio?.id) {
      await supabase.from("profiles").update({ studio_id: studio.id }).eq("id", userId);
      data.studio_id = studio.id;
    }
    setProfile(data || null);
    setLoading(false);
  }

  const studioLetter = studio?.name?.[0] || "S";

  if (studioLoading) return (
    <div className="loading-screen"><div className="loading-logo">{studioLetter}</div></div>
  );

  if (isPublicRoute) return <PublicBooking studioId={studio?.id} />;

  if (loading) return (
    <div className="loading-screen"><div className="loading-logo">{studioLetter}</div></div>
  );

  if (!session) {
    if (isSuperAdminRoute) return <AuthPage initialMode="login" onBack={() => { window.location.pathname = "/"; }} studioId={studio?.id} />;
    if (authMode) return <AuthPage initialMode={authMode} onBack={() => { setAuthMode(null); window.history.replaceState({}, "", "/"); window.location.replace("/"); }} studioId={studio?.id} />;
    return <LandingPage onLogin={() => setAuthMode("login")} onRegister={() => setAuthMode("register")} />;
  }

  if (isSuperAdminRoute) {
    if (profile?.role !== "superadmin") {
      return (
        <div className="loading-screen" style={{ flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "1.1rem", color: "var(--mid)" }}>Brak dostępu.</div>
          <button className="btn btn-secondary btn-sm" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
        </div>
      );
    }
    return <SuperAdminDashboard session={session} onLogout={() => supabase.auth.signOut()} />;
  }

  if (wrongStudio) {
    return <AuthPage initialMode="login" onBack={() => { setAuthMode(null); setWrongStudio(false); }} studioId={studio?.id} initialError="Nieprawidłowy email lub hasło." />;
  }

  if (["admin", "superadmin"].includes(profile?.role)) return (
    <AdminDashboard session={session} profile={profile} studioId={studio?.id} darkMode={darkMode} setDarkMode={setDarkMode} />
  );
  return (
    <ClientDashboard session={session} profile={profile} studioId={studio?.id} onProfileUpdate={p => setProfile(prev => ({ ...prev, ...p }))} darkMode={darkMode} setDarkMode={setDarkMode} />
  );
}

export default function App() {
  return (
    <StudioProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </StudioProvider>
  );
}
