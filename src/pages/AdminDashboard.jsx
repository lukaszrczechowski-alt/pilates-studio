import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AdminDashboard({ session, profile }) {
  const [tab, setTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [stats, setStats] = useState({ totalClasses: 0, totalBookings: 0, uniqueClients: 0 });

  // Form state
  const [form, setForm] = useState({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "" });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const now = new Date().toISOString();

    const { data: classData } = await supabase
      .from("classes")
      .select("*, bookings(*)")
      .order("starts_at", { ascending: true });

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name, email), classes(name, starts_at)")
      .order("created_at", { ascending: false });

    setClasses(classData || []);
    setAllBookings(bookingData || []);

    const uniqueClients = new Set((bookingData || []).map(b => b.user_id)).size;
    setStats({
      totalClasses: (classData || []).filter(c => c.starts_at >= now).length,
      totalBookings: (bookingData || []).filter(b => b.classes?.starts_at >= now).length,
      uniqueClients,
    });
    setLoading(false);
  }

  async function fetchParticipants(classId) {
    const { data } = await supabase
      .from("bookings")
      .select("*, profiles(first_name, last_name, email)")
      .eq("class_id", classId);
    setParticipants(data || []);
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
    setForm({
      name: cls.name,
      starts_at: localStr,
      duration_min: cls.duration_min,
      max_spots: cls.max_spots,
      location: cls.location || "",
      notes: cls.notes || "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.starts_at) return;
    const payload = { ...form, starts_at: new Date(form.starts_at).toISOString() };
    if (editClass) {
      await supabase.from("classes").update(payload).eq("id", editClass.id);
    } else {
      await supabase.from("classes").insert(payload);
    }
    setShowModal(false);
    await fetchAll();
  }

  async function handleDelete(id) {
    if (!confirm("Na pewno usunąć te zajęcia? Wszystkie rezerwacje zostaną anulowane.")) return;
    await supabase.from("bookings").delete().eq("class_id", id);
    await supabase.from("classes").delete().eq("id", id);
    await fetchAll();
  }

  async function handleRemoveParticipant(bookingId) {
    await supabase.from("bookings").delete().eq("id", bookingId);
    await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  function openParticipants(cls) {
    setSelectedClass(cls);
    fetchParticipants(cls.id);
    setTab("participants");
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }

  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date());
  const pastClasses = classes.filter(c => new Date(c.starts_at) < new Date());

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Pilates</h1>
          <p>Panel admina</p>
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>
            <span className="nav-icon">🗓</span> Zajęcia
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
            <div>
              <div className="user-name">{profile?.first_name} {profile?.last_name}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>Wyloguj się</button>
        </div>
      </aside>

      <main className="main-content">

        {/* STATS */}
        {tab === "classes" && (
          <>
            <div className="page-header">
              <h2>Zarządzanie zajęciami</h2>
              <p>Twórz zajęcia i zarządzaj rezerwacjami</p>
            </div>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-value">{stats.totalClasses}</div>
                <div className="stat-label">Nadchodzące zajęcia</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalBookings}</div>
                <div className="stat-label">Aktywne rezerwacje</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.uniqueClients}</div>
                <div className="stat-label">Klientów łącznie</div>
              </div>
            </div>

            <div className="section-header">
              <h3>Nadchodzące zajęcia</h3>
              <button className="btn btn-primary" onClick={openCreate}>+ Nowe zajęcia</button>
            </div>

            {loading ? <div className="empty-state"><p>Ładowanie...</p></div> :
              upcomingClasses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🌿</div>
                  <p>Brak zaplanowanych zajęć. Dodaj pierwsze!</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ marginBottom: "2rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Nazwa</th>
                        <th>Data</th>
                        <th>Godzina</th>
                        <th>Czas</th>
                        <th>Miejsca</th>
                        <th>Uczestnicy</th>
                        <th>Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingClasses.map(cls => {
                        const count = cls.bookings?.length || 0;
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong></td>
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{cls.duration_min} min</td>
                            <td>{count} / {cls.max_spots}</td>
                            <td>
                              <button className="btn btn-secondary btn-sm" onClick={() => openParticipants(cls)}>
                                Lista ({count})
                              </button>
                            </td>
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

        {/* PARTICIPANTS */}
        {tab === "participants" && selectedClass && (
          <>
            <div className="page-header">
              <h2>{selectedClass.name}</h2>
              <p>{formatDate(selectedClass.starts_at)} o {formatTime(selectedClass.starts_at)}</p>
            </div>
            <div className="section-header">
              <h3>Lista uczestników ({participants.length} / {selectedClass.max_spots})</h3>
              <button className="btn btn-secondary" onClick={() => setTab("classes")}>← Wróć</button>
            </div>
            {participants.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <p>Nikt jeszcze się nie zapisał</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Imię i nazwisko</th>
                      <th>Email</th>
                      <th>Data zapisu</th>
                      <th>Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((b, i) => (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                        <td>{b.profiles?.email}</td>
                        <td>{new Date(b.created_at).toLocaleDateString("pl-PL")}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveParticipant(b.id)}>
                            Usuń
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <>
            <div className="page-header">
              <h2>Historia zajęć</h2>
              <p>Archiwum minionych zajęć</p>
            </div>
            {pastClasses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>Brak minionych zajęć</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Nazwa</th>
                      <th>Data</th>
                      <th>Godzina</th>
                      <th>Uczestnicy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastClasses.map(cls => {
                      const count = cls.bookings?.length || 0;
                      const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
                      return (
                        <tr key={cls.id}>
                          <td><strong>{cls.name}</strong></td>
                          <td>{formatDate(cls.starts_at)}</td>
                          <td>{formatTime(cls.starts_at)}</td>
                          <td>
                            {bookingsForClass.length > 0 ? (
                              bookingsForClass.map(b => (
                                <span key={b.id} className="participant-chip">
                                  {b.profiles?.first_name} {b.profiles?.last_name}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "var(--light)", fontSize: "0.8rem" }}>brak</span>
                            )}
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

        {/* CLIENTS */}
        {tab === "clients" && (
          <>
            <div className="page-header">
              <h2>Klienci</h2>
              <p>Wszyscy zarejestrowani klienci</p>
            </div>
            {(() => {
              const clientMap = new Map();
              allBookings.forEach(b => {
                if (!clientMap.has(b.user_id)) {
                  clientMap.set(b.user_id, {
                    ...b.profiles,
                    bookings: 0,
                    lastClass: null,
                  });
                }
                const c = clientMap.get(b.user_id);
                c.bookings++;
                if (!c.lastClass || new Date(b.classes?.starts_at) > new Date(c.lastClass)) {
                  c.lastClass = b.classes?.starts_at;
                }
              });
              const clients = Array.from(clientMap.values());
              return clients.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <p>Brak klientów</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Imię i nazwisko</th>
                        <th>Email</th>
                        <th>Liczba rezerwacji</th>
                        <th>Ostatnie zajęcia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c, i) => (
                        <tr key={i}>
                          <td><strong>{c.first_name} {c.last_name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.bookings}</td>
                          <td>{c.lastClass ? formatDate(c.lastClass) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}
      </main>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editClass ? "Edytuj zajęcia" : "Nowe zajęcia"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nazwa zajęć</label>
              <input className="form-input" placeholder="np. Pilates Flow"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Data i godzina</label>
              <input className="form-input" type="datetime-local"
                value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Czas trwania (min)</label>
                <input className="form-input" type="number" min="15" max="180" step="15"
                  value={form.duration_min} onChange={e => setForm({ ...form, duration_min: +e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Maks. miejsc</label>
                <input className="form-input" type="number" min="1" max="50"
                  value={form.max_spots} onChange={e => setForm({ ...form, max_spots: +e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lokalizacja (opcjonalnie)</label>
              <input className="form-input" placeholder="np. Sala A, ul. Kwiatowa 5"
                value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Notatki (opcjonalnie)</label>
              <input className="form-input" placeholder="np. Przynieś matę"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={!form.name || !form.starts_at}>
                {editClass ? "Zapisz zmiany" : "Utwórz zajęcia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
