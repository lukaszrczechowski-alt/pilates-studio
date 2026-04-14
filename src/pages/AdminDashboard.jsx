import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AdminDashboard({ session, profile }) {
  const [tab, setTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [userTokens, setUserTokens] = useState([]);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [stats, setStats] = useState({ totalClasses: 0, totalBookings: 0, uniqueClients: 0 });
  const [form, setForm] = useState({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "" });
  const [tokenForm, setTokenForm] = useState({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function fetchAll() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase.from("classes").select("*, bookings(*), waitlist(*)")
      .order("starts_at", { ascending: true });
    const { data: bookingData } = await supabase.from("bookings")
      .select("id, class_id, user_id, created_at, profiles(first_name, last_name, email), classes(id, name, starts_at)")
      .order("created_at", { ascending: false });
    const { data: profileData } = await supabase.from("profiles").select("*")
      .eq("role", "client").order("created_at", { ascending: false });
    const { data: notifData } = await supabase.from("notifications").select("*")
      .order("created_at", { ascending: false }).limit(50);
    setClasses(classData || []);
    setAllBookings(bookingData || []);
    setAllProfiles(profileData || []);
    setNotifications(notifData || []);
    setUnreadCount((notifData || []).filter(n => !n.read).length);
    setStats({
      totalClasses: (classData || []).filter(c => c.starts_at >= now).length,
      totalBookings: (bookingData || []).filter(b => b.classes?.starts_at >= now).length,
      uniqueClients: (profileData || []).length,
    });
    setLoading(false);
  }

  async function fetchUserTokens(userId) {
    const { data } = await supabase.from("tokens").select("*")
      .eq("user_id", userId).order("year", { ascending: false }).order("month", { ascending: false });
    const { data: hist } = await supabase.from("token_history").select("*, classes(name)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setUserTokens(data || []);
    setTokenHistory(hist || []);
  }

  async function fetchParticipants(classId) {
    const { data } = await supabase.from("bookings")
      .select("id, created_at, user_id, profiles(first_name, last_name, email)")
      .eq("class_id", classId);
    setParticipants(data || []);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function openCreate() {
    setEditClass(null);
    setForm({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "" });
    setShowModal(true);
  }

  function openEdit(cls) {
    setEditClass(cls);
    const local = new Date(cls.starts_at);
    const localStr = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ name: cls.name, starts_at: localStr, duration_min: cls.duration_min, max_spots: cls.max_spots, location: cls.location || "", notes: cls.notes || "" });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.starts_at) return;
    const payload = { ...form, starts_at: new Date(form.starts_at).toISOString() };
    if (editClass) await supabase.from("classes").update(payload).eq("id", editClass.id);
    else await supabase.from("classes").insert(payload);
    setShowModal(false);
    await fetchAll();
  }

  async function handleDelete(id) {
    if (!confirm("Na pewno usunąć te zajęcia?")) return;
    await supabase.from("bookings").delete().eq("class_id", id);
    await supabase.from("waitlist").delete().eq("class_id", id);
    await supabase.from("classes").delete().eq("id", id);
    await fetchAll();
  }

  async function handleRemoveParticipant(bookingId) {
    await supabase.from("bookings").delete().eq("id", bookingId);
    await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  // Admin zapisuje usera na zajęcia
  async function handleAddUserToClass(userId, classId) {
    const { error } = await supabase.from("bookings").insert({ class_id: classId, user_id: userId });
    if (error) showMsg("Użytkownik już jest zapisany na te zajęcia.", "error");
    else showMsg("Użytkownik został zapisany na zajęcia! ✓");
    setShowAddUserModal(false);
    await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  function openParticipants(cls) {
    setSelectedClass(cls);
    fetchParticipants(cls.id);
    setTab("participants");
  }

  // Otwórz panel tokenów usera
  function openUserTokens(user) {
    setSelectedUser(user);
    setTokenForm({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
    fetchUserTokens(user.id);
    setShowTokenModal(true);
  }

  // Dodaj tokeny
  async function handleAddTokens() {
    const { data: existing } = await supabase.from("tokens").select("*")
      .eq("user_id", selectedUser.id).eq("month", tokenForm.month).eq("year", tokenForm.year).single();

    if (existing) {
      await supabase.from("tokens").update({
        amount: existing.amount + tokenForm.amount,
        updated_at: new Date().toISOString(),
        note: tokenForm.note,
      }).eq("id", existing.id);
    } else {
      await supabase.from("tokens").insert({
        user_id: selectedUser.id,
        amount: tokenForm.amount,
        month: tokenForm.month,
        year: tokenForm.year,
        added_by: session.user.id,
        note: tokenForm.note,
      });
    }

    await supabase.from("token_history").insert({
      user_id: selectedUser.id,
      operation: "add",
      amount: tokenForm.amount,
      month: tokenForm.month,
      year: tokenForm.year,
      note: tokenForm.note || `Dodano przez admina`,
    });

    await supabase.from("notifications").insert({
      type: "tokens_added",
      user_id: selectedUser.id,
      message: `Dodano ${tokenForm.amount} token(ów) dla ${selectedUser.first_name} ${selectedUser.last_name} na ${monthName(tokenForm.month)} ${tokenForm.year}`,
    });

    showMsg(`Dodano ${tokenForm.amount} tokenów! ✓`);
    await fetchUserTokens(selectedUser.id);
    await fetchAll();
  }

  // Zużyj token po zajęciach
  async function handleUseToken(userId, classId, className) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data: tok } = await supabase.from("tokens").select("*")
      .eq("user_id", userId).eq("month", month).eq("year", year).single();

    if (!tok || tok.amount <= 0) {
      showMsg("Brak tokenów na ten miesiąc.", "error"); return;
    }

    await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
    await supabase.from("token_history").insert({
      user_id: userId, class_id: classId, operation: "use", amount: -1,
      month, year, note: `Zużyto za zajęcia: ${className}`,
    });
    showMsg("Token zużyty! ✓");
    await fetchAll();
  }

  function monthName(m) {
    return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  function formatRelative(iso) {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return "przed chwilą";
    if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`;
    return formatDate(iso);
  }

  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date());
  const pastClasses = classes.filter(c => new Date(c.starts_at) < new Date());

  // Statystyki
  const dayStats = [0,1,2,3,4,5,6].map(day => ({
    name: ["Nd","Pn","Wt","Śr","Cz","Pt","So"][day],
    count: allBookings.filter(b => new Date(b.classes?.starts_at).getDay() === day).length,
  }));
  const maxDay = Math.max(...dayStats.map(d => d.count), 1);
  const hourStats = {};
  allBookings.forEach(b => { const h = new Date(b.classes?.starts_at).getHours(); hourStats[h] = (hourStats[h] || 0) + 1; });
  const topHours = Object.entries(hourStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Tokeny per user (bieżący miesiąc)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const notifIcon = (type) => ({ booking: "✅", cancel: "❌", waitlist_promoted: "⬆️", tokens_added: "🎟️" }[type] || "🔔");

  // Uzytkownicy niezapisani na wybrane zajęcia
  const notEnrolled = selectedClass
    ? allProfiles.filter(p => !participants.some(part => part.user_id === p.id))
    : [];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><h1>Pilates</h1><p>Panel admina</p></div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>
            <span className="nav-icon">🗓</span> Zajęcia
          </div>
          <div className={`nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { setTab("notifications"); markAllRead(); }}>
            <span className="nav-icon">🔔</span> Powiadomienia
            {unreadCount > 0 && <span style={{ marginLeft: "auto", background: "var(--clay)", color: "white", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.7rem" }}>{unreadCount}</span>}
          </div>
          <div className={`nav-item ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
            <span className="nav-icon">📊</span> Statystyki
          </div>
          <div className={`nav-item ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            <span className="nav-icon">📋</span> Historia
          </div>
          <div className={`nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}>
            <span className="nav-icon">👥</span> Klienci
          </div>
          {selectedClass && (
            <div className={`nav-item ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}>
              <span className="nav-icon">✦</span> Uczestnicy
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
            <div><div className="user-name">{profile?.first_name} {profile?.last_name}</div><div className="user-role">Administrator</div></div>
          </div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
        </div>
      </aside>

      <main className="main-content">
        {message && (
          <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`}
            style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 999, maxWidth: 400 }}>
            {message.text}
          </div>
        )}

        {/* ZAJĘCIA */}
        {tab === "classes" && (
          <>
            <div className="page-header"><h2>Zarządzanie zajęciami</h2><p>Twórz zajęcia i zarządzaj rezerwacjami</p></div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value">{stats.totalClasses}</div><div className="stat-label">Nadchodzące zajęcia</div></div>
              <div className="stat-card"><div className="stat-value">{stats.totalBookings}</div><div className="stat-label">Aktywne rezerwacje</div></div>
              <div className="stat-card"><div className="stat-value">{stats.uniqueClients}</div><div className="stat-label">Klientów łącznie</div></div>
            </div>
            <div className="section-header">
              <h3>Nadchodzące zajęcia</h3>
              <button className="btn btn-primary" onClick={openCreate}>+ Nowe zajęcia</button>
            </div>
            {loading ? <div className="empty-state"><p>Ładowanie...</p></div>
              : upcomingClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>Brak zaplanowanych zajęć.</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Nazwa</th><th>Data</th><th>Godzina</th><th>Czas</th><th>Miejsca</th><th>Kolejka</th><th>Uczestnicy</th><th>Akcje</th></tr></thead>
                    <tbody>
                      {upcomingClasses.map(cls => {
                        const count = cls.bookings?.length || 0;
                        const waitCount = cls.waitlist?.length || 0;
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong></td>
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{cls.duration_min} min</td>
                            <td>{count} / {cls.max_spots}</td>
                            <td>{waitCount > 0 ? <span style={{ color: "var(--clay)" }}>{waitCount} os.</span> : "—"}</td>
                            <td><button className="btn btn-secondary btn-sm" onClick={() => openParticipants(cls)}>Lista ({count})</button></td>
                            <td style={{ display: "flex", gap: "0.5rem" }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cls)}>Edytuj</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cls.id)}>Usuń</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}

        {/* UCZESTNICY */}
        {tab === "participants" && selectedClass && (
          <>
            <div className="page-header"><h2>{selectedClass.name}</h2><p>{formatDate(selectedClass.starts_at)} o {formatTime(selectedClass.starts_at)}</p></div>
            <div className="section-header">
              <h3>Lista uczestników ({participants.length} / {selectedClass.max_spots})</h3>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddUserModal(true)}>+ Dodaj uczestnika</button>
                <button className="btn btn-secondary" onClick={() => setTab("classes")}>← Wróć</button>
              </div>
            </div>
            {participants.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><p>Nikt się nie zapisał</p></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>#</th><th>Imię i nazwisko</th><th>Email</th><th>Data zapisu</th><th>Token</th><th>Akcja</th></tr></thead>
                  <tbody>
                    {participants.map((b, i) => (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                        <td>{b.profiles?.email}</td>
                        <td>{new Date(b.created_at).toLocaleDateString("pl-PL")}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleUseToken(b.user_id, selectedClass.id, selectedClass.name)}>
                            🎟️ Zużyj
                          </button>
                        </td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => handleRemoveParticipant(b.id)}>Usuń</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* POWIADOMIENIA */}
        {tab === "notifications" && (
          <>
            <div className="page-header"><h2>Powiadomienia</h2></div>
            {notifications.length === 0 ? <div className="empty-state"><div className="empty-icon">🔔</div><p>Brak powiadomień</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Typ</th><th>Wiadomość</th><th>Kiedy</th></tr></thead>
                    <tbody>
                      {notifications.map(n => (
                        <tr key={n.id} style={{ background: n.read ? "transparent" : "rgba(138,158,133,0.06)" }}>
                          <td style={{ fontSize: "1.2rem" }}>{notifIcon(n.type)}</td>
                          <td style={{ fontWeight: n.read ? 400 : 500 }}>{n.message}</td>
                          <td style={{ color: "var(--mid)", whiteSpace: "nowrap" }}>{formatRelative(n.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}

        {/* STATYSTYKI */}
        {tab === "stats" && (
          <>
            <div className="page-header"><h2>Statystyki</h2></div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value">{allBookings.length}</div><div className="stat-label">Rezerwacji łącznie</div></div>
              <div className="stat-card"><div className="stat-value">{classes.length}</div><div className="stat-label">Zajęć łącznie</div></div>
              <div className="stat-card"><div className="stat-value">{stats.uniqueClients}</div><div className="stat-label">Klientów</div></div>
            </div>
            <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Frekwencja wg dnia tygodnia</h3></div>
            <div className="card" style={{ marginBottom: "2rem", padding: "1.5rem 1.5rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", height: 160 }}>
                {dayStats.map(d => (
                  <div key={d.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mid)" }}>{d.count}</span>
                    <div style={{ width: "100%", background: "var(--sage)", borderRadius: "4px 4px 0 0", height: `${(d.count / maxDay) * 120}px`, minHeight: d.count > 0 ? 8 : 0 }} />
                    <span style={{ fontSize: "0.75rem", color: "var(--mid)", fontWeight: 500 }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Najpopularniejsze godziny</h3></div>
            <div className="card">
              {topHours.length === 0 ? <p style={{ color: "var(--mid)" }}>Brak danych</p>
                : topHours.map(([hour, count], i) => (
                  <div key={hour} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.6rem 0", borderBottom: i < topHours.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: "1.2rem" }}>{["🥇","🥈","🥉"][i]}</span>
                    <span style={{ fontWeight: 500 }}>{hour}:00 – {parseInt(hour)+1}:00</span>
                    <span style={{ marginLeft: "auto", color: "var(--mid)", fontSize: "0.875rem" }}>{count} rezerwacji</span>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* HISTORIA */}
        {tab === "history" && (
          <>
            <div className="page-header"><h2>Historia zajęć</h2></div>
            {pastClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><p>Brak minionych zajęć</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Nazwa</th><th>Data</th><th>Godzina</th><th>Uczestnicy</th></tr></thead>
                    <tbody>
                      {pastClasses.map(cls => {
                        const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong></td>
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{bookingsForClass.length > 0
                              ? bookingsForClass.map(b => <span key={b.id} className="participant-chip">{b.profiles?.first_name} {b.profiles?.last_name}</span>)
                              : <span style={{ color: "var(--light)", fontSize: "0.8rem" }}>brak</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}

        {/* KLIENCI */}
        {tab === "clients" && (
          <>
            <div className="page-header"><h2>Klienci</h2><p>Zarządzaj klientami i tokenami</p></div>
            {allProfiles.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak klientów</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Imię i nazwisko</th><th>Email</th><th>Rezerwacje</th><th>Tokeny ({monthName(currentMonth)})</th><th>Akcje</th></tr></thead>
                    <tbody>
                      {allProfiles.map((c, i) => {
                        const clientBookings = allBookings.filter(b => b.user_id === c.id);
                        return (
                          <tr key={i}>
                            <td><strong>{c.first_name} {c.last_name}</strong></td>
                            <td>{c.email}</td>
                            <td>{clientBookings.length}</td>
                            <td>
                              <TokenBadge userId={c.id} month={currentMonth} year={currentYear} />
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-sm" onClick={() => openUserTokens(c)}>
                                🎟️ Tokeny
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </main>

      {/* Mobile nav */}
      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>
          <span className="mobile-nav-icon">🗓</span><span>Zajęcia</span>
        </div>
        <div className={`mobile-nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { setTab("notifications"); markAllRead(); }}>
          <span className="mobile-nav-icon" style={{ position: "relative" }}>
            🔔{unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--clay)", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>}
          </span>
          <span>Powiadomienia</span>
        </div>
        <div className={`mobile-nav-item ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
          <span className="mobile-nav-icon">📊</span><span>Statystyki</span>
        </div>
        <div className={`mobile-nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}>
          <span className="mobile-nav-icon">👥</span><span>Klienci</span>
        </div>
      </nav>

      {/* MODAL - Nowe/edytuj zajęcia */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editClass ? "Edytuj zajęcia" : "Nowe zajęcia"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="form-group"><label className="form-label">Nazwa zajęć</label>
              <input className="form-input" placeholder="np. Pilates Flow" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Data i godzina</label>
              <input className="form-input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Czas (min)</label>
                <input className="form-input" type="number" min="15" max="180" step="15" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Maks. miejsc</label>
                <input className="form-input" type="number" min="1" max="50" value={form.max_spots} onChange={e => setForm({ ...form, max_spots: +e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Lokalizacja</label>
              <input className="form-input" placeholder="np. Sala A" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Notatki</label>
              <input className="form-input" placeholder="np. Przynieś matę" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.starts_at}>
                {editClass ? "Zapisz zmiany" : "Utwórz zajęcia"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Tokeny usera */}
      {showTokenModal && selectedUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTokenModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>🎟️ Tokeny — {selectedUser.first_name} {selectedUser.last_name}</h3>
              <button className="modal-close" onClick={() => setShowTokenModal(false)}>×</button>
            </div>

            {/* Aktualne tokeny */}
            <div style={{ marginBottom: "1.5rem" }}>
              <p className="form-label" style={{ marginBottom: "0.75rem" }}>Saldo tokenów</p>
              {userTokens.length === 0 ? (
                <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Brak tokenów</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {userTokens.map(t => (
                    <div key={t.id} style={{ background: t.amount > 0 ? "#EBF5EA" : "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "1.4rem", fontFamily: "Cormorant Garamond, serif", color: t.amount > 0 ? "var(--sage-dark)" : "var(--light)" }}>{t.amount}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{monthName(t.month)} {t.year}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dodaj tokeny */}
            <p className="form-label" style={{ marginBottom: "0.75rem" }}>Dodaj tokeny</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Liczba</label>
                <input className="form-input" type="number" min="1" max="30" value={tokenForm.amount}
                  onChange={e => setTokenForm({ ...tokenForm, amount: +e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Miesiąc</label>
                <select className="form-input" value={tokenForm.month} onChange={e => setTokenForm({ ...tokenForm, month: +e.target.value })}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Rok</label>
                <input className="form-input" type="number" min="2024" max="2030" value={tokenForm.year}
                  onChange={e => setTokenForm({ ...tokenForm, year: +e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notatka (opcjonalnie)</label>
              <input className="form-input" placeholder="np. Opłata gotówką" value={tokenForm.note}
                onChange={e => setTokenForm({ ...tokenForm, note: e.target.value })} />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleAddTokens}>
              + Dodaj {tokenForm.amount} token(ów) na {monthName(tokenForm.month)}
            </button>

            {/* Historia */}
            {tokenHistory.length > 0 && (
              <>
                <p className="form-label" style={{ margin: "1.5rem 0 0.75rem" }}>Historia operacji</p>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  {tokenHistory.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem" }}>
                      <span style={{ color: h.amount > 0 ? "var(--sage-dark)" : "var(--clay)" }}>
                        {h.amount > 0 ? "+" : ""}{h.amount} · {h.note || h.classes?.name || "—"}
                      </span>
                      <span style={{ color: "var(--light)" }}>{monthName(h.month)} {h.year}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL - Dodaj uczestnika do zajęć */}
      {showAddUserModal && selectedClass && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddUserModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Dodaj uczestnika</h3>
              <button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <p style={{ color: "var(--mid)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              Wybierz klientkę do zapisania na: <strong>{selectedClass.name}</strong>
            </p>
            {notEnrolled.length === 0 ? (
              <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Wszystkie klientki są już zapisane.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 300, overflowY: "auto" }}>
                {notEnrolled.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{u.email}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddUserToClass(u.id, selectedClass.id)}>
                      Zapisz
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Komponent badge tokenów
function TokenBadge({ userId, month, year }) {
  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    supabase.from("tokens").select("amount").eq("user_id", userId).eq("month", month).eq("year", year).single()
      .then(({ data }) => setTokens(data?.amount ?? 0));
  }, [userId, month, year]);
  if (tokens === null) return <span style={{ color: "var(--light)" }}>—</span>;
  return (
    <span style={{ fontWeight: 500, color: tokens > 0 ? "var(--sage-dark)" : "var(--light)" }}>
      🎟️ {tokens}
    </span>
  );
}
