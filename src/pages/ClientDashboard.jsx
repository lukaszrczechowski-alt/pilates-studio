import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ClientDashboard({ session, profile }) {
  const [tab, setTab] = useState("upcoming");
  const [classes, setClasses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const now = new Date().toISOString();

    const { data: classData } = await supabase
      .from("classes")
      .select("*, bookings(count)")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true });

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*, classes(*)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    setClasses(classData || []);
    setMyBookings(bookingData || []);
    setLoading(false);
  }

  function isBooked(classId) {
    return myBookings.some(b => b.class_id === classId && b.classes?.starts_at >= new Date().toISOString());
  }

  function getBookedCount(cls) {
    return cls.bookings?.[0]?.count || 0;
  }

  async function handleBook(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("bookings").insert({
      class_id: cls.id,
      user_id: session.user.id,
    });
    if (!error) await fetchData();
    setActionLoading(null);
  }

  async function handleCancel(cls) {
    setActionLoading(cls.id);
    await supabase.from("bookings")
      .delete()
      .eq("class_id", cls.id)
      .eq("user_id", session.user.id);
    await fetchData();
    setActionLoading(null);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }

  const upcomingMyClasses = myBookings.filter(b => new Date(b.classes?.starts_at) >= new Date());

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
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
        {tab === "upcoming" && (
          <>
            <div className="page-header">
              <h2>Nadchodzące zajęcia</h2>
              <p>Zapisz się na zajęcia klikając poniżej</p>
            </div>
            {loading ? (
              <div className="empty-state"><p>Ładowanie...</p></div>
            ) : classes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🌿</div>
                <p>Brak zaplanowanych zajęć. Wróć wkrótce!</p>
              </div>
            ) : (
              <div className="cards-grid">
                {classes.map(cls => {
                  const booked = isBooked(cls.id);
                  const count = getBookedCount(cls);
                  const isFull = count >= cls.max_spots;
                  const fillPct = Math.min((count / cls.max_spots) * 100, 100);
                  const almostFull = fillPct >= 80;

                  return (
                    <div className="class-card" key={cls.id}>
                      <div className="class-card-header">
                        <span className="class-title">{cls.name}</span>
                        {booked ? (
                          <span className="class-badge badge-yours">Zapisana</span>
                        ) : isFull ? (
                          <span className="class-badge badge-full">Brak miejsc</span>
                        ) : (
                          <span className="class-badge badge-open">Wolne miejsca</span>
                        )}
                      </div>
                      <div className="class-card-body">
                        <div className="class-meta">
                          <div className="meta-item">
                            <span className="meta-icon">📅</span>
                            {formatDate(cls.starts_at)}
                          </div>
                          <div className="meta-item">
                            <span className="meta-icon">🕐</span>
                            {formatTime(cls.starts_at)} · {cls.duration_min} min
                          </div>
                          {cls.location && (
                            <div className="meta-item">
                              <span className="meta-icon">📍</span>
                              {cls.location}
                            </div>
                          )}
                        </div>
                        <div className="spots-bar">
                          <div
                            className={`spots-fill ${isFull ? "full" : almostFull ? "almost-full" : ""}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <p className="spots-text">{count} / {cls.max_spots} miejsc zajętych</p>
                        {booked ? (
                          <button
                            className="btn btn-danger btn-full"
                            onClick={() => handleCancel(cls)}
                            disabled={actionLoading === cls.id}
                          >
                            {actionLoading === cls.id ? "..." : "Wypisz się"}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-full"
                            onClick={() => handleBook(cls)}
                            disabled={isFull || actionLoading === cls.id}
                          >
                            {actionLoading === cls.id ? "..." : isFull ? "Brak miejsc" : "Zapisz się"}
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
            <div className="page-header">
              <h2>Moje rezerwacje</h2>
              <p>Twoje nadchodzące zajęcia</p>
            </div>
            {upcomingMyClasses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <p>Nie masz jeszcze żadnych rezerwacji.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Zajęcia</th>
                      <th>Data</th>
                      <th>Godzina</th>
                      <th>Czas trwania</th>
                      <th>Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingMyClasses.map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.classes?.name}</strong></td>
                        <td>{formatDate(b.classes?.starts_at)}</td>
                        <td>{formatTime(b.classes?.starts_at)}</td>
                        <td>{b.classes?.duration_min} min</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(b.classes)}
                            disabled={actionLoading === b.class_id}
                          >
                            Wypisz się
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
      </main>
    </div>
  );
}
