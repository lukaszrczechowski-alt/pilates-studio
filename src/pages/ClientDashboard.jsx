import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ClientDashboard({ session, profile }) {
  const [tab, setTab] = useState("upcoming");
  const [classes, setClasses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase
      .from("classes").select("*, bookings(*), waitlist(*)")
      .gte("starts_at", now).order("starts_at", { ascending: true });
    const { data: bookingData } = await supabase
      .from("bookings").select("*, classes(*)")
      .eq("user_id", session.user.id).order("created_at", { ascending: false });
    const { data: waitlistData } = await supabase
      .from("waitlist").select("*, classes(*)").eq("user_id", session.user.id);
    setClasses(classData || []);
    setMyBookings(bookingData || []);
    setMyWaitlist(waitlistData || []);
    setLoading(false);
  }

  function isBooked(classId) { return myBookings.some(b => b.class_id === classId); }
  function isOnWaitlist(classId) { return myWaitlist.some(w => w.class_id === classId); }
  function getBookedCount(cls) { return cls.bookings?.length || 0; }

  function canCancel(startsAt) {
    const diffHours = (new Date(startsAt) - new Date()) / (1000 * 60 * 60);
    return diffHours >= 2;
  }

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleBook(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("bookings").insert({ class_id: cls.id, user_id: session.user.id });
    if (error) showMessage("Błąd przy zapisie. Spróbuj ponownie.", "error");
    else showMessage("Zapisałaś się na zajęcia! ✓");
    await fetchData();
    setActionLoading(null);
  }

  async function handleCancel(cls) {
    if (!canCancel(cls.starts_at)) {
      showMessage("Nie można wypisać się na mniej niż 2h przed zajęciami.", "error");
      return;
    }
    setActionLoading(cls.id);
    await supabase.from("bookings").delete().eq("class_id", cls.id).eq("user_id", session.user.id);
    const { data: waitlistFirst } = await supabase.from("waitlist").select("*")
      .eq("class_id", cls.id).order("created_at", { ascending: true }).limit(1);
    if (waitlistFirst?.length > 0) {
      await supabase.from("bookings").insert({ class_id: cls.id, user_id: waitlistFirst[0].user_id });
      await supabase.from("waitlist").delete().eq("id", waitlistFirst[0].id);
      await supabase.from("notifications").insert({
        type: "waitlist_promoted", class_id: cls.id, user_id: waitlistFirst[0].user_id,
        message: `Osoba z listy oczekujących została automatycznie zapisana na "${cls.name}"`,
      });
    }
    showMessage("Wypisałaś się z zajęć.");
    await fetchData();
    setActionLoading(null);
  }

  async function handleJoinWaitlist(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("waitlist").insert({ class_id: cls.id, user_id: session.user.id });
    if (error) showMessage("Już jesteś na liście oczekujących.", "error");
    else showMessage("Zapisałaś się do kolejki! ✓");
    await fetchData();
    setActionLoading(null);
  }

  async function handleLeaveWaitlist(cls) {
    setActionLoading(cls.id);
    await supabase.from("waitlist").delete().eq("class_id", cls.id).eq("user_id", session.user.id);
    showMessage("Usunięto z kolejki.");
    await fetchData();
    setActionLoading(null);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  }
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }

  const upcomingMyClasses = myBookings.filter(b => new Date(b.classes?.starts_at) >= new Date());

  const CancelButton = ({ cls }) => {
    const allowed = canCancel(cls.starts_at);
    return allowed ? (
      <button className="btn btn-danger btn-full" onClick={() => handleCancel(cls)} disabled={actionLoading === cls.id}>
        {actionLoading === cls.id ? "..." : "Wypisz się"}
      </button>
    ) : (
      <button className="btn btn-full" disabled style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--light)", cursor: "not-allowed" }}>
        Wypisanie niemożliwe (za mało czasu)
      </button>
    );
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><h1>Pilates</h1><p>Studio by Paulina</p></div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}>
            <span className="nav-icon">🗓</span> Zajęcia
          </div>
          <div className={`nav-item ${tab === "my" ? "active" : ""}`} onClick={() => setTab("my")}>
            <span className="nav-icon">✦</span> Moje rezerwacje
          </div>
<div className={`nav-item ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}>
  <span className="nav-icon">👤</span> Moje konto
</div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
            <div>
              <div className="user-name">{profile?.first_name} {profile?.last_name}</div>
              <div className="user-role">Klient</div>
            </div>
          </div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
        </div>
      </aside>

      <main className="main-content">
        {message && (
          <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`}
            style={{ position: "fixed", top: "1rem", right: "1rem", left: "1rem", zIndex: 999, maxWidth: 400, margin: "0 auto" }}>
            {message.text}
          </div>
        )}

        {tab === "upcoming" && (
          <>
            <div className="page-header">
              <h2>Nadchodzące zajęcia</h2>
              <p>Zapisz się na zajęcia klikając poniżej</p>
            </div>
            {loading ? <div className="empty-state"><p>Ładowanie...</p></div>
              : classes.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🌿</div><p>Brak zaplanowanych zajęć.</p></div>
              ) : (
                <div className="cards-grid">
                  {classes.map(cls => {
                    const booked = isBooked(cls.id);
                    const onWaitlist = isOnWaitlist(cls.id);
                    const count = getBookedCount(cls);
                    const waitlistCount = cls.waitlist?.length || 0;
                    const isFull = count >= cls.max_spots;
                    const fillPct = Math.min((count / cls.max_spots) * 100, 100);
                    return (
                      <div className="class-card" key={cls.id}>
                        <div className="class-card-header">
                          <span className="class-title">{cls.name}</span>
                          {booked ? <span className="class-badge badge-yours">Zapisana</span>
                            : onWaitlist ? <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>W kolejce</span>
                            : isFull ? <span className="class-badge badge-full">Brak miejsc</span>
                            : <span className="class-badge badge-open">Wolne miejsca</span>}
                        </div>
                        <div className="class-card-body">
                          <div className="class-meta">
                            <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(cls.starts_at)}</div>
                            <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(cls.starts_at)} · {cls.duration_min} min</div>
                            {cls.location && <div className="meta-item"><span className="meta-icon">📍</span>{cls.location}</div>}
                          </div>
                          <div className="spots-bar">
                            <div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} />
                          </div>
                          <p className="spots-text">{count} / {cls.max_spots} miejsc{waitlistCount > 0 && ` · ${waitlistCount} w kolejce`}</p>
                          {booked ? <CancelButton cls={cls} />
                            : onWaitlist ? (
                              <button className="btn btn-secondary btn-full" onClick={() => handleLeaveWaitlist(cls)} disabled={actionLoading === cls.id}>
                                {actionLoading === cls.id ? "..." : "Wypisz się z kolejki"}
                              </button>
                            ) : isFull ? (
                              <button className="btn btn-secondary btn-full" onClick={() => handleJoinWaitlist(cls)} disabled={actionLoading === cls.id}>
                                {actionLoading === cls.id ? "..." : "Dołącz do kolejki"}
                              </button>
                            ) : (
                              <button className="btn btn-primary btn-full" onClick={() => handleBook(cls)} disabled={actionLoading === cls.id}>
                                {actionLoading === cls.id ? "..." : "Zapisz się"}
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </>
        )}

        {tab === "my" && (
          <>
            <div className="page-header"><h2>Moje rezerwacje</h2><p>Twoje nadchodzące zajęcia</p></div>
            {upcomingMyClasses.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">✦</div><p>Nie masz żadnych rezerwacji.</p></div>
            ) : (
              <div className="cards-grid">
                {upcomingMyClasses.map(b => (
                  <div className="class-card" key={b.id}>
                    <div className="class-card-header">
                      <span className="class-title">{b.classes?.name}</span>
                      <span className="class-badge badge-yours">Zapisana</span>
                    </div>
                    <div className="class-card-body">
                      <div className="class-meta">
                        <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(b.classes?.starts_at)}</div>
                        <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(b.classes?.starts_at)} · {b.classes?.duration_min} min</div>
                      </div>
                      <CancelButton cls={b.classes} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {myWaitlist.length > 0 && (
              <>
                <div className="page-header" style={{ marginTop: "2rem" }}><h2>Lista oczekujących</h2></div>
                <div className="cards-grid">
                  {myWaitlist.map(w => (
                    <div className="class-card" key={w.id}>
                      <div className="class-card-header">
                        <span className="class-title">{w.classes?.name}</span>
                        <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>W kolejce</span>
                      </div>
                      <div className="class-card-body">
                        <div className="class-meta">
                          <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(w.classes?.starts_at)}</div>
                          <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(w.classes?.starts_at)}</div>
                        </div>
                        <button className="btn btn-secondary btn-full" onClick={() => handleLeaveWaitlist(w.classes)}>
                          Wypisz się z kolejki
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "account" && (
          <>
            <div className="page-header"><h2>Moje konto</h2></div>
            <div className="card" style={{ maxWidth: 400 }}>
              <div className="user-info" style={{ marginBottom: "1.5rem" }}>
                <div className="user-avatar" style={{ width: 56, height: 56, fontSize: "1.5rem" }}>
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </div>
                <div>
                  <div className="user-name" style={{ fontSize: "1.1rem" }}>{profile?.first_name} {profile?.last_name}</div>
                  <div className="user-role">{profile?.email}</div>
                </div>
              </div>
              <button className="btn btn-danger btn-full" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
            </div>
          </>
        )}
      </main>

      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}>
          <span className="mobile-nav-icon">🗓</span><span>Zajęcia</span>
        </div>
        <div className={`mobile-nav-item ${tab === "my" ? "active" : ""}`} onClick={() => setTab("my")}>
          <span className="mobile-nav-icon">✦</span><span>Rezerwacje</span>
        </div>
        <div className={`mobile-nav-item ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}>
          <span className="mobile-nav-icon">👤</span><span>Konto</span>
        </div>
      </nav>
    </div>
  );
}
