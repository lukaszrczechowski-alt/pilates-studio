import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

export default function AdminDashboard({ session, profile }) {
  const [tab, setTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tokenHistory, setTokenHistory] = useState([]);
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
  const [userTokenHistory, setUserTokenHistory] = useState([]);
  const [stats, setStats] = useState({ totalClasses: 0, totalBookings: 0, uniqueClients: 0 });
  const [form, setForm] = useState({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
  const [tokenForm, setTokenForm] = useState({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
  const [message, setMessage] = useState(null);

  // Filtry raportów
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportView, setReportView] = useState("summary"); // summary | classes | clients | entries
  const reportRef = useRef(null);

  useEffect(() => { fetchAll(); }, []);

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function fetchAll() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase.from("classes").select("*, bookings(*, profiles(first_name, last_name)), waitlist(*)")
      .order("starts_at", { ascending: true });
    const { data: bookingData } = await supabase.from("bookings")
      .select("id, class_id, user_id, created_at, payment_method, profiles(first_name, last_name, email), classes(id, name, starts_at, price_pln, venue_cost_pln, duration_min, max_spots)")
      .order("created_at", { ascending: false });
    const { data: profileData } = await supabase.from("profiles").select("*")
      .eq("role", "client").order("created_at", { ascending: false });
    const { data: notifData } = await supabase.from("notifications").select("*")
      .order("created_at", { ascending: false }).limit(50);
    const { data: histData } = await supabase.from("token_history")
      .select("*, classes(name, starts_at, price_pln), profiles(first_name, last_name)")
      .order("created_at", { ascending: false });
    setClasses(classData || []);
    setAllBookings(bookingData || []);
    setAllProfiles(profileData || []);
    setNotifications(notifData || []);
    setTokenHistory(histData || []);
    setUnreadCount((notifData || []).filter(n => !n.read).length);
    setStats({
      totalClasses: (classData || []).filter(c => c.starts_at >= now).length,
      totalBookings: (bookingData || []).filter(b => b.classes?.starts_at >= now).length,
      uniqueClients: (profileData || []).length,
    });
    setLoading(false);
  }

  async function fetchUserTokens(userId) {
    const { data } = await supabase.from("tokens").select("*").eq("user_id", userId)
      .order("year", { ascending: false }).order("month", { ascending: false });
    const { data: hist } = await supabase.from("token_history").select("*, classes(name)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setUserTokens(data || []);
    setUserTokenHistory(hist || []);
  }

  async function fetchParticipants(classId) {
    const { data } = await supabase.from("bookings")
      .select("id, created_at, user_id, payment_method, profiles(first_name, last_name, email)")
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
    setForm({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
    setShowModal(true);
  }

  function openEdit(cls) {
    setEditClass(cls);
    const local = new Date(cls.starts_at);
    const localStr = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ name: cls.name, starts_at: localStr, duration_min: cls.duration_min, max_spots: cls.max_spots, location: cls.location || "", notes: cls.notes || "", price_pln: cls.price_pln || "", venue_cost_pln: cls.venue_cost_pln || "" });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.starts_at) return;
    const payload = {
      name: form.name,
      starts_at: new Date(form.starts_at).toISOString(),
      duration_min: +form.duration_min,
      max_spots: +form.max_spots,
      location: form.location,
      notes: form.notes,
      price_pln: form.price_pln ? +form.price_pln : null,
      venue_cost_pln: form.venue_cost_pln ? +form.venue_cost_pln : null,
    };
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

  async function handleAddUserToClass(userId, classId) {
    const { error } = await supabase.from("bookings").insert({ class_id: classId, user_id: userId, payment_method: "cash" });
    if (error) showMsg("Użytkownik już jest zapisany.", "error");
    else showMsg("Zapisano! ✓");
    setShowAddUserModal(false);
    await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  function openParticipants(cls) {
    setSelectedClass(cls);
    fetchParticipants(cls.id);
    setTab("participants");
  }

  function openUserTokens(user) {
    setSelectedUser(user);
    setTokenForm({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
    fetchUserTokens(user.id);
    setShowTokenModal(true);
  }

  async function handleAddTokens() {
    const { data: existing } = await supabase.from("tokens").select("*")
      .eq("user_id", selectedUser.id).eq("month", tokenForm.month).eq("year", tokenForm.year).single();
    if (existing) {
      await supabase.from("tokens").update({ amount: existing.amount + tokenForm.amount, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tokens").insert({ user_id: selectedUser.id, amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, added_by: session.user.id, note: tokenForm.note });
    }
    await supabase.from("token_history").insert({ user_id: selectedUser.id, operation: "add", amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, note: tokenForm.note || "Dodano przez admina" });
    await supabase.from("notifications").insert({ type: "tokens_added", user_id: selectedUser.id, message: `Dodano ${tokenForm.amount} wejść dla ${selectedUser.first_name} ${selectedUser.last_name} na ${monthName(tokenForm.month)} ${tokenForm.year}` });
    showMsg(`Dodano ${tokenForm.amount} wejść! ✓`);
    await fetchUserTokens(selectedUser.id);
    await fetchAll();
  }

  async function handleUseToken(userId, classId, className) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { data: tok } = await supabase.from("tokens").select("*").eq("user_id", userId).eq("month", month).eq("year", year).single();
    if (!tok || tok.amount <= 0) { showMsg("Brak wejść na ten miesiąc.", "error"); return; }
    await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
    await supabase.from("token_history").insert({ user_id: userId, class_id: classId, operation: "use", amount: -1, month, year, note: `Zużyto za: ${className}` });
    showMsg("Wejście zużyte! ✓");
    await fetchAll();
  }

  async function handleSettleNow(userId, classId, className, startsAt) {
    const d = new Date(startsAt);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const { data: existing } = await supabase.from("tokens").select("*").eq("user_id", userId).eq("month", month).eq("year", year).single();
    if (existing) {
      await supabase.from("tokens").update({ amount: existing.amount + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tokens").insert({ user_id: userId, amount: 1, month, year, added_by: session.user.id });
    }
    await supabase.from("token_history").insert([
      { user_id: userId, class_id: classId, operation: "add", amount: 1, month, year, note: "Rozliczenie — dodano" },
      { user_id: userId, class_id: classId, operation: "use", amount: -1, month, year, note: `Rozliczenie — zużyto za: ${className}` },
    ]);
    await supabase.from("tokens").update({ amount: existing ? existing.amount : 0, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("month", month).eq("year", year);
    showMsg("Rozliczono! ✓");
    await fetchAll();
  }

  function monthName(m) { return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1]; }
  function formatDate(iso) { return new Date(iso).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function formatTime(iso) { return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }); }
  function formatRelative(iso) {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return "przed chwilą";
    if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`;
    return formatDate(iso);
  }

  // =============================================
  // DANE DO RAPORTÓW
  // =============================================
  function getReportData() {
    // Zajęcia w wybranym miesiącu
    const monthClasses = classes.filter(c => {
      const d = new Date(c.starts_at);
      return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
    });

    // Rezerwacje dla tych zajęć
    const monthBookings = allBookings.filter(b => {
      const d = new Date(b.classes?.starts_at);
      return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
    });

    // Zajęcia które się odbyły (w przeszłości)
    const pastClasses = monthClasses.filter(c => new Date(c.starts_at) < new Date());

    // Per zajęcia
    const classReports = pastClasses.map(cls => {
      const bookings = monthBookings.filter(b => b.class_id === cls.id);
      const entriesBookings = bookings.filter(b => b.payment_method === "entries");
      const cashBookings = bookings.filter(b => b.payment_method === "cash");
      const revenue = (cls.price_pln || 0) * bookings.length;
      const venueCost = cls.venue_cost_pln || 0;
      const profit = revenue - venueCost;
      const occupancy = cls.max_spots > 0 ? Math.round((bookings.length / cls.max_spots) * 100) : 0;
      return { cls, bookings, entriesBookings, cashBookings, revenue, venueCost, profit, occupancy };
    });

    // Przepadłe wejścia
    const lostEntries = tokenHistory.filter(h => {
      const d = new Date(h.created_at);
      return h.operation === "use" && h.note?.includes("przepadło") &&
        d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear;
    });

    // Per klient
    const clientReports = allProfiles.map(p => {
      const bookings = monthBookings.filter(b => b.user_id === p.id);
      const entriesCount = bookings.filter(b => b.payment_method === "entries").length;
      const cashCount = bookings.filter(b => b.payment_method === "cash").length;
      const spent = bookings.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);
      const lost = lostEntries.filter(h => h.user_id === p.id).length;
      return { profile: p, bookings, entriesCount, cashCount, spent, lost };
    }).filter(c => c.bookings.length > 0);

    // Sumy
    const totalRevenue = classReports.reduce((s, r) => s + r.revenue, 0);
    const totalCosts = classReports.reduce((s, r) => s + r.venueCost, 0);
    const totalProfit = totalRevenue - totalCosts;
    const totalBookings = monthBookings.length;
    const avgOccupancy = classReports.length > 0 ? Math.round(classReports.reduce((s, r) => s + r.occupancy, 0) / classReports.length) : 0;

    return { monthClasses, pastClasses, classReports, clientReports, lostEntries, totalRevenue, totalCosts, totalProfit, totalBookings, avgOccupancy };
  }

  function handlePrint() {
    window.print();
  }

  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date());
  const pastClasses = classes.filter(c => new Date(c.starts_at) < new Date());

  // DO ROZLICZENIA
  const settled = new Set(tokenHistory.filter(h => h.operation === "use" && !h.note?.includes("przepadło")).map(h => `${h.user_id}_${h.class_id}`));
  const toSettle = allBookings.filter(b => {
    const classTime = new Date(b.classes?.starts_at);
    return classTime < new Date() && !settled.has(`${b.user_id}_${b.class_id}`);
  });
  const totalOwed = toSettle.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);

  // Statystyki
  const dayStats = [0,1,2,3,4,5,6].map(day => ({ name: ["Nd","Pn","Wt","Śr","Cz","Pt","So"][day], count: allBookings.filter(b => new Date(b.classes?.starts_at).getDay() === day).length }));
  const maxDay = Math.max(...dayStats.map(d => d.count), 1);
  const hourStats = {};
  allBookings.forEach(b => { const h = new Date(b.classes?.starts_at).getHours(); hourStats[h] = (hourStats[h] || 0) + 1; });
  const topHours = Object.entries(hourStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const notifIcon = (type) => ({ booking: "✅", cancel: "❌", waitlist_promoted: "⬆️", tokens_added: "🎫" }[type] || "🔔");
  const notEnrolled = selectedClass ? allProfiles.filter(p => !participants.some(part => part.user_id === p.id)) : [];

  const rd = getReportData();

  return (
    <div className="app-layout">
      {/* Print styles */}
      <style>{`
        @media print {
          .sidebar, .mobile-nav, .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 !important; }
          .print-header { display: block !important; }
          body { background: white !important; }
        }
        .print-header { display: none; }
      `}</style>

      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => setTab("classes")} style={{ cursor: "pointer" }}><h1>Pilates</h1><p>Panel admina</p></div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}><span className="nav-icon">🗓</span> Zajęcia</div>
          <div className={`nav-item ${tab === "settle" ? "active" : ""}`} onClick={() => setTab("settle")}>
            <span className="nav-icon">💰</span> Do rozliczenia
            {toSettle.length > 0 && <span style={{ marginLeft: "auto", background: "var(--clay)", color: "white", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.7rem" }}>{toSettle.length}</span>}
          </div>
          <div className={`nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}><span className="nav-icon">📈</span> Raporty</div>
          <div className={`nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { setTab("notifications"); markAllRead(); }}>
            <span className="nav-icon">🔔</span> Powiadomienia
            {unreadCount > 0 && <span style={{ marginLeft: "auto", background: "var(--clay)", color: "white", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.7rem" }}>{unreadCount}</span>}
          </div>
          <div className={`nav-item ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}><span className="nav-icon">📊</span> Statystyki</div>
          <div className={`nav-item ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}><span className="nav-icon">📋</span> Historia</div>
          <div className={`nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}><span className="nav-icon">👥</span> Klienci</div>
          {selectedClass && <div className={`nav-item ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}><span className="nav-icon">✦</span> Uczestnicy</div>}
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
        {message && <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`} style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 999, maxWidth: 400 }}>{message.text}</div>}

        {/* ZAJĘCIA */}
        {tab === "classes" && (
          <>
            <div className="page-header"><h2>Zarządzanie zajęciami</h2></div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value">{stats.totalClasses}</div><div className="stat-label">Nadchodzące zajęcia</div></div>
              <div className="stat-card"><div className="stat-value">{stats.totalBookings}</div><div className="stat-label">Aktywne rezerwacje</div></div>
              <div className="stat-card"><div className="stat-value">{stats.uniqueClients}</div><div className="stat-label">Klientów łącznie</div></div>
            </div>
            <div className="section-header"><h3>Nadchodzące zajęcia</h3><button className="btn btn-primary" onClick={openCreate}>+ Nowe zajęcia</button></div>
            {loading ? <div className="empty-state"><p>Ładowanie...</p></div>
              : upcomingClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>Brak zajęć.</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Nazwa</th><th>Data</th><th>Godz.</th><th>Cena</th><th>Sala</th><th>Miejsca</th><th>Kolejka</th><th>Uczestnicy</th><th>Akcje</th></tr></thead>
                    <tbody>
                      {upcomingClasses.map(cls => {
                        const count = cls.bookings?.length || 0;
                        const waitCount = cls.waitlist?.length || 0;
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong></td>
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
                            <td>{cls.venue_cost_pln ? <span style={{ color: "var(--clay)" }}>{cls.venue_cost_pln} zł</span> : "—"}</td>
                            <td>{count} / {cls.max_spots}</td>
                            <td>{waitCount > 0 ? <span style={{ color: "var(--clay)" }}>{waitCount}</span> : "—"}</td>
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

        {/* RAPORTY */}
        {tab === "reports" && (
          <>
            {/* Nagłówek do druku */}
            <div className="print-header" style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.5rem" }}>Pilates Studio — Raport {monthName(reportMonth)} {reportYear}</h2>
              <p style={{ color: "#666", fontSize: "0.85rem" }}>Wygenerowano: {new Date().toLocaleDateString("pl-PL")}</p>
            </div>

            <div className="page-header no-print">
              <h2>Raporty i rozliczenia</h2>
              <p>Analizuj przychody, koszty i aktywność klientów</p>
            </div>

            {/* Filtry */}
            <div className="no-print" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select className="form-input" style={{ width: "auto" }} value={reportMonth} onChange={e => setReportMonth(+e.target.value)}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
                <select className="form-input" style={{ width: "auto" }} value={reportYear} onChange={e => setReportYear(+e.target.value)}>
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["summary","classes","clients","entries"].map(v => (
                  <button key={v} className={`btn ${reportView === v ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setReportView(v)}>
                    {v === "summary" ? "Podsumowanie" : v === "classes" ? "Zajęcia" : v === "clients" ? "Klienci" : "Wejścia"}
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handlePrint} style={{ marginLeft: "auto" }}>🖨️ Drukuj / PDF</button>
            </div>

            {/* PODSUMOWANIE */}
            {reportView === "summary" && (
              <>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--sage-dark)" }}>{rd.totalRevenue} zł</div>
                    <div className="stat-label">Przychód brutto</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--clay)" }}>{rd.totalCosts} zł</div>
                    <div className="stat-label">Koszty sal</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{rd.totalProfit} zł</div>
                    <div className="stat-label">Dochód netto</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{rd.totalBookings}</div>
                    <div className="stat-label">Rezerwacji</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{rd.avgOccupancy}%</div>
                    <div className="stat-label">Średnie obłożenie</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: rd.lostEntries.length > 0 ? "var(--clay)" : "var(--light)" }}>{rd.lostEntries.length}</div>
                    <div className="stat-label">Przepadłe wejścia</div>
                  </div>
                </div>

                {rd.pastClasses.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📈</div><p>Brak danych dla {monthName(reportMonth)} {reportYear}</p></div>
                ) : (
                  <>
                    <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Przychód vs koszty per zajęcia</h3></div>
                    <div className="table-wrapper" style={{ marginBottom: "2rem" }}>
                      <table>
                        <thead><tr><th>Zajęcia</th><th>Data</th><th>Uczestników</th><th>Obłożenie</th><th>Przychód</th><th>Koszt sali</th><th>Dochód</th></tr></thead>
                        <tbody>
                          {rd.classReports.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.cls.name}</strong></td>
                              <td>{formatDate(r.cls.starts_at)}</td>
                              <td>{r.bookings.length} / {r.cls.max_spots}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{ width: `${r.occupancy}%`, height: "100%", background: r.occupancy >= 80 ? "var(--sage)" : r.occupancy >= 50 ? "var(--sage-light)" : "var(--border)", borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: "0.8rem" }}>{r.occupancy}%</span>
                                </div>
                              </td>
                              <td style={{ color: "var(--sage-dark)", fontWeight: 500 }}>{r.revenue} zł</td>
                              <td style={{ color: r.venueCost > 0 ? "var(--clay)" : "var(--light)" }}>{r.venueCost > 0 ? `${r.venueCost} zł` : "—"}</td>
                              <td style={{ fontWeight: 600, color: r.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{r.profit} zł</td>
                            </tr>
                          ))}
                          <tr style={{ background: "var(--cream)", fontWeight: 600 }}>
                            <td colSpan={4}>Łącznie</td>
                            <td style={{ color: "var(--sage-dark)" }}>{rd.totalRevenue} zł</td>
                            <td style={{ color: "var(--clay)" }}>{rd.totalCosts} zł</td>
                            <td style={{ color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{rd.totalProfit} zł</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {/* PER ZAJĘCIA */}
            {reportView === "classes" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Szczegóły zajęć — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.classReports.length === 0 ? <div className="empty-state"><div className="empty-icon">🗓</div><p>Brak zajęć w tym miesiącu</p></div>
                  : rd.classReports.map((r, i) => (
                    <div key={i} className="card" style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1.2rem" }}>{r.cls.name}</h3>
                          <p style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{formatDate(r.cls.starts_at)} o {formatTime(r.cls.starts_at)} · {r.cls.duration_min} min</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.4rem", fontWeight: 600, color: r.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{r.profit} zł</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>dochód netto</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                        {[
                          { label: "Uczestnicy", val: `${r.bookings.length}/${r.cls.max_spots}` },
                          { label: "Obłożenie", val: `${r.occupancy}%` },
                          { label: "Gotówka", val: r.cashBookings.length },
                          { label: "Wejścia", val: r.entriesBookings.length },
                          { label: "Przychód", val: `${r.revenue} zł` },
                          { label: "Koszt sali", val: r.venueCost > 0 ? `${r.venueCost} zł` : "—" },
                        ].map((s, j) => (
                          <div key={j} style={{ background: "var(--cream)", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                            <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                            <div style={{ fontSize: "1rem", fontWeight: 500 }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                      {r.bookings.length > 0 && (
                        <div>
                          <p style={{ fontSize: "0.78rem", color: "var(--mid)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Uczestnicy</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {r.bookings.map(b => (
                              <span key={b.id} className="participant-chip">
                                {b.profiles?.first_name} {b.profiles?.last_name} {b.payment_method === "entries" ? "🎫" : "💵"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}

            {/* PER KLIENT */}
            {reportView === "clients" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Aktywność klientów — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.clientReports.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak danych</p></div>
                  : (
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Gotówka</th><th>Wejścia</th><th>Wydano</th><th>Przepadłe wejścia</th></tr></thead>
                        <tbody>
                          {rd.clientReports.sort((a, b) => b.spent - a.spent).map((c, i) => (
                            <tr key={i}>
                              <td><strong>{c.profile.first_name} {c.profile.last_name}</strong></td>
                              <td>{c.bookings.length}</td>
                              <td>{c.cashCount > 0 ? `💵 ${c.cashCount}` : "—"}</td>
                              <td>{c.entriesCount > 0 ? `🎫 ${c.entriesCount}` : "—"}</td>
                              <td style={{ fontWeight: 500, color: "var(--sage-dark)" }}>{c.spent > 0 ? `${c.spent} zł` : "—"}</td>
                              <td style={{ color: c.lost > 0 ? "var(--clay)" : "var(--light)" }}>{c.lost > 0 ? `⚠️ ${c.lost}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </>
            )}

            {/* WEJŚCIA */}
            {reportView === "entries" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Wejścia i przepadki — {monthName(reportMonth)} {reportYear}</h3></div>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card">
                    <div className="stat-value">{rd.clientReports.reduce((s, c) => s + c.entriesCount, 0)}</div>
                    <div className="stat-label">Użytych wejść</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: rd.lostEntries.length > 0 ? "var(--clay)" : "var(--light)" }}>{rd.lostEntries.length}</div>
                    <div className="stat-label">Przepadłych wejść</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{rd.clientReports.reduce((s, c) => s + c.cashCount, 0)}</div>
                    <div className="stat-label">Płatności gotówkowych</div>
                  </div>
                </div>
                {rd.lostEntries.length > 0 && (
                  <>
                    <div className="section-header" style={{ marginBottom: "0.75rem" }}><h3 style={{ fontSize: "1rem", color: "var(--clay)" }}>⚠️ Przepadłe wejścia</h3></div>
                    <div className="table-wrapper" style={{ marginBottom: "1.5rem" }}>
                      <table>
                        <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Data</th><th>Notatka</th></tr></thead>
                        <tbody>
                          {rd.lostEntries.map((h, i) => (
                            <tr key={i}>
                              <td><strong>{h.profiles?.first_name} {h.profiles?.last_name}</strong></td>
                              <td>{h.classes?.name || "—"}</td>
                              <td>{h.classes?.starts_at ? formatDate(h.classes.starts_at) : "—"}</td>
                              <td style={{ color: "var(--clay)", fontSize: "0.85rem" }}>{h.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div className="section-header" style={{ marginBottom: "0.75rem" }}><h3 style={{ fontSize: "1rem" }}>Historia wejść per klientka</h3></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Klientka</th><th>Użytych wejść</th><th>Gotówka</th><th>Przepadłe</th></tr></thead>
                    <tbody>
                      {rd.clientReports.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.profile.first_name} {c.profile.last_name}</strong></td>
                          <td>{c.entriesCount}</td>
                          <td>{c.cashCount}</td>
                          <td style={{ color: c.lost > 0 ? "var(--clay)" : "var(--light)" }}>{c.lost > 0 ? c.lost : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* DO ROZLICZENIA */}
        {tab === "settle" && (
          <>
            <div className="page-header"><h2>Do rozliczenia</h2><p>Zajęcia po których nie zużyto wejścia ani nie rozliczono</p></div>
            {toSettle.length === 0 ? <div className="empty-state"><div className="empty-icon">✅</div><p>Wszystko rozliczone!</p></div>
              : (
                <>
                  <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                    <div className="stat-card"><div className="stat-value">{toSettle.length}</div><div className="stat-label">Nierozliczonych</div></div>
                    {totalOwed > 0 && <div className="stat-card"><div className="stat-value" style={{ color: "var(--clay)" }}>{totalOwed} zł</div><div className="stat-label">Łącznie do zapłaty</div></div>}
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Data</th><th>Metoda</th><th>Cena</th><th>Akcja</th></tr></thead>
                      <tbody>
                        {toSettle.map(b => (
                          <tr key={b.id}>
                            <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                            <td>{b.classes?.name}</td>
                            <td>{b.classes?.starts_at ? formatDate(b.classes.starts_at) : "—"}</td>
                            <td>{b.payment_method === "entries" ? "🎫 wejście" : "💵 gotówka"}</td>
                            <td>{b.classes?.price_pln ? <strong style={{ color: "var(--clay)" }}>{b.classes.price_pln} zł</strong> : "—"}</td>
                            <td><button className="btn btn-primary btn-sm" onClick={() => handleSettleNow(b.user_id, b.class_id, b.classes?.name, b.classes?.starts_at)}>✓ Rozlicz</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </>
        )}

        {/* UCZESTNICY */}
        {tab === "participants" && selectedClass && (
          <>
            <div className="page-header"><h2>{selectedClass.name}</h2><p>{formatDate(selectedClass.starts_at)} o {formatTime(selectedClass.starts_at)}{selectedClass.price_pln ? ` · ${selectedClass.price_pln} zł/os.` : ""}{selectedClass.venue_cost_pln ? ` · sala: ${selectedClass.venue_cost_pln} zł` : ""}</p></div>
            <div className="section-header">
              <h3>Lista uczestników ({participants.length} / {selectedClass.max_spots})</h3>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddUserModal(true)}>+ Dodaj uczestnika</button>
                <button className="btn btn-secondary" onClick={() => setTab("classes")}>← Wróć</button>
              </div>
            </div>
            {participants.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Nikt się nie zapisał</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>Imię i nazwisko</th><th>Email</th><th>Metoda płatności</th><th>Data zapisu</th><th>Akcja</th></tr></thead>
                    <tbody>
                      {participants.map((b, i) => {
                        const isSettled = settled.has(`${b.user_id}_${b.class_id || selectedClass.id}`);
                        const isPast = new Date(selectedClass.starts_at) < new Date();
                        return (
                          <tr key={b.id}>
                            <td>{i + 1}</td>
                            <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                            <td>{b.profiles?.email}</td>
                            <td>{b.payment_method === "entries" ? "🎫 wejście" : "💵 gotówka"}</td>
                            <td>{new Date(b.created_at).toLocaleDateString("pl-PL")}</td>
                            <td style={{ display: "flex", gap: "0.5rem" }}>
                              {isPast && !isSettled && b.payment_method !== "entries" && (
                                <button className="btn btn-secondary btn-sm" onClick={() => handleUseToken(b.user_id, selectedClass.id, selectedClass.name)}>🎫 Zużyj</button>
                              )}
                              {isSettled && <span style={{ color: "var(--sage-dark)", fontSize: "0.8rem" }}>✅ Ok</span>}
                              <button className="btn btn-danger btn-sm" onClick={() => handleRemoveParticipant(b.id)}>Usuń</button>
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

        {/* POWIADOMIENIA */}
        {tab === "notifications" && (
          <>
            <div className="page-header"><h2>Powiadomienia</h2></div>
            {notifications.length === 0 ? <div className="empty-state"><div className="empty-icon">🔔</div><p>Brak powiadomień</p></div>
              : <div className="table-wrapper"><table><thead><tr><th>Typ</th><th>Wiadomość</th><th>Kiedy</th></tr></thead><tbody>
                {notifications.map(n => (
                  <tr key={n.id} style={{ background: n.read ? "transparent" : "rgba(138,158,133,0.06)" }}>
                    <td style={{ fontSize: "1.2rem" }}>{notifIcon(n.type)}</td>
                    <td style={{ fontWeight: n.read ? 400 : 500 }}>{n.message}</td>
                    <td style={{ color: "var(--mid)", whiteSpace: "nowrap" }}>{formatRelative(n.created_at)}</td>
                  </tr>
                ))}</tbody></table></div>}
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
              : <div className="table-wrapper"><table>
                <thead><tr><th>Nazwa</th><th>Data</th><th>Godz.</th><th>Cena</th><th>Sala</th><th>Uczestnicy</th></tr></thead>
                <tbody>{pastClasses.map(cls => {
                  const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
                  return (
                    <tr key={cls.id}>
                      <td><strong>{cls.name}</strong></td>
                      <td>{formatDate(cls.starts_at)}</td>
                      <td>{formatTime(cls.starts_at)}</td>
                      <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
                      <td>{cls.venue_cost_pln ? <span style={{ color: "var(--clay)" }}>{cls.venue_cost_pln} zł</span> : "—"}</td>
                      <td>{bookingsForClass.length > 0 ? bookingsForClass.map(b => <span key={b.id} className="participant-chip">{b.profiles?.first_name} {b.profiles?.last_name}</span>) : <span style={{ color: "var(--light)", fontSize: "0.8rem" }}>brak</span>}</td>
                    </tr>
                  );
                })}</tbody></table></div>}
          </>
        )}

        {/* KLIENCI */}
        {tab === "clients" && (
          <>
            <div className="page-header"><h2>Klienci</h2></div>
            {allProfiles.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak klientów</p></div>
              : <div className="table-wrapper"><table>
                <thead><tr><th>Imię i nazwisko</th><th>Email</th><th>Rezerwacje</th><th>Wejścia ({monthName(currentMonth)})</th><th>Akcje</th></tr></thead>
                <tbody>{allProfiles.map((c, i) => {
                  const clientBookings = allBookings.filter(b => b.user_id === c.id);
                  return (
                    <tr key={i}>
                      <td><strong>{c.first_name} {c.last_name}</strong></td>
                      <td>{c.email}</td>
                      <td>{clientBookings.length}</td>
                      <td><TokenBadge userId={c.id} month={currentMonth} year={currentYear} /></td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => openUserTokens(c)}>🎫 Wejścia</button></td>
                    </tr>
                  );
                })}</tbody></table></div>}
          </>
        )}
      </main>

      {/* Mobile nav */}
      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}><span className="mobile-nav-icon">🗓</span><span>Zajęcia</span></div>
        <div className={`mobile-nav-item ${tab === "settle" ? "active" : ""}`} onClick={() => setTab("settle")}>
          <span className="mobile-nav-icon" style={{ position: "relative" }}>💰{toSettle.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--clay)", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{toSettle.length}</span>}</span>
          <span>Rozlicz</span>
        </div>
        <div className={`mobile-nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}><span className="mobile-nav-icon">📈</span><span>Raporty</span></div>
        <div className={`mobile-nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}><span className="mobile-nav-icon">👥</span><span>Klienci</span></div>
      </nav>

      {/* MODAL - Zajęcia */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editClass ? "Edytuj zajęcia" : "Nowe zajęcia"}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            <div className="form-group"><label className="form-label">Nazwa zajęć</label><input className="form-input" placeholder="np. Pilates Flow" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Data i godzina</label><input className="form-input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Czas (min)</label><input className="form-input" type="number" min="15" max="180" step="15" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Maks. miejsc</label><input className="form-input" type="number" min="1" max="50" value={form.max_spots} onChange={e => setForm({ ...form, max_spots: +e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Cena za zajęcia (zł)</label><input className="form-input" type="number" min="0" placeholder="np. 60" value={form.price_pln} onChange={e => setForm({ ...form, price_pln: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Koszt wynajmu sali (zł)</label><input className="form-input" type="number" min="0" placeholder="np. 100" value={form.venue_cost_pln} onChange={e => setForm({ ...form, venue_cost_pln: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Lokalizacja</label><input className="form-input" placeholder="np. Sala A" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Notatki dla klientek</label><input className="form-input" placeholder="np. Przynieś matę, zajęcia dla zaawansowanych" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.starts_at}>{editClass ? "Zapisz zmiany" : "Utwórz zajęcia"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Wejścia */}
      {showTokenModal && selectedUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTokenModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3>🎫 Wejścia — {selectedUser.first_name} {selectedUser.last_name}</h3><button className="modal-close" onClick={() => setShowTokenModal(false)}>×</button></div>
            <div style={{ marginBottom: "1.5rem" }}>
              <p className="form-label" style={{ marginBottom: "0.75rem" }}>Saldo wejść</p>
              {userTokens.length === 0 ? <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Brak wejść</p>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {userTokens.map(t => (
                    <div key={t.id} style={{ background: t.amount > 0 ? "#EBF5EA" : "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "1.4rem", fontFamily: "Cormorant Garamond, serif", color: t.amount > 0 ? "var(--sage-dark)" : "var(--light)" }}>{t.amount}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase" }}>{monthName(t.month)} {t.year}</div>
                    </div>
                  ))}
                </div>}
            </div>
            <p className="form-label" style={{ marginBottom: "0.75rem" }}>Dodaj wejścia</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Liczba</label><input className="form-input" type="number" min="1" max="30" value={tokenForm.amount} onChange={e => setTokenForm({ ...tokenForm, amount: +e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Miesiąc</label><select className="form-input" value={tokenForm.month} onChange={e => setTokenForm({ ...tokenForm, month: +e.target.value })}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{monthName(m)}</option>)}</select></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Rok</label><input className="form-input" type="number" min="2024" max="2030" value={tokenForm.year} onChange={e => setTokenForm({ ...tokenForm, year: +e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Notatka</label><input className="form-input" placeholder="np. Gotówka 14.04, karnet 10 wejść" value={tokenForm.note} onChange={e => setTokenForm({ ...tokenForm, note: e.target.value })} /></div>
            <button className="btn btn-primary btn-full" onClick={handleAddTokens}>+ Dodaj {tokenForm.amount} {tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść"} na {monthName(tokenForm.month)}</button>
            {userTokenHistory.length > 0 && (
              <>
                <p className="form-label" style={{ margin: "1.5rem 0 0.75rem" }}>Historia</p>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  {userTokenHistory.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem" }}>
                      <span style={{ color: h.amount > 0 ? "var(--sage-dark)" : "var(--clay)" }}>{h.amount > 0 ? "+" : ""}{h.amount} · {h.note || h.classes?.name || "—"}</span>
                      <span style={{ color: "var(--light)" }}>{monthName(h.month)} {h.year}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL - Dodaj uczestnika */}
      {showAddUserModal && selectedClass && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddUserModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>Dodaj uczestnika</h3><button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button></div>
            <p style={{ color: "var(--mid)", fontSize: "0.875rem", marginBottom: "1rem" }}>Zapisz klientkę na: <strong>{selectedClass.name}</strong></p>
            {notEnrolled.length === 0 ? <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>Wszystkie klientki są już zapisane.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 300, overflowY: "auto" }}>
                {notEnrolled.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <div><div style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</div><div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{u.email}</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddUserToClass(u.id, selectedClass.id)}>Zapisz</button>
                  </div>
                ))}
              </div>}
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Zamknij</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenBadge({ userId, month, year }) {
  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    supabase.from("tokens").select("amount").eq("user_id", userId).eq("month", month).eq("year", year).single()
      .then(({ data }) => setTokens(data?.amount ?? 0));
  }, [userId, month, year]);
  if (tokens === null) return <span style={{ color: "var(--light)" }}>—</span>;
  return <span style={{ fontWeight: 500, color: tokens > 0 ? "var(--sage-dark)" : "var(--light)" }}>🎫 {tokens}</span>;
}
