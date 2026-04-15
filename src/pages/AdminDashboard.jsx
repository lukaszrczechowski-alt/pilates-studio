import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { sendEmail, formatEmailDate, formatEmailTime, monthNamePL } from "../emailService";

export default function AdminDashboard({ session, profile, darkMode, setDarkMode }) {
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
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(null);
  const [editClass, setEditClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [userTokens, setUserTokens] = useState([]);
  const [userTokenHistory, setUserTokenHistory] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState({ totalClasses: 0, totalBookings: 0, uniqueClients: 0 });
  const [form, setForm] = useState({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
  const [recurring, setRecurring] = useState({ enabled: false, weeks: 4 });
  const [tokenForm, setTokenForm] = useState({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [messageText, setMessageText] = useState("");
  const [message, setMessage] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportView, setReportView] = useState("summary");
  const [clientSearch, setClientSearch] = useState("");
  const [editingNotes, setEditingNotes] = useState(null); // userId
  const [notesText, setNotesText] = useState("");
  const [adminCalendarWeek, setAdminCalendarWeek] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });


  useEffect(() => { fetchAll(); }, []);

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function fetchAll() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase.from("classes")
      .select("*, bookings(*, profiles(first_name, last_name, email)), waitlist(*)")
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
      totalClasses: (classData || []).filter(c => c.starts_at >= now && !c.cancelled).length,
      totalBookings: (bookingData || []).filter(b => b.classes?.starts_at >= now).length,
      uniqueClients: (profileData || []).length,
    });
    const { data: templatesData } = await supabase.from("class_templates").select("*").order("name");
    setTemplates(templatesData || []);
    setLoading(false);
  }

  async function fetchParticipants(classId) {
    const { data } = await supabase.from("bookings")
      .select("id, created_at, user_id, payment_method, profiles(first_name, last_name, email)")
      .eq("class_id", classId);
    setParticipants(data || []);

    // Pobierz obecności
    const { data: attData } = await supabase.from("attendance")
      .select("*").eq("class_id", classId);
    const attMap = {};
    (attData || []).forEach(a => { attMap[a.user_id] = a.status; });
    setAttendance(attMap);
  }

  async function fetchUserTokens(userId) {
    const { data } = await supabase.from("tokens").select("*").eq("user_id", userId)
      .order("year", { ascending: false }).order("month", { ascending: false });
    const { data: hist } = await supabase.from("token_history").select("*, classes(name)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setUserTokens(data || []);
    setUserTokenHistory(hist || []);
  }

  async function markAttendance(classId, userId, status) {
    const existing = attendance[userId];
    if (existing) {
      if (existing === status) {
        // Usuń oznaczenie
        await supabase.from("attendance").delete().eq("class_id", classId).eq("user_id", userId);
        setAttendance(prev => { const n = { ...prev }; delete n[userId]; return n; });
      } else {
        await supabase.from("attendance").update({ status }).eq("class_id", classId).eq("user_id", userId);
        setAttendance(prev => ({ ...prev, [userId]: status }));
      }
    } else {
      await supabase.from("attendance").insert({ class_id: classId, user_id: userId, status });
      setAttendance(prev => ({ ...prev, [userId]: status }));
    }
  }

  async function handleCancelClass(cls) {
    if (!cancelReason.trim()) { showMsg("Podaj powód odwołania.", "error"); return; }

    // Oznacz jako odwołane
    await supabase.from("classes").update({ cancelled: true, cancel_reason: cancelReason }).eq("id", cls.id);

    // Zwróć wejścia wszystkim zapisanym z metodą "entries"
    const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
    for (const booking of bookingsForClass) {
      if (booking.payment_method === "entries") {
        const month = new Date(cls.starts_at).getMonth() + 1;
        const year = new Date(cls.starts_at).getFullYear();
        const { data: tok } = await supabase.from("tokens").select("*")
          .eq("user_id", booking.user_id).eq("month", month).eq("year", year).single();
        if (tok) {
          await supabase.from("tokens").update({ amount: tok.amount + 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
          await supabase.from("token_history").insert({
            user_id: booking.user_id, class_id: cls.id, operation: "add", amount: 1,
            month, year, note: `Zwrot — zajęcia odwołane: ${cls.name}`,
          });
        }
      }

      // Powiadomienie w aplikacji
      await supabase.from("notifications").insert({
        type: "class_cancelled", class_id: cls.id, user_id: booking.user_id,
        message: `Zajęcia "${cls.name}" (${formatEmailDate(cls.starts_at)}) zostały odwołane. Powód: ${cancelReason}${booking.payment_method === "entries" ? " Wejście zwrócono." : ""}`,
      });

      // Email
      await sendEmail("class_cancelled", booking.profiles?.email, {
        firstName: booking.profiles?.first_name,
        className: cls.name,
        date: formatEmailDate(cls.starts_at),
        time: formatEmailTime(cls.starts_at),
        reason: cancelReason,
        refunded: booking.payment_method === "entries",
      });
    }

    setShowCancelModal(null);
    setCancelReason("");
    showMsg(`Zajęcia odwołane. Powiadomiono ${bookingsForClass.length} uczestniczek.`);
    await fetchAll();
  }

  async function handleSendMessage(cls) {
    if (!messageText.trim()) { showMsg("Wpisz wiadomość.", "error"); return; }
    const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);

    // Zapisz wiadomość
    await supabase.from("class_messages").insert({
      class_id: cls.id, message: messageText, sent_by: session.user.id,
    });

    // Powiadomienie w aplikacji dla każdego uczestnika
    for (const booking of bookingsForClass) {
      await supabase.from("notifications").insert({
        type: "booking", class_id: cls.id, user_id: booking.user_id,
        message: `📢 Wiadomość dot. zajęć "${cls.name}": ${messageText}`,
      });
    }

    setShowMessageModal(null);
    setMessageText("");
    showMsg(`Wiadomość wysłana do ${bookingsForClass.length} uczestniczek!`);
    await fetchAll();
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function openCreate() {
    setEditClass(null);
    setForm({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
    setRecurring({ enabled: false, weeks: 4 });
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
    const basePayload = {
      name: form.name, starts_at: new Date(form.starts_at).toISOString(),
      duration_min: +form.duration_min, max_spots: +form.max_spots,
      location: form.location, notes: form.notes,
      price_pln: form.price_pln ? +form.price_pln : null,
      venue_cost_pln: form.venue_cost_pln ? +form.venue_cost_pln : null,
    };

    if (editClass) {
      await supabase.from("classes").update(basePayload).eq("id", editClass.id);
    } else if (recurring.enabled && recurring.weeks > 1) {
      // Utwórz serię zajęć
      const seriesId = crypto.randomUUID();
      const classesToInsert = [];
      for (let i = 0; i < recurring.weeks; i++) {
        const starts = new Date(form.starts_at);
        starts.setDate(starts.getDate() + i * 7);
        classesToInsert.push({ ...basePayload, starts_at: starts.toISOString(), series_id: seriesId, series_index: i + 1 });
      }
      await supabase.from("classes").insert(classesToInsert);
      showMsg(`Utworzono ${recurring.weeks} zajęć cyklicznych! ✓`);
    } else {
      await supabase.from("classes").insert(basePayload);
    }

    setShowModal(false);
    await fetchAll();
  }

  async function handleSaveTemplate() {
    if (!templateForm.name) return;
    await supabase.from("class_templates").insert({
      name: templateForm.name,
      duration_min: +templateForm.duration_min,
      max_spots: +templateForm.max_spots,
      location: templateForm.location,
      notes: templateForm.notes,
      price_pln: templateForm.price_pln ? +templateForm.price_pln : null,
      venue_cost_pln: templateForm.venue_cost_pln ? +templateForm.venue_cost_pln : null,
    });
    setShowTemplateModal(false);
    setTemplateForm({ name: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
    showMsg("Szablon zapisany! ✓");
    const { data } = await supabase.from("class_templates").select("*").order("name");
    setTemplates(data || []);
  }

  async function handleDeleteTemplate(id) {
    await supabase.from("class_templates").delete().eq("id", id);
    const { data } = await supabase.from("class_templates").select("*").order("name");
    setTemplates(data || []);
  }

  function applyTemplate(template) {
    setForm(prev => ({
      ...prev,
      name: template.name,
      duration_min: template.duration_min,
      max_spots: template.max_spots,
      location: template.location || "",
      notes: template.notes || "",
      price_pln: template.price_pln || "",
      venue_cost_pln: template.venue_cost_pln || "",
    }));
    showMsg(`Szablon "${template.name}" wczytany!`);
  }

  // Eksport listy obecności do PDF (print)
  function printAttendanceList(cls, participants) {
    const win = window.open('', '_blank');
    const date = new Date(cls.starts_at).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const time = new Date(cls.starts_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    const rows = participants.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.profiles?.first_name || ""} ${p.profiles?.last_name || ""}</td>
        <td>${p.payment_method === "entries" ? "Karnet" : "Gotówka"}</td>
        <td style="width:120px;border-bottom:1px solid #ccc;"></td>
      </tr>
    `).join("");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Lista obecności — ${cls.name}</title>
        <style>
          body { font-family: Georgia, serif; padding: 2rem; color: #2C2C2C; }
          h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
          .meta { color: #6B6B6B; font-size: 0.9rem; margin-bottom: 2rem; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 0.5rem 1rem; background: #F7F3EE; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #E8E0D8; }
          td { padding: 0.75rem 1rem; border-bottom: 1px solid #E8E0D8; font-size: 0.9rem; }
          .footer { margin-top: 3rem; font-size: 0.8rem; color: #ADADAD; text-align: center; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>${cls.name}</h1>
        <div class="meta">${date} · ${time} · ${cls.duration_min} min${cls.location ? " · " + cls.location : ""}</div>
        <table>
          <thead><tr><th>#</th><th>Imię i nazwisko</th><th>Płatność</th><th>Podpis</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Pilates Studio by Paulina · paulapilates.pl · Wygenerowano: ${new Date().toLocaleDateString("pl-PL")}</div>
        <br/>
        <button onclick="window.print()">🖨️ Drukuj</button>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
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
    if (error) { showMsg("Użytkownik już jest zapisany.", "error"); return; }
    showMsg("Zapisano! ✓");
    const cls = classes.find(c => c.id === classId);
    const { data: userProfile } = await supabase.from("profiles").select("email, first_name").eq("id", userId).single();
    if (userProfile && cls) {
      await sendEmail("booking_confirmed", userProfile.email, {
        firstName: userProfile.first_name, className: cls.name,
        date: formatEmailDate(cls.starts_at), time: formatEmailTime(cls.starts_at),
        duration: cls.duration_min, location: cls.location || "", notes: cls.notes || "", paymentMethod: "cash",
      });
    }
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
      .eq("user_id", selectedUser.id).eq("month", tokenForm.month).eq("year", tokenForm.year).maybeSingle();
    if (existing) {
      await supabase.from("tokens").update({ amount: existing.amount + tokenForm.amount, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tokens").insert({ user_id: selectedUser.id, amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, added_by: session.user.id, note: tokenForm.note });
    }
    await supabase.from("token_history").insert({ user_id: selectedUser.id, operation: "add", amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, note: tokenForm.note || "Dodano przez admina" });
    const entryWord = tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść";
    await supabase.from("notifications").insert({ type: "tokens_added", user_id: selectedUser.id, message: `Dodano ${tokenForm.amount} ${entryWord} dla ${selectedUser.first_name} ${selectedUser.last_name} na ${monthName(tokenForm.month)} ${tokenForm.year}` });
    const { data: userProfile } = await supabase.from("profiles").select("email, first_name").eq("id", selectedUser.id).single();
    if (userProfile) {
      await sendEmail("entries_added", userProfile.email, {
        firstName: userProfile.first_name, amount: tokenForm.amount,
        month: monthName(tokenForm.month) + " " + tokenForm.year, note: tokenForm.note || "",
      });
    }
    const eWord = tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść";
    showMsg(`Dodano ${tokenForm.amount} ${eWord} dla ${selectedUser.first_name}! ✓`);
    await fetchUserTokens(selectedUser.id);
    await fetchAll();
  }

  async function handleUseToken(userId, classId, className) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { data: tok } = await supabase.from("tokens").select("*").eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle();
    if (!tok || tok.amount <= 0) { showMsg("Brak wejść.", "error"); return; }
    await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
    await supabase.from("token_history").insert({ user_id: userId, class_id: classId, operation: "use", amount: -1, month, year, note: `Zużyto za: ${className}` });
    showMsg("Wejście zużyte! ✓");
    await fetchAll();
  }

  async function handleSettleNow(userId, classId, className, startsAt) {
    const d = new Date(startsAt);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const { data: existing } = await supabase.from("tokens").select("*")
      .eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle();

    if (existing && existing.amount > 0) {
      // Odejmij wejście jeśli jest saldo
      await supabase.from("tokens")
        .update({ amount: existing.amount - 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else if (!existing) {
      // Utwórz rekord z 0 (zaznaczamy że rozliczono bez wejść — gotówka)
      await supabase.from("tokens").insert({ user_id: userId, amount: 0, month, year, added_by: session.user.id });
    }
    // Zawsze zapisz log rozliczenia
    await supabase.from("token_history").insert({
      user_id: userId, class_id: classId, operation: "use", amount: -1,
      month, year, note: `Rozliczono za: ${className}`,
    });
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

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async function saveNotes(userId) {
    await supabase.from("profiles").update({ admin_notes: notesText }).eq("id", userId);
    setAllProfiles(prev => prev.map(p => p.id === userId ? { ...p, admin_notes: notesText } : p));
    setEditingNotes(null);
    showMsg("Notatka zapisana! ✓");
  }

  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date() && !c.cancelled);
  const cancelledClasses = classes.filter(c => c.cancelled);
  const pastClasses = classes.filter(c => new Date(c.starts_at) < new Date() && !c.cancelled);

  const settled = new Set(tokenHistory.filter(h => h.operation === "use" && !h.note?.includes("przepadło")).map(h => `${h.user_id}_${h.class_id}`));
  const toSettle = allBookings.filter(b => new Date(b.classes?.starts_at) < new Date() && !settled.has(`${b.user_id}_${b.class_id}`));
  const totalOwed = toSettle.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);

  const dayStats = [0,1,2,3,4,5,6].map(day => ({ name: ["Nd","Pn","Wt","Śr","Cz","Pt","So"][day], count: allBookings.filter(b => new Date(b.classes?.starts_at).getDay() === day).length }));
  const maxDay = Math.max(...dayStats.map(d => d.count), 1);
  const hourStats = {};
  allBookings.forEach(b => { const h = new Date(b.classes?.starts_at).getHours(); hourStats[h] = (hourStats[h] || 0) + 1; });
  const topHours = Object.entries(hourStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const notifIcon = (type) => ({ booking: "✅", cancel: "❌", waitlist_promoted: "⬆️", tokens_added: "🎫", class_cancelled: "🚫" }[type] || "🔔");
  const notEnrolled = selectedClass ? allProfiles.filter(p => !participants.some(part => part.user_id === p.id)) : [];

  // Raport
  function getReportData() {
    const monthClasses = classes.filter(c => { const d = new Date(c.starts_at); return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const monthBookings = allBookings.filter(b => { const d = new Date(b.classes?.starts_at); return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const pastMonthClasses = monthClasses.filter(c => new Date(c.starts_at) < new Date() && !c.cancelled);
    const classReports = pastMonthClasses.map(cls => {
      const bookings = monthBookings.filter(b => b.class_id === cls.id);
      const revenue = (cls.price_pln || 0) * bookings.length;
      const venueCost = cls.venue_cost_pln || 0;
      const profit = revenue - venueCost;
      const occupancy = cls.max_spots > 0 ? Math.round((bookings.length / cls.max_spots) * 100) : 0;
      return { cls, bookings, entriesBookings: bookings.filter(b => b.payment_method === "entries"), cashBookings: bookings.filter(b => b.payment_method === "cash"), revenue, venueCost, profit, occupancy };
    });
    const lostEntries = tokenHistory.filter(h => { const d = new Date(h.created_at); return h.operation === "use" && h.note?.includes("przepadło") && d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const clientReports = allProfiles.map(p => {
      const bookings = monthBookings.filter(b => b.user_id === p.id);
      const spent = bookings.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);
      const lost = lostEntries.filter(h => h.user_id === p.id).length;
      return { profile: p, bookings, entriesCount: bookings.filter(b => b.payment_method === "entries").length, cashCount: bookings.filter(b => b.payment_method === "cash").length, spent, lost };
    }).filter(c => c.bookings.length > 0);
    return {
      classReports, clientReports, lostEntries,
      totalRevenue: classReports.reduce((s, r) => s + r.revenue, 0),
      totalCosts: classReports.reduce((s, r) => s + r.venueCost, 0),
      totalProfit: classReports.reduce((s, r) => s + r.profit, 0),
      totalBookings: monthBookings.length,
      avgOccupancy: classReports.length > 0 ? Math.round(classReports.reduce((s, r) => s + r.occupancy, 0) / classReports.length) : 0,
    };
  }

  const rd = getReportData();

  const statusStyle = (s) => ({
    present: { bg: "#EBF5EA", color: "#5C7A56", label: "✅ Był/a" },
    absent: { bg: "#FDE8E8", color: "#C44B4B", label: "❌ Nie był/a" },
    late: { bg: "#FEF3E8", color: "#B87333", label: "⏰ Spóźniony/a" },
  }[s] || { bg: "var(--cream)", color: "var(--mid)", label: "— Brak" });

  return (
    <div className="app-layout">
      <style>{`@media print { .sidebar,.mobile-nav,.no-print{display:none!important} .main-content{margin-left:0!important;padding:0!important} .print-header{display:block!important} } .print-header{display:none}`}</style>

      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => setTab("classes")} style={{ cursor: "pointer" }}>
          <h1>Pilates</h1>
          <p>Panel admina</p>
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}><span className="nav-icon">🗓</span> Zajęcia</div>
          <div className={`nav-item ${tab === "admin_calendar" ? "active" : ""}`} onClick={() => setTab("admin_calendar")}><span className="nav-icon">📅</span> Kalendarz</div>
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
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ marginTop: "0.5rem", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.75rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.8rem", width: "100%" }}>
            {darkMode ? "☀️ Tryb jasny" : "🌙 Tryb ciemny"}
          </button>
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
                <div className="table-wrapper" style={{ marginBottom: "2rem" }}>
                  <table>
                    <thead><tr><th>Nazwa</th><th>Data</th><th>Godz.</th><th>Cena</th><th>Sala</th><th>Miejsca</th><th>Uczestnicy</th><th>Akcje</th></tr></thead>
                    <tbody>
                      {upcomingClasses.map(cls => {
                        const count = cls.bookings?.length || 0;
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong>{cls.series_id && <span style={{ fontSize: "0.7rem", background: "#EBF5EA", color: "var(--sage-dark)", padding: "0.15rem 0.5rem", borderRadius: 20, marginLeft: "0.5rem" }}>🔁 {cls.series_index}</span>}</td>
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
                            <td>{cls.venue_cost_pln ? <span style={{ color: "var(--clay)" }}>{cls.venue_cost_pln} zł</span> : "—"}</td>
                            <td>{count} / {cls.max_spots}</td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openParticipants(cls)}>Lista ({count})</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowMessageModal(cls)} title="Wyślij wiadomość">💬</button>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cls)}>Edytuj</button>
                                <button className="btn btn-danger btn-sm" onClick={() => setShowCancelModal(cls)}>Odwołaj</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cls.id)}>Usuń</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {cancelledClasses.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: "1rem" }}><h3 style={{ color: "var(--clay)" }}>🚫 Odwołane zajęcia</h3></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Nazwa</th><th>Data</th><th>Powód</th></tr></thead>
                    <tbody>
                      {cancelledClasses.map(cls => (
                        <tr key={cls.id} style={{ opacity: 0.6 }}>
                          <td><strong>{cls.name}</strong></td>
                          <td>{formatDate(cls.starts_at)}</td>
                          <td style={{ color: "var(--clay)" }}>{cls.cancel_reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* KALENDARZ ADMINA — MIESIĘCZNY */}
        {tab === "admin_calendar" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div className="page-header" style={{ margin: 0 }}><h2>Kalendarz zajęć</h2><p>Miesięczny przegląd</p></div>
              <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nowe zajęcia</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(adminCalendarWeek); d.setMonth(d.getMonth() - 1); d.setDate(1); setAdminCalendarWeek(d); }}>← Poprzedni</button>
              <span style={{ fontWeight: 500, fontSize: "1.1rem" }}>{adminCalendarWeek.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(adminCalendarWeek); d.setMonth(d.getMonth() + 1); d.setDate(1); setAdminCalendarWeek(d); }}>Następny →</button>
            </div>
            {(() => {
              const year = adminCalendarWeek.getFullYear();
              const month = adminCalendarWeek.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const aDayNames = ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"];
              const isTodayA = d => d.toDateString() === new Date().toDateString();
              let startOffset = firstDay.getDay() - 1;
              if (startOffset < 0) startOffset = 6;
              const cells = [];
              for (let i = 0; i < startOffset; i++) cells.push(null);
              for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
              while (cells.length % 7 !== 0) cells.push(null);
              const mBookings = allBookings.filter(b => { const d = new Date(b.classes?.starts_at); return d.getMonth() === month && d.getFullYear() === year; });
              const mRevenue = mBookings.reduce((s, b) => s + (b.classes?.price_pln || 0), 0);
              const mClasses = classes.filter(c => { const d = new Date(c.starts_at); return d.getMonth() === month && d.getFullYear() === year && !c.cancelled; });
              return (
                <>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    {[["Zajęć", mClasses.length],["Rezerwacji", mBookings.length],["Przychód", `${mRevenue} zł`]].map(([label, val], i) => (
                      <div key={i} style={{ background: "var(--warm-white)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--sage-dark)" }}>{val}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--warm-white)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                      {aDayNames.map(d => <div key={d} style={{ padding: "0.6rem 0.25rem", textAlign: "center", background: "var(--cream)", fontSize: "0.75rem", fontWeight: 500, color: "var(--mid)", textTransform: "uppercase" }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                      {cells.map((day, i) => {
                        if (!day) return <div key={i} style={{ minHeight: 90, background: "var(--cream)", opacity: 0.3, borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)" }} />;
                        const today = isTodayA(day);
                        const dayClasses = classes.filter(cls => { const d = new Date(cls.starts_at); return d.toDateString() === day.toDateString() && !cls.cancelled; });
                        return (
                          <div key={i} style={{ minHeight: 90, padding: "0.3rem", borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)", background: today?"rgba(138,158,133,0.06)":"transparent" }}>
                            <div style={{ fontSize: "0.8rem", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: today?"var(--sage)":"transparent", color: today?"white":"var(--charcoal)", marginBottom: "0.2rem", fontWeight: today?600:400 }}>{day.getDate()}</div>
                            {dayClasses.map(cls => {
                              const count = cls.bookings?.length || 0;
                              const pct = Math.round((count / cls.max_spots) * 100);
                              const isFull = count >= cls.max_spots;
                              const bg = isFull?"#FEF3E8":pct>=70?"#EBF5EA":"var(--cream)";
                              const bdr = isFull?"#E8C5B5":pct>=70?"#8A9E85":"var(--border)";
                              const tc = isFull?"var(--clay)":pct>=70?"var(--sage-dark)":"var(--charcoal)";
                              return (
                                <div key={cls.id} onClick={() => openParticipants(cls)}
                                  style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 4, padding: "0.2rem 0.35rem", marginBottom: "0.2rem", cursor: "pointer" }}
                                  onMouseEnter={e => e.currentTarget.style.opacity="0.75"}
                                  onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                                  <div style={{ fontSize: "0.68rem", fontWeight: 500, color: tc, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatTime(cls.starts_at)} · {cls.name}</div>
                                  <div style={{ fontSize: "0.62rem", color: "var(--light)" }}>{count}/{cls.max_spots}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                    {[["var(--cream)","var(--border)","< 70%"],["#EBF5EA","#8A9E85","≥ 70%"],["#FEF3E8","#E8C5B5","Pełne"]].map(([bg,bdr,label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--mid)" }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${bdr}` }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* UCZESTNICY + LISTA OBECNOŚCI */}
        {/* UCZESTNICY + LISTA OBECNOŚCI */}
        {tab === "participants" && selectedClass && (
          <>
            <div className="page-header">
              <h2>{selectedClass.name}</h2>
              <p>{formatDate(selectedClass.starts_at)} o {formatTime(selectedClass.starts_at)}</p>
            </div>
            <div className="section-header">
              <h3>Lista uczestników ({participants.length} / {selectedClass.max_spots})</h3>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowMessageModal(selectedClass)}>💬 Wiadomość</button>
                <button className="btn btn-secondary btn-sm" onClick={() => printAttendanceList(selectedClass, participants)}>🖨️ Lista PDF</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddUserModal(true)}>+ Dodaj</button>
                <button className="btn btn-secondary" onClick={() => setTab("classes")}>← Wróć</button>
              </div>
            </div>

            {/* Legenda obecności */}
            {new Date(selectedClass.starts_at) < new Date() && (
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--mid)" }}>Oznacz obecność:</span>
                {["present","absent","late"].map(s => {
                  const st = statusStyle(s);
                  return <span key={s} style={{ fontSize: "0.8rem", background: st.bg, color: st.color, padding: "0.2rem 0.6rem", borderRadius: 20 }}>{st.label}</span>;
                })}
              </div>
            )}

            {participants.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Nikt się nie zapisał</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>Imię i nazwisko</th><th>Email</th><th>Płatność</th>
                      {new Date(selectedClass.starts_at) < new Date() && <th>Obecność</th>}
                      <th>Akcja</th></tr></thead>
                    <tbody>
                      {participants.map((b, i) => {
                        const attStatus = attendance[b.user_id];
                        const isPast = new Date(selectedClass.starts_at) < new Date();
                        const st = statusStyle(attStatus);
                        return (
                          <tr key={b.id}>
                            <td>{i + 1}</td>
                            <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                            <td style={{ fontSize: "0.85rem" }}>{b.profiles?.email}</td>
                            <td>{b.payment_method === "entries" ? "🎫" : "💵"}</td>
                            {isPast && (
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                  {["present","absent","late"].map(s => {
                                    const ss = statusStyle(s);
                                    const isActive = attStatus === s;
                                    return (
                                      <button key={s} onClick={() => markAttendance(selectedClass.id, b.user_id, s)}
                                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", border: `1px solid ${isActive ? ss.color : "var(--border)"}`, borderRadius: 6, background: isActive ? ss.bg : "transparent", color: isActive ? ss.color : "var(--mid)", cursor: "pointer", transition: "all 0.15s" }}>
                                        {ss.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            )}
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                {isPast && b.payment_method !== "entries" && !settled.has(`${b.user_id}_${selectedClass.id}`) && (
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleUseToken(b.user_id, selectedClass.id, selectedClass.name)}>🎫</button>
                                )}
                                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveParticipant(b.id)}>Usuń</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            {/* Podsumowanie obecności */}
            {new Date(selectedClass.starts_at) < new Date() && Object.keys(attendance).length > 0 && (
              <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {["present","absent","late"].map(s => {
                  const count = Object.values(attendance).filter(a => a === s).length;
                  const st = statusStyle(s);
                  return count > 0 ? (
                    <div key={s} style={{ background: st.bg, color: st.color, borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500 }}>
                      {st.label}: {count}
                    </div>
                  ) : null;
                })}
                <div style={{ background: "var(--cream)", color: "var(--mid)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  Nieoznaczonych: {participants.length - Object.keys(attendance).length}
                </div>
              </div>
            )}
          </>
        )}

        {/* DO ROZLICZENIA */}
        {tab === "settle" && (
          <>
            <div className="page-header"><h2>Do rozliczenia</h2></div>
            {toSettle.length === 0 ? <div className="empty-state"><div className="empty-icon">✅</div><p>Wszystko rozliczone!</p></div>
              : (
                <>
                  <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                    <div className="stat-card"><div className="stat-value">{toSettle.length}</div><div className="stat-label">Nierozliczonych</div></div>
                    {totalOwed > 0 && <div className="stat-card"><div className="stat-value" style={{ color: "var(--clay)" }}>{totalOwed} zł</div><div className="stat-label">Łącznie</div></div>}
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
                            <td>{b.payment_method === "entries" ? "🎫" : "💵"}</td>
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

        {/* RAPORTY */}
        {tab === "reports" && (
          <>
            <div className="print-header" style={{ marginBottom: "1rem" }}>
              <h2>Pilates Studio — Raport {monthName(reportMonth)} {reportYear}</h2>
              <p style={{ color: "#666", fontSize: "0.85rem" }}>Wygenerowano: {new Date().toLocaleDateString("pl-PL")}</p>
            </div>
            <div className="page-header no-print"><h2>Raporty i rozliczenia</h2></div>
            <div className="no-print" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
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
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginLeft: "auto" }}>🖨️ Drukuj</button>
            </div>

            {reportView === "summary" && (
              <>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card"><div className="stat-value" style={{ color: "var(--sage-dark)" }}>{rd.totalRevenue} zł</div><div className="stat-label">Przychód</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: "var(--clay)" }}>{rd.totalCosts} zł</div><div className="stat-label">Koszty sal</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{rd.totalProfit} zł</div><div className="stat-label">Dochód netto</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.totalBookings}</div><div className="stat-label">Rezerwacji</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.avgOccupancy}%</div><div className="stat-label">Obłożenie</div></div>
                </div>
                {rd.classReports.length === 0 ? <div className="empty-state"><div className="empty-icon">📈</div><p>Brak danych za {monthName(reportMonth)} {reportYear}</p></div>
                  : (
                    <div className="table-wrapper">
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
                                    <div style={{ width: `${r.occupancy}%`, height: "100%", background: "var(--sage)", borderRadius: 3 }} />
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
                  )}
              </>
            )}

            {reportView === "classes" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Szczegóły zajęć — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.classReports.length === 0 ? <div className="empty-state"><div className="empty-icon">🗓</div><p>Brak zajęć</p></div>
                  : rd.classReports.map((r, i) => (
                    <div key={i} className="card" style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div><h3 style={{ fontSize: "1.2rem" }}>{r.cls.name}</h3><p style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{formatDate(r.cls.starts_at)} o {formatTime(r.cls.starts_at)}</p></div>
                        <div style={{ textAlign: "right" }}><div style={{ fontSize: "1.4rem", fontWeight: 600, color: r.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{r.profit} zł</div><div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>dochód netto</div></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.5rem" }}>
                        {[["Uczestnicy", `${r.bookings.length}/${r.cls.max_spots}`],["Obłożenie",`${r.occupancy}%`],["Gotówka",r.cashBookings.length],["Wejścia",r.entriesBookings.length],["Przychód",`${r.revenue} zł`],["Koszt sali",r.venueCost > 0 ? `${r.venueCost} zł` : "—"]].map(([l,v],j) => (
                          <div key={j} style={{ background: "var(--cream)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                            <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase" }}>{l}</div>
                            <div style={{ fontWeight: 500 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}

            {reportView === "clients" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Klienci — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.clientReports.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak danych</p></div>
                  : <div className="table-wrapper"><table>
                    <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Gotówka</th><th>Wejścia</th><th>Wydano</th><th>Przepadłe</th></tr></thead>
                    <tbody>{rd.clientReports.sort((a,b) => b.spent-a.spent).map((c,i) => (
                      <tr key={i}>
                        <td><strong>{c.profile.first_name} {c.profile.last_name}</strong></td>
                        <td>{c.bookings.length}</td>
                        <td>{c.cashCount > 0 ? `💵 ${c.cashCount}` : "—"}</td>
                        <td>{c.entriesCount > 0 ? `🎫 ${c.entriesCount}` : "—"}</td>
                        <td style={{ fontWeight: 500, color: "var(--sage-dark)" }}>{c.spent > 0 ? `${c.spent} zł` : "—"}</td>
                        <td style={{ color: c.lost > 0 ? "var(--clay)" : "var(--light)" }}>{c.lost > 0 ? `⚠️ ${c.lost}` : "—"}</td>
                      </tr>
                    ))}</tbody></table></div>}
              </>
            )}

            {reportView === "entries" && (
              <>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card"><div className="stat-value">{rd.clientReports.reduce((s,c) => s+c.entriesCount,0)}</div><div className="stat-label">Użytych wejść</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: rd.lostEntries.length > 0 ? "var(--clay)" : "var(--light)" }}>{rd.lostEntries.length}</div><div className="stat-label">Przepadłych</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.clientReports.reduce((s,c) => s+c.cashCount,0)}</div><div className="stat-label">Gotówkowych</div></div>
                </div>
                {rd.lostEntries.length > 0 && (
                  <div className="table-wrapper" style={{ marginBottom: "1.5rem" }}>
                    <table>
                      <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Data</th><th>Notatka</th></tr></thead>
                      <tbody>{rd.lostEntries.map((h,i) => (
                        <tr key={i}>
                          <td><strong>{h.profiles?.first_name} {h.profiles?.last_name}</strong></td>
                          <td>{h.classes?.name || "—"}</td>
                          <td>{h.classes?.starts_at ? formatDate(h.classes.starts_at) : "—"}</td>
                          <td style={{ color: "var(--clay)", fontSize: "0.85rem" }}>{h.note}</td>
                        </tr>
                      ))}</tbody></table></div>
                )}
              </>
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
                    <span>{["🥇","🥈","🥉"][i]}</span>
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
                <thead><tr><th>Nazwa</th><th>Data</th><th>Cena</th><th>Uczestnicy</th></tr></thead>
                <tbody>{pastClasses.map(cls => {
                  const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
                  return (
                    <tr key={cls.id}>
                      <td><strong>{cls.name}</strong></td>
                      <td>{formatDate(cls.starts_at)}</td>
                      <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
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

            {/* Wyszukiwarka */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                className="form-input"
                placeholder="🔍 Szukaj po imieniu lub nazwisku..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                style={{ maxWidth: 360 }}
              />
            </div>

            {allProfiles.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak klientów</p></div>
              : (() => {
                const filtered = allProfiles.filter(c =>
                  `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.email?.toLowerCase().includes(clientSearch.toLowerCase())
                );
                return filtered.length === 0
                  ? <div className="empty-state"><div className="empty-icon">🔍</div><p>Brak wyników dla "{clientSearch}"</p></div>
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {filtered.map((c, i) => (
                        <div key={i} className="card" style={{ padding: "1rem 1.25rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <div className="user-avatar">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{c.first_name} {c.last_name}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{c.email}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--mid)", marginTop: 2 }}>
                                  Rezerwacji: {allBookings.filter(b => b.user_id === c.id).length}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              <TokenBadge userId={c.id} month={currentMonth} year={currentYear} />
                              <button className="btn btn-secondary btn-sm" onClick={() => openUserTokens(c)}>🎫 Wejścia</button>
                            </div>
                          </div>

                          {/* Notatki admina */}
                          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                            {editingNotes === c.id ? (
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                <textarea
                                  className="form-input"
                                  value={notesText}
                                  onChange={e => setNotesText(e.target.value)}
                                  placeholder="np. kontuzja kolana, preferuje rano, alergia na lateks..."
                                  rows={2}
                                  style={{ flex: 1, resize: "vertical", fontSize: "0.85rem" }}
                                  autoFocus
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                  <button className="btn btn-primary btn-sm" onClick={() => saveNotes(c.id)}>Zapisz</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingNotes(null)}>Anuluj</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                                <div style={{ flex: 1 }}>
                                  {c.admin_notes
                                    ? <p style={{ fontSize: "0.85rem", color: "var(--charcoal)", fontStyle: "italic" }}>📝 {c.admin_notes}</p>
                                    : <p style={{ fontSize: "0.8rem", color: "var(--light)" }}>Brak notatek</p>}
                                </div>
                                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}
                                  onClick={() => { setEditingNotes(c.id); setNotesText(c.admin_notes || ""); }}>
                                  {c.admin_notes ? "Edytuj notatkę" : "Dodaj notatkę"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
              })()}
          </>
        )}

      </main>

      {/* Mobile nav */}
      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "classes" || tab === "admin_calendar" ? "active" : ""}`} onClick={() => setTab("admin_calendar")}><span className="mobile-nav-icon">📅</span><span>Kalendarz</span></div>
        <div className={`mobile-nav-item ${tab === "settle" ? "active" : ""}`} onClick={() => setTab("settle")}>
          <span className="mobile-nav-icon" style={{ position: "relative" }}>💰{toSettle.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--clay)", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{toSettle.length}</span>}</span>
          <span>Rozlicz</span>
        </div>
        <div className={`mobile-nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}><span className="mobile-nav-icon">📈</span><span>Raporty</span></div>
        <div className={`mobile-nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => setTab("clients")}><span className="mobile-nav-icon">👥</span><span>Klienci</span></div>
      </nav>

      {/* MODAL - Nowe/edytuj zajęcia */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editClass ? "Edytuj zajęcia" : "Nowe zajęcia"}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            {!editClass && templates.length > 0 && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem" }}>
                <label className="form-label" style={{ marginBottom: "0.5rem", display: "block" }}>Wczytaj szablon</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {templates.map(t => (
                    <button key={t.id} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t)}>📋 {t.name}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Nazwa zajęć</label><input className="form-input" placeholder="np. Pilates Flow" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Data i godzina</label><input className="form-input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Czas (min)</label><input className="form-input" type="number" min="15" max="180" step="15" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Maks. miejsc</label><input className="form-input" type="number" min="1" max="50" value={form.max_spots} onChange={e => setForm({ ...form, max_spots: +e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Cena (zł)</label><input className="form-input" type="number" min="0" placeholder="np. 60" value={form.price_pln} onChange={e => setForm({ ...form, price_pln: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Koszt sali (zł)</label><input className="form-input" type="number" min="0" placeholder="np. 100" value={form.venue_cost_pln} onChange={e => setForm({ ...form, venue_cost_pln: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Lokalizacja</label><input className="form-input" placeholder="np. Sala A" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Notatki dla klientek</label><input className="form-input" placeholder="np. Przynieś matę" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            {/* Zajęcia cykliczne — tylko przy tworzeniu */}
            {!editClass && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", marginBottom: recurring.enabled ? "0.75rem" : 0 }}>
                  <input type="checkbox" checked={recurring.enabled} onChange={e => setRecurring({ ...recurring, enabled: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--sage)" }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>🔁 Zajęcia cykliczne</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>Powtarzaj co tydzień o tej samej godzinie</div>
                  </div>
                </label>
                {recurring.enabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--mid)" }}>Powtórz przez</span>
                    <input type="number" min="2" max="52" value={recurring.weeks}
                      onChange={e => setRecurring({ ...recurring, weeks: +e.target.value })}
                      style={{ width: 70, padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem" }} />
                    <span style={{ fontSize: "0.875rem", color: "var(--mid)" }}>tygodni</span>
                    <span style={{ fontSize: "0.8rem", background: "#EBF5EA", color: "var(--sage-dark)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>= {recurring.weeks} zajęć</span>
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Anuluj</button>
                {!editClass && <button className="btn btn-secondary" onClick={() => { setShowModal(false); setTemplateForm({ name: form.name, duration_min: form.duration_min, max_spots: form.max_spots, location: form.location, notes: form.notes, price_pln: form.price_pln, venue_cost_pln: form.venue_cost_pln }); setShowTemplateModal(true); }} title="Zapisz jako szablon">📋 Zapisz jako szablon</button>}
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.starts_at}>{editClass ? "Zapisz" : "Utwórz"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Odwołanie zajęć */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCancelModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>🚫 Odwołaj zajęcia</h3><button className="modal-close" onClick={() => setShowCancelModal(null)}>×</button></div>
            <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#C44B4B", lineHeight: 1.6 }}>
                Odwołujesz zajęcia: <strong>{showCancelModal.name}</strong><br/>
                {formatDate(showCancelModal.starts_at)} o {formatTime(showCancelModal.starts_at)}<br/>
                Zapisanych: <strong>{allBookings.filter(b => b.class_id === showCancelModal.id).length} uczestniczek</strong><br/>
                Wejścia zostaną automatycznie zwrócone.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Powód odwołania</label>
              <input className="form-input" placeholder="np. Choroba instruktora, awaria sali..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowCancelModal(null); setCancelReason(""); }}>Anuluj</button>
              <button className="btn btn-danger" onClick={() => handleCancelClass(showCancelModal)} disabled={!cancelReason.trim()}>
                Odwołaj i powiadom uczestniczki
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Wiadomość do uczestników */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMessageModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>💬 Wiadomość do uczestników</h3><button className="modal-close" onClick={() => setShowMessageModal(null)}>×</button></div>
            <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
              Zajęcia: <strong>{showMessageModal.name}</strong><br/>
              {formatDate(showMessageModal.starts_at)} o {formatTime(showMessageModal.starts_at)}<br/>
              Odbiorców: <strong>{allBookings.filter(b => b.class_id === showMessageModal.id).length}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Wiadomość</label>
              <textarea className="form-input" rows={4} placeholder="np. Przypomnij o zabraniu maty, zmiana sali na B, zajęcia zaczynamy 10 min później..."
                value={messageText} onChange={e => setMessageText(e.target.value)}
                style={{ resize: "vertical", minHeight: 100 }} />
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--mid)", marginBottom: "1rem" }}>
              Wiadomość pojawi się w zakładce Powiadomienia u każdej uczestniczki.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowMessageModal(null); setMessageText(""); }}>Anuluj</button>
              <button className="btn btn-primary" onClick={() => handleSendMessage(showMessageModal)} disabled={!messageText.trim()}>
                Wyślij do wszystkich
              </button>
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
              <p className="form-label" style={{ marginBottom: "0.75rem" }}>Saldo</p>
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
            <div className="form-group"><label className="form-label">Notatka</label><input className="form-input" placeholder="np. Gotówka, karnet 10 wejść" value={tokenForm.note} onChange={e => setTokenForm({ ...tokenForm, note: e.target.value })} /></div>
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

      {/* MODAL - Szablon zajęć */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTemplateModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>📋 Zapisz szablon zajęć</h3><button className="modal-close" onClick={() => setShowTemplateModal(false)}>×</button></div>
            <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>Szablon pozwoli szybko wypełnić formularz przy tworzeniu nowych zajęć.</p>
            <div className="form-group"><label className="form-label">Nazwa szablonu</label><input className="form-input" placeholder="np. Pilates Flow" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Czas (min)</label><input className="form-input" type="number" value={templateForm.duration_min} onChange={e => setTemplateForm({ ...templateForm, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Maks. miejsc</label><input className="form-input" type="number" value={templateForm.max_spots} onChange={e => setTemplateForm({ ...templateForm, max_spots: +e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">Cena (zł)</label><input className="form-input" type="number" placeholder="np. 60" value={templateForm.price_pln} onChange={e => setTemplateForm({ ...templateForm, price_pln: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Koszt sali (zł)</label><input className="form-input" type="number" placeholder="np. 100" value={templateForm.venue_cost_pln} onChange={e => setTemplateForm({ ...templateForm, venue_cost_pln: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Lokalizacja</label><input className="form-input" placeholder="np. Sala A" value={templateForm.location} onChange={e => setTemplateForm({ ...templateForm, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Notatki</label><input className="form-input" placeholder="np. Przynieś matę" value={templateForm.notes} onChange={e => setTemplateForm({ ...templateForm, notes: e.target.value })} /></div>

            {templates.length > 0 && (
              <>
                <p className="form-label" style={{ margin: "1rem 0 0.5rem" }}>Istniejące szablony</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 150, overflowY: "auto" }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--cream)", borderRadius: 6 }}>
                      <span style={{ fontSize: "0.875rem" }}>{t.name} · {t.duration_min} min · {t.price_pln ? t.price_pln + " zł" : "—"}</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTemplate(t.id)}>Usuń</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateForm.name}>Zapisz szablon</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Dodaj uczestnika */}
      {showAddUserModal && selectedClass && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddUserModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>Dodaj uczestnika</h3><button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button></div>
            <p style={{ color: "var(--mid)", fontSize: "0.875rem", marginBottom: "1rem" }}>Zapisz klientkę na: <strong>{selectedClass.name}</strong></p>
            {notEnrolled.length === 0 ? <p style={{ color: "var(--mid)" }}>Wszystkie są zapisane.</p>
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
    supabase.from("tokens").select("amount")
      .eq("user_id", userId).eq("month", month).eq("year", year)
      .maybeSingle()
      .then(({ data }) => setTokens(data?.amount ?? 0));
  }, [userId, month, year]);
  if (tokens === null) return <span style={{ color: "var(--light)" }}>—</span>;
  return <span style={{ fontWeight: 500, color: tokens > 0 ? "var(--sage-dark)" : "var(--light)" }}>🎫 {tokens}</span>;
}
