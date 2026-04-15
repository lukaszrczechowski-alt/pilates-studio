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
  const [showCancelWarning, setShowCancelWarning] = useState(null); // booking do anulowania po 12:00
  const [showBookModal, setShowBookModal] = useState(null); // class do zapisu z wyborem metody

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
  function getBooking(classId) { return myBookings.find(b => b.class_id === classId); }
  function isOnWaitlist(classId) { return myWaitlist.some(w => w.class_id === classId); }
  function getBookedCount(cls) { return cls.bookings?.length || 0; }

  // Sprawdź czy można anulować bez straty wejścia
  function cancelStatus(startsAt) {
    const classDate = new Date(startsAt);
    const now = new Date();
    const isToday = classDate.toDateString() === now.toDateString();
    const isFuture = classDate > now;
    if (!isFuture && !isToday) return "past";
    if (!isToday) return "free"; // jutro lub później — zawsze wolno
    const cutoff = new Date(classDate);
    cutoff.setHours(12, 0, 0, 0);
    return now < cutoff ? "free" : "after_cutoff";
  }

  function monthName(m) {
    return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
  }

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  // Wejście na zajęcia z wyborem metody
  async function handleBook(cls, paymentMethod) {
    setActionLoading(cls.id);
    const month = new Date(cls.starts_at).getMonth() + 1;
    const year = new Date(cls.starts_at).getFullYear();

    // Sprawdź czy ma wejścia jeśli wybrała tę metodę
    if (paymentMethod === "entries") {
      const { data: tok } = await supabase.from("tokens").select("amount")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).single();
      if (!tok || tok.amount <= 0) {
        showMsg("Nie masz dostępnych wejść na " + monthName(month) + ". Wybierz gotówkę lub skontaktuj się z Pauliną.", "error");
        setActionLoading(null);
        return;
      }
    }

    const { error } = await supabase.from("bookings").insert({
      class_id: cls.id,
      user_id: session.user.id,
      payment_method: paymentMethod,
    });

    if (error) {
      showMsg("Błąd przy zapisie.", "error");
      setActionLoading(null);
      return;
    }

    // Zdejmij wejście od razu jeśli metoda "entries"
    if (paymentMethod === "entries") {
      const { data: tok } = await supabase.from("tokens").select("*")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).single();
      if (tok) {
        await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
        await supabase.from("token_history").insert({
          user_id: session.user.id, class_id: cls.id, operation: "use", amount: -1,
          month, year, note: `Zapis na zajęcia: ${cls.name}`,
        });
      }
    }

    showMsg(paymentMethod === "entries" ? "Zapisano! Zdjęto 1 wejście. ✓" : "Zapisano! Płatność gotówką na miejscu. ✓");
    setShowBookModal(null);
    setDetailClass(null);
    await fetchData();
    setActionLoading(null);
  }

  // Anulowanie rezerwacji
  async function handleCancel(booking, force = false) {
    const cls = booking.classes || classes.find(c => c.id === booking.class_id);
    if (!cls) return;

    const status = cancelStatus(cls.starts_at);

    if (status === "after_cutoff" && !force) {
      setShowCancelWarning(booking);
      setDetailClass(null);
      return;
    }

    setActionLoading(booking.class_id || booking.id);

    await supabase.from("bookings").delete().eq("id", booking.id);

    // Zwróć wejście jeśli przed 12:00 i metoda "entries"
    if (booking.payment_method === "entries" && status === "free") {
      const month = new Date(cls.starts_at).getMonth() + 1;
      const year = new Date(cls.starts_at).getFullYear();
      const { data: tok } = await supabase.from("tokens").select("*")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).single();
      if (tok) {
        await supabase.from("tokens").update({ amount: tok.amount + 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
        await supabase.from("token_history").insert({
          user_id: session.user.id, class_id: cls.id, operation: "add", amount: 1,
          month, year, note: `Zwrot wejścia — anulowanie rezerwacji`,
        });
        showMsg("Anulowano rezerwację. Wejście wróciło na Twoje konto. ✓");
      }
    } else if (booking.payment_method === "entries" && status === "after_cutoff") {
      showMsg("Anulowano rezerwację. Wejście przepadło (po 12:00).", "error");
    } else {
      showMsg("Anulowano rezerwację.");
    }

    // Awansuj osobę z kolejki
    const { data: waitlistFirst } = await supabase.from("waitlist").select("*")
      .eq("class_id", cls.id).order("created_at", { ascending: true }).limit(1);
    if (waitlistFirst?.length > 0) {
      await supabase.from("bookings").insert({ class_id: cls.id, user_id: waitlistFirst[0].user_id, payment_method: "cash" });
      await supabase.from("waitlist").delete().eq("id", waitlistFirst[0].id);
    }

    setShowCancelWarning(null);
    setDetailClass(null);
    await fetchData();
    setActionLoading(null);
  }

  async function handleJoinWaitlist(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("waitlist").insert({ class_id: cls.id, user_id: session.user.id });
    if (error) showMsg("Już jesteś w kolejce.", "error");
    else { showMsg("Zapisano do kolejki! ✓"); setDetailClass(null); }
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
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentTokens = myTokens.find(t => t.month === currentMonth && t.year === currentYear);

  // Modal wyboru metody płatności
  function BookModal({ cls, onClose }) {
    const [method, setMethod] = useState("cash");
    const hasEntries = currentTokens && currentTokens.amount > 0;
    const month = new Date(cls.starts_at).getMonth() + 1;
    const classTokens = myTokens.find(t => t.month === month && t.year === new Date(cls.starts_at).getFullYear());
    const classEntries = classTokens?.amount || 0;

    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <h3>Wybierz sposób płatności</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
            Zapisujesz się na: <strong>{cls.name}</strong><br/>
            {formatDate(cls.starts_at)}, {formatTime(cls.starts_at)}
            {cls.price_pln ? ` · ${cls.price_pln} zł` : ""}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {/* Gotówka */}
            <div onClick={() => setMethod("cash")}
              style={{ border: `2px solid ${method === "cash" ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1rem", cursor: "pointer", background: method === "cash" ? "#EBF5EA" : "var(--warm-white)", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>💵</span>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--charcoal)" }}>Gotówka na miejscu</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>Płacisz gotówką w dniu zajęć</div>
                </div>
              </div>
            </div>

            {/* Wejścia */}
            <div onClick={() => setMethod("entries")}
              style={{ border: `2px solid ${method === "entries" ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1rem", cursor: classEntries > 0 ? "pointer" : "not-allowed", background: method === "entries" ? "#EBF5EA" : classEntries === 0 ? "var(--cream)" : "var(--warm-white)", opacity: classEntries === 0 ? 0.6 : 1, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎫</span>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--charcoal)" }}>Wejście z karnetu</div>
                  <div style={{ fontSize: "0.8rem", color: classEntries > 0 ? "var(--sage-dark)" : "var(--clay)" }}>
                    {classEntries > 0
                      ? `Masz ${classEntries} ${classEntries === 1 ? "wejście" : classEntries < 5 ? "wejścia" : "wejść"} na ${monthName(month)}`
                      : `Brak wejść na ${monthName(month)} — skontaktuj się z Pauliną`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {method === "entries" && classEntries > 0 && (
            <div style={{ background: "#FEF3E8", border: "1px solid #E8C5B5", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#8B5A2B" }}>
              ⚠️ Zapis od razu zdejmie 1 wejście. Anulując przed 12:00 w dniu zajęć — wejście wraca.
            </div>
          )}

          <button className="btn btn-primary btn-full"
            onClick={() => handleBook(cls, method)}
            disabled={actionLoading === cls.id || (method === "entries" && classEntries === 0)}>
            {actionLoading === cls.id ? "Zapisuję..." : method === "entries" ? "Zapisz i zdejmij wejście" : "Zapisz (gotówka na miejscu)"}
          </button>
        </div>
      </div>
    );
  }

  // Modal ostrzeżenia o anulowaniu po 12:00
  function CancelWarningModal({ booking, onClose }) {
    const cls = booking.classes;
    const loseEntry = booking.payment_method === "entries";
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="modal-header">
            <h3>Uwaga — późne anulowanie</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.875rem", color: "#C44B4B", lineHeight: 1.6 }}>
              Jest po 12:00 w dniu zajęć. Możesz nadal anulować rezerwację, ale{" "}
              {loseEntry ? <strong>stracisz 1 wejście</strong> : "miejsce zostaje zwolnione bez konsekwencji"}.
            </p>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
            Zajęcia: <strong>{cls?.name}</strong><br/>
            {cls?.starts_at && formatDate(cls.starts_at)}, {cls?.starts_at && formatTime(cls.starts_at)}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Zostań zapisana</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleCancel(booking, true)}
              disabled={actionLoading === booking.class_id}>
              {actionLoading === booking.class_id ? "..." : loseEntry ? "Anuluj (stracę wejście)" : "Anuluj rezerwację"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal szczegółów zajęć
  function DetailModal({ cls, onClose }) {
    if (!cls) return null;
    const booked = isBooked(cls.id);
    const booking = getBooking(cls.id);
    const onWaitlist = isOnWaitlist(cls.id);
    const count = getBookedCount(cls);
    const isFull = count >= cls.max_spots;
    const fillPct = Math.min((count / cls.max_spots) * 100, 100);
    const status = booked ? cancelStatus(cls.starts_at) : null;

    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h3>{cls.name}</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            {booked ? <span className="class-badge badge-yours">Jesteś zapisana · {booking?.payment_method === "entries" ? "🎫 wejście" : "💵 gotówka"}</span>
              : onWaitlist ? <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>Jesteś w kolejce</span>
              : isFull ? <span className="class-badge badge-full">Brak wolnych miejsc</span>
              : <span className="class-badge badge-open">Wolne miejsca</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>📅</span>
              <div><div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{formatDate(cls.starts_at)}</div></div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>🕐</span>
              <div><div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Godzina</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{formatTime(cls.starts_at)} · {cls.duration_min} min</div></div>
            </div>
            {cls.location && <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>📍</span>
              <div><div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Lokalizacja</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{cls.location}</div></div>
            </div>}
            {cls.price_pln && <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>💰</span>
              <div><div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cena</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{cls.price_pln} zł</div></div>
            </div>}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>👥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dostępność</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{count} / {cls.max_spots} miejsc</div>
                <div className="spots-bar" style={{ marginTop: "0.4rem" }}>
                  <div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {cls.notes && (
            <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>📌 Informacje dodatkowe</div>
              <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", lineHeight: 1.6 }}>{cls.notes}</p>
            </div>
          )}

          {booked ? (
            <>
              {status === "after_cutoff" && (
                <div style={{ background: "#FEF3E8", border: "1px solid #E8C5B5", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#8B5A2B" }}>
                  ⚠️ Po 12:00 — anulowanie możliwe, ale {booking?.payment_method === "entries" ? "stracisz wejście" : "bez konsekwencji"}.
                </div>
              )}
              <button className="btn btn-danger btn-full" onClick={() => handleCancel(booking)} disabled={actionLoading === cls.id}>
                {actionLoading === cls.id ? "..." : "Anuluj rezerwację"}
              </button>
            </>
          ) : onWaitlist ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleLeaveWaitlist(cls)} disabled={actionLoading === cls.id}>
              {actionLoading === cls.id ? "..." : "Wypisz się z kolejki"}
            </button>
          ) : isFull ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleJoinWaitlist(cls)} disabled={actionLoading === cls.id}>
              {actionLoading === cls.id ? "..." : "Dołącz do kolejki"}
            </button>
          ) : (
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); setShowBookModal(cls); }} disabled={actionLoading === cls.id}>
              Zapisz się →
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
            style={{ position: "fixed", top: "1rem", right: "1rem", left: "1rem", zIndex: 999, maxWidth: 420, margin: "0 auto" }}>
            {message.text}
          </div>
        )}

        {tab === "upcoming" && (
          <>
            <div className="page-header"><h2>Nadchodzące zajęcia</h2><p>Kliknij w zajęcia, aby zobaczyć szczegóły</p></div>
            {currentTokens && currentTokens.amount > 0 && (
              <div className="card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎫</span>
                <div>
                  <div style={{ fontWeight: 500 }}>Wejścia w tym miesiącu: <strong style={{ color: "var(--sage-dark)" }}>{currentTokens.amount}</strong></div>
                  <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>Możesz użyć wejść z karnetu przy zapisie</div>
                </div>
              </div>
            )}
            {loading ? <div className="empty-state"><p>Ładowanie...</p></div>
              : classes.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>Brak zajęć.</p></div>
              : (
                <div className="cards-grid">
                  {classes.map(cls => {
                    const booked = isBooked(cls.id);
                    const booking = getBooking(cls.id);
                    const onWaitlist = isOnWaitlist(cls.id);
                    const count = getBookedCount(cls);
                    const waitlistCount = cls.waitlist?.length || 0;
                    const isFull = count >= cls.max_spots;
                    const fillPct = Math.min((count / cls.max_spots) * 100, 100);
                    return (
                      <div className="class-card" key={cls.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(cls)}>
                        <div className="class-card-header">
                          <span className="class-title">{cls.name}</span>
                          {booked ? <span className="class-badge badge-yours">Zapisana {booking?.payment_method === "entries" ? "🎫" : "💵"}</span>
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
                          {cls.notes && <p style={{ fontSize: "0.78rem", color: "var(--mid)", marginTop: "0.5rem", fontStyle: "italic" }}>📌 {cls.notes.length > 55 ? cls.notes.slice(0, 55) + "..." : cls.notes}</p>}
                          <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>Kliknij, aby zobaczyć szczegóły →</p>
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
            <div className="page-header"><h2>Moje rezerwacje</h2></div>
            {upcomingMyClasses.length === 0
              ? <div className="empty-state"><div className="empty-icon">✦</div><p>Brak rezerwacji.</p></div>
              : <div className="cards-grid">{upcomingMyClasses.map(b => {
                const status = cancelStatus(b.classes?.starts_at);
                return (
                  <div className="class-card" key={b.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(b.classes)}>
                    <div className="class-card-header">
                      <span className="class-title">{b.classes?.name}</span>
                      <span className="class-badge badge-yours">{b.payment_method === "entries" ? "🎫 wejście" : "💵 gotówka"}</span>
                    </div>
                    <div className="class-card-body">
                      <div className="class-meta">
                        <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(b.classes?.starts_at)}</div>
                        <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(b.classes?.starts_at)} · {b.classes?.duration_min} min</div>
                      </div>
                      {status === "after_cutoff" && (
                        <p style={{ fontSize: "0.75rem", color: "var(--clay)", marginTop: "0.5rem" }}>⚠️ Po 12:00 — anulowanie bez zwrotu wejścia</p>
                      )}
                      <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>Kliknij, aby zobaczyć szczegóły →</p>
                    </div>
                  </div>
                );
              })}</div>}
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
                  <div className="user-avatar" style={{ width: 56, height: 56, fontSize: "1.5rem" }}>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
                  <div>
                    <div className="user-name" style={{ fontSize: "1.1rem" }}>{profile?.first_name} {profile?.last_name}</div>
                    <div className="user-role">{profile?.email}</div>
                  </div>
                </div>
                <button className="btn btn-danger btn-full" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1.3rem" }}>🎫 Moje wejścia</h3>
                {myTokens.length === 0 ? (
                  <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Brak wejść. Skontaktuj się z Pauliną.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {myTokens.map(t => (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--mid)", fontSize: "0.875rem" }}>{monthName(t.month)} {t.year}</span>
                        <span style={{ fontWeight: 600, color: t.amount > 0 ? "var(--sage-dark)" : "var(--light)", fontSize: "1.1rem" }}>
                          {t.amount} {t.amount === 1 ? "wejście" : t.amount < 5 ? "wejścia" : "wejść"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--light)" }}>
                  1 wejście = 1 zajęcia. Anuluj przed 12:00 w dniu zajęć aby odzyskać wejście.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {detailClass && <DetailModal cls={detailClass} onClose={() => setDetailClass(null)} />}
      {showBookModal && <BookModal cls={showBookModal} onClose={() => setShowBookModal(null)} />}
      {showCancelWarning && <CancelWarningModal booking={showCancelWarning} onClose={() => setShowCancelWarning(null)} />}

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
