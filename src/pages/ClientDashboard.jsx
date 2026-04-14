import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ClientDashboard({ session, profile }) {
  const [tab, setTab] = useState("upcoming");
  const [classes, setClasses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [myTokens, setMyTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);
  const [detailClass, setDetailClass] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase.from("classes").select("*, bookings(*), waitlist(*)")
      .gte("starts_at", now).order("starts_at", { ascending: true });
    const { data: bookingData } = await supabase.from("bookings").select("*, classes(*)")
      .eq("user_id", session.user.id).order("created_at", { ascending: false });
    const { data: waitlistData } = await supabase.from("waitlist").select("*, classes(*)")
      .eq("user_id", session.user.id);
    const { data: tokenData } = await supabase.from("tokens").select("*")
      .eq("user_id", session.user.id).order("year", { ascending: false }).order("month", { ascending: false });
    setClasses(classData || []);
    setMyBookings(bookingData || []);
    setMyWaitlist(waitlistData || []);
    setMyTokens(tokenData || []);
    setLoading(false);
  }

  function isBooked(classId) { return myBookings.some(b => b.class_id === classId); }
  function isOnWaitlist(classId) { return myWaitlist.some(w => w.class_id === classId); }
  function getBookedCount(cls) { return cls.bookings?.length || 0; }
  function canCancel(startsAt) { return (new Date(startsAt) - new Date()) / (1000 * 60 * 60) >= 2; }

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function monthName(m) {
    return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
  }

  async function handleBook(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("bookings").insert({ class_id: cls.id, user_id: session.user.id });
    if (error) showMsg("Błąd przy zapisie.", "error");
    else { showMsg("Zapisałaś się na zajęcia! ✓"); setDetailClass(null); }
    await fetchData();
    setActionLoading(null);
  }

  async function handleCancel(cls) {
    if (!canCancel(cls.starts_at)) { showMsg("Nie można wypisać się na mniej niż 2h przed zajęciami.", "error"); return; }
    setActionLoading(cls.id);
    await supabase.from("bookings").delete().eq("class_id", cls.id).eq("user_id", session.user.id);
    const { data: waitlistFirst } = await supabase.from("waitlist").select("*")
      .eq("class_id", cls.id).order("created_at", { ascending: true }).limit(1);
    if (waitlistFirst?.length > 0) {
      await supabase.from("bookings").insert({ class_id: cls.id, user_id: waitlistFirst[0].user_id });
      await supabase.from("waitlist").delete().eq("id", waitlistFirst[0].id);
    }
    showMsg("Wypisałaś się z zajęć.");
    setDetailClass(null);
    await fetchData();
    setActionLoading(null);
  }

  async function handleJoinWaitlist(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("waitlist").insert({ class_id: cls.id, user_id: session.user.id });
    if (error) showMsg("Już jesteś w kolejce.", "error");
    else { showMsg("Zapisałaś się do kolejki! ✓"); setDetailClass(null); }
    await fetchData();
    setActionLoading(null);
  }

  async function handleLeaveWaitlist(cls) {
    setActionLoading(cls.id);
    await supabase.from("waitlist").delete().eq("class_id", cls.id).eq("user_id", session.user.id);
    showMsg("Usunięto z kolejki.");
    setDetailClass(null);
    await fetchData();
    setActionLoading(null);
  }

  function formatDate(iso) { return new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }); }
  function formatTime(iso) { return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }); }

  const upcomingMyClasses = myBookings.filter(b => new Date(b.classes?.starts_at) >= new Date());
  const currentTokens = myTokens.find(t => t.month === new Date().getMonth() + 1 && t.year === new Date().getFullYear());

  const CancelButton = ({ cls }) => canCancel(cls?.starts_at) ? (
    <button className="btn btn-danger btn-full" onClick={() => handleCancel(cls)} disabled={actionLoading === cls?.id}>
      {actionLoading === cls?.id ? "..." : "Wypisz się"}
    </button>
  ) : (
    <button className="btn btn-full" disabled style={{ background: "var(--cream)", border: "1px solid var(--border)", color: "var(--light)", cursor: "not-allowed" }}>
      Wypisanie niemożliwe (za mało czasu)
    </button>
  );

  // Karta zajęć
  function ClassCard({ cls }) {
    const booked = isBooked(cls.id);
    const onWaitlist = isOnWaitlist(cls.id);
    const count = getBookedCount(cls);
    const waitlistCount = cls.waitlist?.length || 0;
    const isFull = count >= cls.max_spots;
    const fillPct = Math.min((count / cls.max_spots) * 100, 100);

    return (
      <div className="class-card" style={{ cursor: "pointer" }} onClick={() => setDetailClass(cls)}>
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
            {cls.price_pln && <div className="meta-item"><span className="meta-icon">💰</span>{cls.price_pln} zł</div>}
          </div>
          <div className="spots-bar">
            <div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} />
          </div>
          <p className="spots-text">{count} / {cls.max_spots} miejsc{waitlistCount > 0 && ` · ${waitlistCount} w kolejce`}</p>
          {cls.notes && (
            <p style={{ fontSize: "0.78rem", color: "var(--mid)", marginTop: "0.5rem", fontStyle: "italic" }}>
              📌 {cls.notes.length > 60 ? cls.notes.slice(0, 60) + "..." : cls.notes}
            </p>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>Kliknij, aby zobaczyć szczegóły →</p>
        </div>
      </div>
    );
  }

  // Modal szczegółów zajęć
  function DetailModal({ cls, onClose }) {
    if (!cls) return null;
    const booked = isBooked(cls.id);
    const onWaitlist = isOnWaitlist(cls.id);
    const count = getBookedCount(cls);
    const isFull = count >= cls.max_spots;
    const fillPct = Math.min((count / cls.max_spots) * 100, 100);

    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h3>{cls.name}</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          {/* Badge status */}
          <div style={{ marginBottom: "1.25rem" }}>
            {booked ? <span className="class-badge badge-yours">Jesteś zapisana</span>
              : onWaitlist ? <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>Jesteś w kolejce</span>
              : isFull ? <span className="class-badge badge-full">Brak wolnych miejsc</span>
              : <span className="class-badge badge-open">Wolne miejsca</span>}
          </div>

          {/* Szczegóły */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>📅</span>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{formatDate(cls.starts_at)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>🕐</span>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Godzina i czas trwania</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{formatTime(cls.starts_at)} · {cls.duration_min} minut</div>
              </div>
            </div>
            {cls.location && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem" }}>📍</span>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Lokalizacja</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{cls.location}</div>
                </div>
              </div>
            )}
            {cls.price_pln && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem" }}>💰</span>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cena</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{cls.price_pln} zł</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>👥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dostępność</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{count} / {cls.max_spots} miejsc zajętych</div>
                <div className="spots-bar" style={{ marginTop: "0.4rem" }}>
                  <div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Notatki */}
          {cls.notes && (
            <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>📌 Informacje dodatkowe</div>
              <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", lineHeight: 1.6 }}>{cls.notes}</p>
            </div>
          )}

          {/* Przycisk akcji */}
          {booked ? (
            <CancelButton cls={cls} />
          ) : onWaitlist ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleLeaveWaitlist(cls)} disabled={actionLoading === cls.id}>
              {actionLoading === cls.id ? "..." : "Wypisz się z kolejki"}
            </button>
          ) : isFull ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleJoinWaitlist(cls)} disabled={actionLoading === cls.id}>
              {actionLoading === cls.id ? "..." : "Dołącz do kolejki"}
            </button>
          ) : (
            <button className="btn btn-primary btn-full" onClick={() => handleBook(cls)} disabled={actionLoading === cls.id}>
              {actionLoading === cls.id ? "..." : "Zapisz się na zajęcia"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => setTab("upcoming")} style={{ cursor: "pointer" }}>
          <h1>Pilates</h1>
          <p>Studio by Paulina</p>
        </div>
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
            <div><div className="user-name">{profile?.first_name} {profile?.last_name}</div><div className="user-role">Klient</div></div>
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
            <div className="page-header"><h2>Nadchodzące zajęcia</h2><p>Kliknij w zajęcia, aby zobaczyć szczegóły i się zapisać</p></div>
            {currentTokens && (
              <div className="card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎟️</span>
                <div>
                  <div style={{ fontWeight: 500 }}>Twoje tokeny w tym miesiącu: <strong style={{ color: "var(--sage-dark)" }}>{currentTokens.amount}</strong></div>
                  <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>Każde zajęcia = 1 token (zużywany po zajęciach)</div>
                </div>
              </div>
            )}
            {loading ? <div className="empty-state"><p>Ładowanie...</p></div>
              : classes.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>Brak zajęć.</p></div>
              : <div className="cards-grid">{classes.map(cls => <ClassCard key={cls.id} cls={cls} />)}</div>}
          </>
        )}

        {tab === "my" && (
          <>
            <div className="page-header"><h2>Moje rezerwacje</h2></div>
            {upcomingMyClasses.length === 0
              ? <div className="empty-state"><div className="empty-icon">✦</div><p>Brak rezerwacji.</p></div>
              : <div className="cards-grid">{upcomingMyClasses.map(b => (
                <div className="class-card" key={b.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(b.classes)}>
                  <div className="class-card-header">
                    <span className="class-title">{b.classes?.name}</span>
                    <span className="class-badge badge-yours">Zapisana</span>
                  </div>
                  <div className="class-card-body">
                    <div className="class-meta">
                      <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(b.classes?.starts_at)}</div>
                      <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(b.classes?.starts_at)} · {b.classes?.duration_min} min</div>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>Kliknij, aby zobaczyć szczegóły →</p>
                  </div>
                </div>
              ))}</div>}

            {myWaitlist.length > 0 && (
              <>
                <div className="page-header" style={{ marginTop: "2rem" }}><h2>Lista oczekujących</h2></div>
                <div className="cards-grid">{myWaitlist.map(w => (
                  <div className="class-card" key={w.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(w.classes)}>
                    <div className="class-card-header">
                      <span className="class-title">{w.classes?.name}</span>
                      <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>W kolejce</span>
                    </div>
                    <div className="class-card-body">
                      <div className="class-meta">
                        <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(w.classes?.starts_at)}</div>
                        <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(w.classes?.starts_at)}</div>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>Kliknij, aby zobaczyć szczegóły →</p>
                    </div>
                  </div>
                ))}</div>
              </>
            )}
          </>
        )}

        {tab === "account" && (
          <>
            <div className="page-header"><h2>Moje konto</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
              <div className="card">
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
              <div className="card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1.3rem" }}>🎟️ Moje tokeny</h3>
                {myTokens.length === 0 ? (
                  <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Brak tokenów. Skontaktuj się z Pauliną.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {myTokens.map(t => (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--mid)", fontSize: "0.875rem" }}>{monthName(t.month)} {t.year}</span>
                        <span style={{ fontWeight: 600, color: t.amount > 0 ? "var(--sage-dark)" : "var(--light)", fontSize: "1.1rem" }}>
                          {t.amount} {t.amount === 1 ? "token" : t.amount < 5 ? "tokeny" : "tokenów"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--light)" }}>
                  1 token = 1 zajęcia. Tokeny zużywane są po każdych zajęciach.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal szczegółów */}
      {detailClass && <DetailModal cls={detailClass} onClose={() => setDetailClass(null)} />}

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
