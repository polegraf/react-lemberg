import React, { useState, useRef, useEffect } from "react";

const HN = { fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" };

const SUPABASE_URL = "https://wgvqmeiprhylmdluocsm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndnFtZWlwcmh5bG1kbHVvY3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTk3NTQsImV4cCI6MjA5NDMzNTc1NH0.b9X-M8YGEDRgGeWLnI0N69feijzDPr-yo_b4mOxzlj0";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function uploadFile(file) {
  const ext = file.name.split(".").pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type },
    body: file
  });
  if (!r.ok) throw new Error("Upload failed");
  return `${SUPABASE_URL}/storage/v1/object/public/media/${name}`;
}

const db = {
  async getProjects() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=*&order=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map(r => ({ ...r.data, _dbId: r.id })) : [];
  },
  async saveProjects(projects) {
    // Safe: upsert all current projects, then delete removed ones
    if (projects.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/projects?id=gte.0`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      return;
    }
    // Upsert each project by its app-level id stored in data->id
    // First get existing db rows to know which to delete
    const getR = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const existing = await getR.json();
    const existingIds = Array.isArray(existing) ? existing.map(r => r.data?.id) : [];
    const currentIds = projects.map(p => p.id);
    // Delete projects that were removed
    const toDelete = Array.isArray(existing) ? existing.filter(r => !currentIds.includes(r.data?.id)) : [];
    for (const row of toDelete) {
      await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${row.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
    }
    // Upsert existing or insert new
    for (const project of projects) {
      const existingRow = Array.isArray(existing) ? existing.find(r => r.data?.id === project.id) : null;
      if (existingRow) {
        await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${existingRow.id}`, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: project })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ data: project })
        });
      }
    }
  },
  async getSettings() {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.seo&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await r.json();
    return rows?.[0]?.data || null;
  },
  async saveSettings(seo) {
    await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: "seo", data: seo })
    });
  }
};

const DEFAULT_PROJECTS = [
  { id: 1, title: "Forma Studio", subtitle: "Brand Identity", category: ["brand", "logo"], year: "2024", location: "Moscow", coverType: "image", cover: "", desc: "Visual identity system for an architecture studio. Minimalism, space, materiality.", blocks: [], featured: true },
  { id: 2, title: "Zima", subtitle: "Packaging Design", category: ["packaging"], year: "2024", location: "St. Petersburg", coverType: "image", cover: "", desc: "Packaging for a natural cosmetics line. Inspired by winter forest, frost, whiteness.", blocks: [], featured: false },
  { id: 3, title: "Pulse", subtitle: "UI/UX Design", category: ["ui"], year: "2023", location: "Berlin", coverType: "video", cover: "", desc: "Mobile app design for health tracking and meditation.", blocks: [], featured: true },
  { id: 4, title: "Svet Magazine", subtitle: "Editorial Design", category: ["print"], year: "2023", location: "Moscow", coverType: "image", cover: "", desc: "Layout and art direction for a cultural magazine. 84 pages.", blocks: [], featured: false },
  { id: 5, title: "Oblako", subtitle: "Motion Branding", category: ["motion", "brand"], year: "2023", location: "Amsterdam", coverType: "video", cover: "", desc: "Animated identity system for a streaming platform.", blocks: [], featured: true },
  { id: 6, title: "Roots", subtitle: "Photography Series", category: ["photo"], year: "2022", location: "Tbilisi", coverType: "image", cover: "", desc: "Documentary series on post-Soviet urban architecture.", blocks: [], featured: false },
];

const DEFAULT_SEO = {
  siteName: "Your Name", tagline: "Graphic Design — Art Direction — Brand Creation",
  metaTitle: "Portfolio — Designer & Art Director",
  metaDesc: "Designer and art director. Visual systems, brand identities, editorial content.",
  ogImage: "", email: "hello@yourname.com",
  instagram: "", instagramUrl: "", whatsapp: "", whatsappUrl: "",
  behance: "", adminPassword: "1234",
};

const CATEGORIES = ["all", "brand", "logo", "packaging", "ui", "photo", "motion", "print", "illustration"];
const BLOCK_TYPES = ["text", "quote", "image", "video"];
const LAYOUTS = ["wide", "two-square", "three-vertical"];
const LAYOUT_LABELS = { "wide": "1 wide (16:9)", "two-square": "2 square (1:1)", "three-vertical": "3 vertical (9:16)" };

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function Placeholder({ title, type }) {
  const letters = (title || "").split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "—";
  return (
    <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {type === "video"
        ? <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "14px solid rgba(255,255,255,.3)", marginLeft: 3 }} />
          </div>
        : <span style={{ ...HN, fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,.06)" }}>{letters}</span>}
    </div>
  );
}

function CoverMedia({ project, style }) {
  if (!project.cover) return <div style={style}><Placeholder title={project.title} type={project.coverType} /></div>;
  if (project.coverType === "video") return <div style={{ ...style, overflow: "hidden" }}><video src={project.cover} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={{ ...style, overflow: "hidden" }}><img src={project.cover} alt={project.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
}

function ThumbMedia({ project, style }) {
  const src = project.thumbnail || project.cover;
  const type = project.thumbnail ? (project.thumbType || "image") : project.coverType;
  if (!src) return <div style={{ width: "100%", height: 240, background: "#111" }}><Placeholder title={project.title} type={type} /></div>;
  if (type === "video") return <video src={src} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />;
  return <img src={src} alt={project.title} style={{ width: "100%", display: "block" }} />;
}

function MediaSlot({ src, type, caption, ratio }) {
  if (!src) return <div style={{ width: "100%", aspectRatio: ratio, background: "#111", overflow: "hidden" }}><Placeholder title={caption} type={type} /></div>;
  if (type === "video") return <div style={{ width: "100%", aspectRatio: ratio, background: "#111", overflow: "hidden" }}><video src={src} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={{ width: "100%", aspectRatio: ratio, background: "#111", overflow: "hidden" }}><img src={src} alt={caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
}

function ContentBlock({ block, isMobile }) {
  if (block.type === "text") return <p style={{ ...HN, fontSize: isMobile ? 17 : 20, lineHeight: 1.75, color: "rgba(255,255,255,.85)", marginBottom: 12, fontWeight: 300, textAlign: "center" }}>{block.content}</p>;
  if (block.type === "quote") return (
    <blockquote style={{ margin: "0 0 56px", padding: 0, textAlign: "center" }}>
      <p style={{ ...HN, fontSize: isMobile ? 24 : 32, fontWeight: 700, lineHeight: 1.25, color: "#fff", letterSpacing: "-.03em" }}>{block.content}</p>
    </blockquote>
  );
  if (block.type === "image" || block.type === "video") {
    const layout = block.layout || "wide"; const type = block.type;
    if (isMobile) {
      const slots = layout === "wide" ? [block.src] : layout === "two-square" ? [block.src, block.src2] : [block.src, block.src2, block.src3];
      return (
        <div style={{ marginBottom: 24, marginLeft: "calc(-100vw * 0.1)", marginRight: "calc(-100vw * 0.1)", width: "calc(100% + 100vw * 0.2)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {slots.map((s, i) => {
              if (!s && !block.caption) return null;
              return (
                <div key={i} style={{ width: "100%", aspectRatio: layout === "three-vertical" ? "9/16" : layout === "two-square" ? "1/1" : "16/9", background: "#111", overflow: "hidden" }}>
                  {s
                    ? type === "video"
                      ? <video src={s} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <img src={s} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "rgba(255,255,255,.06)", fontSize: 28, fontWeight: 700, ...HN }}>—</span></div>
                  }
                </div>
              );
            })}
          </div>
          {block.caption && <p style={{ ...HN, fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 8, paddingLeft: "calc(100vw * 0.1)", letterSpacing: ".06em", textTransform: "uppercase" }}>{block.caption}</p>}
        </div>
      );
    }
    if (layout === "wide") return (
      <div style={{ marginBottom: 56 }}>
        <MediaSlot src={block.src} type={type} ratio="16/9" />
        {block.caption && <p style={{ ...HN, fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>{block.caption}</p>}
      </div>
    );
    if (layout === "two-square") return (
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <MediaSlot src={block.src} type={type} ratio="1/1" />
          <MediaSlot src={block.src2} type={type} ratio="1/1" />
        </div>
        {block.caption && <p style={{ ...HN, fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>{block.caption}</p>}
      </div>
    );
    if (layout === "three-vertical") return (
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, alignItems: "start" }}>
          <MediaSlot src={block.src} type={type} ratio="9/16" />
          <MediaSlot src={block.src2} type={type} ratio="9/16" />
          <MediaSlot src={block.src3} type={type} ratio="9/16" />
        </div>
        {block.caption && <p style={{ ...HN, fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>{block.caption}</p>}
      </div>
    );
  }
  return null;
}

function PublicSite({ projects, seo, onAdmin }) {
  const [filter, setFilter] = useState("all");
  const [hovered, setHovered] = useState(null);
  const [view, setView] = useState("index");
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [pwPrompt, setPwPrompt] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const isMobile = useIsMobile();

  const handleAdminClick = () => { setPwPrompt(true); setPwInput(""); setPwError(false); };
  const handleAdminSubmit = () => {
    if (pwInput === (seo.adminPassword || "1234")) { setPwPrompt(false); onAdmin(); }
    else setPwError(true);
  };

  const filtered = filter === "all" ? projects : projects.filter(p => p.category.includes(filter));
  const px = isMobile ? "20px" : "40px";
  const openProject = p => { setActive(p); setView("project"); window.scrollTo(0, 0); };
  const goIndex = () => { setView("index"); setActive(null); };
  const handleSend = () => {
    if (form.name && form.email && form.message) { setSent(true); setTimeout(() => { setSent(false); setForm({ name: "", email: "", message: "" }); }, 3000); }
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", ...HN }}>
      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(0,0,0,.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.08)", padding: `0 ${px}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span onClick={() => { goIndex(); setMenuOpen(false); }} style={{ fontSize: isMobile ? 14 : 14, fontWeight: 700, cursor: "pointer", letterSpacing: ".02em", textTransform: "uppercase" }}>{seo.siteName}</span>
        {isMobile ? (
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ display: "block", width: 22, height: 1.5, background: menuOpen ? "transparent" : "#fff", transition: "all .2s", transform: menuOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
            <span style={{ display: "block", width: 22, height: 1.5, background: "#fff", transition: "all .2s", transform: menuOpen ? "rotate(-45deg)" : "none" }} />
            {!menuOpen && <span style={{ display: "block", width: 22, height: 1.5, background: "#fff" }} />}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {[["index", "Work"], ["contact", "Contact"]].map(([v, l]) => (
              <span key={v} onClick={() => setView(v)} style={{ fontSize: 13, cursor: "pointer", color: view === v ? "#fff" : "rgba(255,255,255,.4)", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", transition: "color .15s" }}>{l}</span>
            ))}
            <span onClick={handleAdminClick} style={{ fontSize: 32, color: "#fff", cursor: "pointer", fontWeight: 400, lineHeight: 1, userSelect: "none" }}>✳</span>
          </div>
        )}
      </nav>

      {/* ── BURGER MENU ── */}
      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, top: 56, background: "#000", zIndex: 99, display: "flex", flexDirection: "column", padding: "48px 20px" }}>
          {[["index", "Work"], ["contact", "Contact"]].map(([v, l]) => (
            <span key={v} onClick={() => { setView(v); setMenuOpen(false); }}
              style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1, color: view === v ? "#fff" : "rgba(255,255,255,.35)", cursor: "pointer", marginBottom: 16 }}>{l}</span>
          ))}
        </div>
      )}

      {pwPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPwPrompt(false)}>
          <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.1)", padding: "40px 48px", minWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", color: "rgba(255,255,255,.35)", textTransform: "uppercase", marginBottom: 28 }}>Enter password</div>
            <input autoFocus type="password" value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={e => e.key === "Enter" && handleAdminSubmit()}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${pwError ? "rgba(255,80,80,.6)" : "rgba(255,255,255,.2)"}`, color: "#fff", fontSize: 24, fontWeight: 700, padding: "8px 0", outline: "none", ...HN, marginBottom: 8 }} />
            {pwError && <div style={{ fontSize: 11, color: "rgba(255,80,80,.7)", letterSpacing: ".06em", marginTop: 8 }}>Incorrect password</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={handleAdminSubmit} style={{ padding: "10px 24px", background: "#fff", color: "#000", border: "none", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", ...HN }}>Enter →</button>
              <button onClick={() => setPwPrompt(false)} style={{ padding: "10px 16px", background: "transparent", color: "rgba(255,255,255,.3)", border: "1px solid rgba(255,255,255,.1)", fontSize: 11, cursor: "pointer", ...HN }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {view === "index" && (
        <div style={{ padding: `0 ${px} 120px` }}>
          <div style={{ padding: isMobile ? "48px 0 40px" : "48px 0 36px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <h1 style={{ fontSize: isMobile ? "clamp(43px,11vw,62px)" : "clamp(64px,8vw,120px)", fontWeight: 700, letterSpacing: "-.04em", lineHeight: .92, color: "#fff" }}>{seo.tagline}</h1>
          </div>
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap", padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,.07)", marginBottom: isMobile ? 32 : 56, lineHeight: isMobile ? 1.2 : "normal" }}>
            {["all", ...Array.from(new Set(projects.flatMap(p => p.category || [])))].map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{ padding: isMobile ? "4px 12px 4px 0" : "6px 16px 6px 0", background: "transparent", border: "none", color: filter === cat ? "#fff" : "rgba(255,255,255,.35)", fontSize: isMobile ? 13 : 13, cursor: "pointer", fontWeight: filter === cat ? 700 : 400, letterSpacing: ".04em", lineHeight: 1.2, textTransform: "uppercase", ...HN, transition: "color .15s" }}>{cat}</button>
            ))}
          </div>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {filtered.map(p => (
                <div key={p.id} onClick={() => p.ready && openProject(p)} style={{ cursor: p.ready ? "pointer" : "default", opacity: p.ready ? 1 : 0.6 }}>
                  <ThumbMedia project={p} />
                  <div style={{ padding: "12px 0 4px" }}>
                    <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.3 }}>{p.title}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", letterSpacing: ".03em", textTransform: "uppercase", marginTop: 4 }}>{p.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ columns: "3 280px", columnGap: 20 }}>
              {filtered.map((p, i) => {
                const tall = i % 5 === 0 || i % 5 === 3;
                return (
                  <div key={p.id} onClick={() => p.ready && openProject(p)} onMouseEnter={() => p.ready && setHovered(p.id)} onMouseLeave={() => setHovered(null)}
                    style={{ breakInside: "avoid", marginBottom: 20, cursor: p.ready ? "pointer" : "default", position: "relative", opacity: p.ready ? 1 : 0.6 }}>
                    <div style={{ overflow: "hidden", background: "#111", position: "relative", aspectRatio: p.thumbnail || p.cover ? undefined : (tall ? "3/4" : "4/3") }}>
                      <div style={{ transition: "transform .6s cubic-bezier(.16,1,.3,1)", transform: hovered === p.id ? "scale(1.03)" : "scale(1)" }}>
                        <ThumbMedia project={p} style={{ width: "100%", display: "block" }} />
                      </div>
                    </div>
                    <div style={{ padding: "12px 0 18px", background: "#000" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", letterSpacing: ".05em", textTransform: "uppercase", marginTop: 4 }}>{p.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "100px 0", color: "rgba(255,255,255,.2)", fontSize: 13, letterSpacing: ".07em", textTransform: "uppercase" }}>No projects in this category</div>}
        </div>
      )}

      {view === "project" && active && (
        <div>
          {active.cover ? (
            <div style={{ width: "100%", height: isMobile ? "30vh" : "44vh", position: "relative", overflow: "hidden" }}>
              <CoverMedia project={active} style={{ width: "100%", height: "100%" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.88) 100%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: isMobile ? "28px 20px" : "48px 40px" }}>
                <div style={{ width: "100%", maxWidth: isMobile ? "100%" : "80%", margin: "0 auto" }}>
                  <h1 style={{ fontSize: isMobile ? "clamp(32px,9vw,52px)" : "clamp(48px,6vw,88px)", fontWeight: 700, letterSpacing: "-.04em", lineHeight: .93, color: "#fff", marginBottom: 14, textAlign: "center", width: "100%" }}>{active.title}</h1>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", letterSpacing: ".05em", textTransform: "uppercase", textAlign: "center", marginBottom: isMobile ? "calc(13px * 1.2)" : 0, width: "100%" }}>{active.subtitle} {active.location} {active.year}</div>
                  {isMobile && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: "calc(13px * 1.2)", width: "100%" }}>
                      {active.category.map(c => <span key={c} style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.15)", padding: "4px 12px" }}>{c}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", padding: isMobile ? `${56 * 0.6}px 20px 24px` : "48px 40px 36px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,.07)", textAlign: "center" }}>
              <h1 style={{ fontSize: isMobile ? "clamp(43px,11vw,62px)" : "clamp(64px,8vw,120px)", fontWeight: 700, letterSpacing: "-.04em", lineHeight: .92, color: "#fff", textAlign: "center", marginBottom: 14, width: "100%" }}>{active.title}</h1>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", letterSpacing: ".05em", textTransform: "uppercase", textAlign: "center", marginBottom: isMobile ? "calc(13px * 1.2)" : 0, width: "100%" }}>{active.subtitle} {active.location} {active.year}</div>
              {isMobile && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: "calc(13px * 1.2)", width: "100%" }}>
                  {active.category.map(c => <span key={c} style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.15)", padding: "4px 12px" }}>{c}</span>)}
                </div>
              )}
            </div>
          )}
          <div style={{ padding: isMobile ? "32px 20px 100px" : `96px ${px} 140px`, textAlign: "center" }}>
            <div style={{ width: "100%" }}>
            {!isMobile && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 56 }}>
                <button onClick={goIndex} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", fontSize: 12, padding: 0, display: "flex", alignItems: "center", gap: 8, letterSpacing: ".06em", textTransform: "uppercase", ...HN }}>← Back to Work</button>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {active.category.map(c => <span key={c} style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.15)", padding: "4px 12px" }}>{c}</span>)}
                </div>
              </div>
            )}
            <p style={{ ...HN, fontSize: isMobile ? 17 : 20, fontWeight: 700, lineHeight: 1.75, color: "#fff", letterSpacing: "-.01em", marginBottom: isMobile ? 12 : 16, textAlign: "center" }}>{active.desc}</p>
            {(active.blocks || []).map(b => <ContentBlock key={b.id} block={b} isMobile={isMobile} />)}
            <div style={{ marginTop: 80, paddingTop: 48, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "center" }}>
              <button onClick={() => setView("contact")} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 32px", background: "#fff", color: "#000", border: "none", fontSize: 13, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", cursor: "pointer", ...HN }}>Start a project →</button>
            </div>
            </div>
          </div>
        </div>
      )}

      {view === "contact" && (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "64px 20px 100px" : "112px 40px 160px" }}>
          <h1 style={{ fontSize: isMobile ? "clamp(48px,11vw,72px)" : "clamp(64px,8vw,112px)", fontWeight: 700, letterSpacing: "-.04em", lineHeight: .92, color: "#fff", marginBottom: isMobile ? 56 : 80 }}>Let's work<br />together.</h1>
          {sent ? (
            <div style={{ padding: "40px 0" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Message sent.</div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,.5)" }}>I'll get back to you within 24 hours.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[{ k: "name", l: "Name" }, { k: "email", l: "Email" }].map(f => (
                <div key={f.k} style={{ borderTop: "1px solid rgba(255,255,255,.12)", padding: "22px 0" }}>
                  <label style={{ display: "block", fontSize: 11, letterSpacing: ".08em", color: "rgba(255,255,255,.55)", textTransform: "uppercase", marginBottom: 10 }}>{f.l}</label>
                  <input value={form[f.k]} onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                    style={{ width: "100%", background: "transparent", border: "none", fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "#fff", ...HN, outline: "none", letterSpacing: "-.02em" }} />
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", borderBottom: "1px solid rgba(255,255,255,.12)", padding: "22px 0" }}>
                <label style={{ display: "block", fontSize: 11, letterSpacing: ".08em", color: "rgba(255,255,255,.55)", textTransform: "uppercase", marginBottom: 10 }}>Message</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={5}
                  style={{ width: "100%", background: "transparent", border: "none", fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "#fff", ...HN, outline: "none", resize: "none", letterSpacing: "-.02em" }} />
              </div>
              <button onClick={handleSend} style={{ marginTop: 32, alignSelf: "flex-start", padding: "15px 36px", background: "#fff", color: "#000", border: "none", fontSize: 13, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", cursor: "pointer", ...HN }}>Send →</button>
            </div>
          )}
          <div style={{ marginTop: 80, display: "flex", gap: isMobile ? 36 : 56, flexWrap: "wrap" }}>
            {[["Email", seo.email], ["Behance", seo.behance]].map(([k, v]) => v ? (
              <div key={k}>
                <div style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 8 }}>{k}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,.75)", fontWeight: 500 }}>{v}</div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      <footer style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: `24px ${px}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,.25)", letterSpacing: ".04em" }}>© {new Date().getFullYear()} {seo.siteName}</span>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {seo.instagramUrl && (
            <a href={seo.instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", display: "flex" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
              </svg>
            </a>
          )}
          {seo.whatsappUrl && (
            <a href={seo.whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", display: "flex" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </a>
          )}
          <span style={{ fontSize: 12, color: "#fff", letterSpacing: ".04em" }}>{seo.email}</span>
        </div>
      </footer>
    </div>
  );
}

function BlockEditor({ block, onChange, onDelete, onUp, onDown }) {
  const refs = [useRef(), useRef(), useRef()];
  const inputStyle = { width: "100%", background: "#111", border: "1px solid rgba(255,255,255,.12)", color: "#fff", padding: "8px 12px", fontSize: 13, ...HN, outline: "none", borderRadius: 2 };
  const labelStyle = { fontSize: 10, letterSpacing: ".08em", color: "rgba(255,255,255,.5)", textTransform: "uppercase", display: "block", marginBottom: 6 };
  const handleFile = (key) => async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const url = await uploadFile(f);
      onChange({ ...block, [key]: url });
    } catch { alert("Upload failed, try again"); }
  };
  const slotCount = block.layout === "wide" ? 1 : block.layout === "two-square" ? 2 : 3;
  const slotKeys = ["src", "src2", "src3"];
  const slotLabels = { "wide": ["File (16:9)"], "two-square": ["Left (1:1)", "Right (1:1)"], "three-vertical": ["Left (9:16)", "Center (9:16)", "Right (9:16)"] };
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4, padding: 16, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", ...HN }}>{block.type}{block.layout ? ` / ${block.layout}` : ""}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[["↑", onUp], ["↓", onDown], ["✕", onDelete]].map(([l, fn]) => (
            <button key={l} onClick={fn} style={{ background: "none", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.4)", fontSize: 11, width: 24, height: 24, cursor: "pointer", ...HN, borderRadius: 2 }}>{l}</button>
          ))}
        </div>
      </div>
      {block.type === "text" && <textarea value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />}
      {block.type === "quote" && <textarea value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />}
      {(block.type === "image" || block.type === "video") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Layout</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LAYOUTS.map(l => (
                <button key={l} onClick={() => onChange({ ...block, layout: l })}
                  style={{ padding: "5px 12px", background: block.layout === l ? "#fff" : "transparent", color: block.layout === l ? "#000" : "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.15)", fontSize: 10, cursor: "pointer", ...HN, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", borderRadius: 2 }}>
                  {LAYOUT_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: slotCount === 1 ? "1fr" : slotCount === 2 ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8 }}>
            {Array.from({ length: slotCount }).map((_, i) => {
              const key = slotKeys[i];
              return (
                <div key={i}>
                  <label style={labelStyle}>{(slotLabels[block.layout] || [])[i] || `File ${i + 1}`}</label>
                  <input ref={refs[i]} type="file" accept={block.type === "video" ? "video/*" : "image/*"} style={{ display: "none" }} onChange={handleFile(key)} />
                  <button onClick={() => refs[i].current?.click()} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: block[key] ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.3)", fontSize: 11, cursor: "pointer", ...HN, borderRadius: 2 }}>
                    {block[key] ? "✓ Loaded" : "Upload"}
                  </button>
                  {block[key] && <button onClick={() => onChange({ ...block, [key]: "" })} style={{ background: "none", border: "none", color: "rgba(255,80,80,.6)", fontSize: 10, cursor: "pointer", ...HN, padding: "4px 0", display: "block" }}>Remove</button>}
                </div>
              );
            })}
          </div>
          <div>
            <label style={labelStyle}>Caption (optional)</label>
            <input value={block.caption || ""} onChange={e => onChange({ ...block, caption: e.target.value })} style={inputStyle} />
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ projects, setProjects, seo, setSeo, onBack, onSave }) {
  const [tab, setTab] = useState("projects");
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(null);
  const [seoForm, setSeoForm] = useState({ ...seo });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const coverRef = useRef();
  const thumbRef = useRef();

  const inputStyle = { width: "100%", background: "#111", border: "1px solid rgba(255,255,255,.12)", color: "#fff", padding: "9px 12px", fontSize: 13, ...HN, outline: "none", borderRadius: 2 };
  const labelStyle = { fontSize: 10, letterSpacing: ".08em", color: "rgba(255,255,255,.5)", textTransform: "uppercase", display: "block", marginBottom: 6 };

  const startEdit = p => { setForm({ ...p, categoryStr: p.category.join(", ") }); setEditId(p.id); };
  const startNew = () => {
    const id = Date.now();
    setForm({ id, title: "", subtitle: "", categoryStr: "", year: String(new Date().getFullYear()), location: "", coverType: "image", cover: "", desc: "", blocks: [], featured: false, ready: false });
    setEditId(id);
  };
  const saveProject = async () => {
    const updated = { ...form, category: form.categoryStr.split(",").map(s => s.trim()).filter(Boolean) };
    const newProjects = projects.find(p => p.id === form.id) ? projects.map(p => p.id === form.id ? updated : p) : [...projects, updated];
    setProjects(newProjects);
    setSaving(true);
    await db.saveProjects(newProjects);
    setSaving(false);
    setEditId(null); setForm(null);
  };
  const del = async id => {
    if (!window.confirm("Delete this project?")) return;
    const newProjects = projects.filter(p => p.id !== id);
    setProjects(newProjects);
    await db.saveProjects(newProjects);
  };
  const addBlock = type => setForm({ ...form, blocks: [...(form.blocks || []), { id: String(Date.now()), type, layout: "wide", content: "", src: "", src2: "", src3: "", caption: "" }] });
  const updateBlock = (id, updated) => setForm({ ...form, blocks: form.blocks.map(b => b.id === id ? updated : b) });
  const deleteBlock = id => setForm({ ...form, blocks: form.blocks.filter(b => b.id !== id) });
  const moveBlock = (id, dir) => {
    const arr = [...form.blocks]; const i = arr.findIndex(b => b.id === id);
    const ni = i + dir; if (ni < 0 || ni >= arr.length) return;
    [arr[i], arr[ni]] = [arr[ni], arr[i]]; setForm({ ...form, blocks: arr });
  };
  const handleCover = async e => {
    const f = e.target.files[0]; if (!f) return;
    setSaving(true);
    try { const url = await uploadFile(f); setForm(prev => ({ ...prev, cover: url })); }
    catch { alert("Upload failed, try again"); }
    setSaving(false);
  };
  const handleThumb = async e => {
    const f = e.target.files[0]; if (!f) return;
    setSaving(true);
    try { const url = await uploadFile(f); setForm(prev => ({ ...prev, thumbnail: url })); }
    catch { alert("Upload failed, try again"); }
    setSaving(false);
  };
  const moveProject = async (id, dir) => {
    const arr = [...projects];
    const i = arr.findIndex(p => p.id === id);
    const ni = i + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[i], arr[ni]] = [arr[ni], arr[i]];
    setProjects(arr);
    await db.saveProjects(arr);
  };
    setSaving(true);
    setSeo(seoForm);
    await db.saveSettings(seoForm);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", ...HN }}>
      <div style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,.08)", padding: "0 32px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.3)" }}>Admin</span>
          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,.1)" }} />
          {[["projects", "Projects"], ["seo", "SEO"], ["contacts", "Contacts"]].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setEditId(null); setForm(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: tab === k ? "#fff" : "rgba(255,255,255,.3)", ...HN, padding: "4px 0", borderBottom: tab === k ? "1px solid #fff" : "1px solid transparent" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saving && <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: ".06em" }}>Saving...</span>}
          <button onClick={onBack} style={{ background: "none", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.5)", fontSize: 10, padding: "5px 14px", cursor: "pointer", ...HN, letterSpacing: ".06em", textTransform: "uppercase", borderRadius: 2 }}>← Site</button>
        </div>
      </div>

      <div style={{ padding: "32px 40px" }}>
        {tab === "projects" && !editId && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>Projects <span style={{ fontSize: 13, color: "rgba(255,255,255,.25)", fontWeight: 400 }}>({projects.length})</span></h2>
              <button onClick={startNew} style={{ padding: "9px 20px", background: "#fff", color: "#000", border: "none", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", ...HN }}>+ New</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {projects.map(p => (
                <div key={p.id} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.06)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 56, height: 38, overflow: "hidden", flexShrink: 0, background: "#111" }}>
                    <ThumbMedia project={p} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff" }}>{p.title || <span style={{ color: "rgba(255,255,255,.2)" }}>Untitled</span>}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginTop: 2, letterSpacing: ".04em", textTransform: "uppercase" }}>{p.subtitle} · {p.year} · {p.blocks?.length || 0} blocks</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {p.featured && <span style={{ fontSize: 9, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", border: "1px solid rgba(255,255,255,.1)", padding: "3px 7px" }}>Featured</span>}
                    {p.ready && <span style={{ fontSize: 9, letterSpacing: ".07em", textTransform: "uppercase", color: "#4caf86", border: "1px solid #4caf86", padding: "3px 7px" }}>Ready</span>}
                    <button onClick={() => moveProject(p.id, -1)} style={{ padding: "6px 10px", border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer", ...HN }}>↑</button>
                    <button onClick={() => moveProject(p.id, 1)} style={{ padding: "6px 10px", border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer", ...HN }}>↓</button>
                    <button onClick={() => startEdit(p)} style={{ padding: "6px 14px", border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "rgba(255,255,255,.6)", fontSize: 10, cursor: "pointer", ...HN }}>Edit</button>
                    <button onClick={() => del(p.id)} style={{ padding: "6px 12px", border: "1px solid rgba(255,50,50,.2)", background: "transparent", color: "rgba(255,80,80,.5)", fontSize: 10, cursor: "pointer", ...HN }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "projects" && editId && form && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <button onClick={() => { setEditId(null); setForm(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", fontSize: 10, padding: 0, ...HN, letterSpacing: ".07em", textTransform: "uppercase" }}>← Back</button>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>{projects.find(p => p.id === form.id) ? "Edit project" : "New project"}</h2>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Thumbnail — index grid</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["image", "video"].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, thumbType: t })}
                    style={{ padding: "5px 14px", background: (form.thumbType || "image") === t ? "#fff" : "transparent", color: (form.thumbType || "image") === t ? "#000" : "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.15)", fontSize: 10, cursor: "pointer", ...HN, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", borderRadius: 2 }}>{t}</button>
                ))}
              </div>
              <input ref={thumbRef} type="file" accept={(form.thumbType || "image") === "video" ? "video/*" : "image/*"} style={{ display: "none" }} onChange={handleThumb} />
              <div style={{ width: "100%", height: 160, background: "#0a0a0a", border: "1px dashed rgba(255,255,255,.1)", cursor: "pointer", overflow: "hidden" }} onClick={() => thumbRef.current?.click()}>
                {form.thumbnail ? <CoverMedia project={{ ...form, cover: form.thumbnail, coverType: form.thumbType || "image" }} style={{ width: "100%", height: "100%" }} />
                  : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ fontSize: 22, color: "rgba(255,255,255,.15)" }}>+</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", letterSpacing: ".07em", textTransform: "uppercase" }}>Upload thumbnail</div>
                    </div>}
              </div>
              {form.thumbnail && <button onClick={() => setForm({ ...form, thumbnail: "" })} style={{ background: "none", border: "none", color: "rgba(255,80,80,.5)", fontSize: 10, cursor: "pointer", ...HN, marginTop: 6 }}>Remove</button>}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Cover — project page</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["image", "video"].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, coverType: t })}
                    style={{ padding: "5px 14px", background: form.coverType === t ? "#fff" : "transparent", color: form.coverType === t ? "#000" : "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.15)", fontSize: 10, cursor: "pointer", ...HN, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", borderRadius: 2 }}>{t}</button>
                ))}
              </div>
              <input ref={coverRef} type="file" accept={form.coverType === "video" ? "video/*" : "image/*"} style={{ display: "none" }} onChange={handleCover} />
              <div style={{ width: "100%", height: 200, background: "#0a0a0a", border: "1px dashed rgba(255,255,255,.1)", cursor: "pointer", overflow: "hidden" }} onClick={() => coverRef.current?.click()}>
                {form.cover ? <CoverMedia project={form} style={{ width: "100%", height: "100%" }} />
                  : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ fontSize: 22, color: "rgba(255,255,255,.15)" }}>+</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", letterSpacing: ".07em", textTransform: "uppercase" }}>Upload cover</div>
                    </div>}
              </div>
              {form.cover && <button onClick={() => setForm({ ...form, cover: "" })} style={{ background: "none", border: "none", color: "rgba(255,80,80,.5)", fontSize: 10, cursor: "pointer", ...HN, marginTop: 6 }}>Remove</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[{ k: "title", l: "Title" }, { k: "subtitle", l: "Subtitle" }, { k: "year", l: "Year" }, { k: "location", l: "Location" }].map(({ k, l }) => (
                <div key={k}><label style={labelStyle}>{l}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} style={inputStyle} /></div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Categories (comma-separated)</label>
              <input value={form.categoryStr || ""} onChange={e => setForm({ ...form, categoryStr: e.target.value })} placeholder="brand, logo, print..." style={inputStyle} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.25)", marginTop: 4 }}>Options: {CATEGORIES.slice(1).join(", ")}</div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.desc || ""} onChange={e => setForm({ ...form, desc: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ ...labelStyle, marginBottom: 12 }}>Content blocks ({form.blocks?.length || 0})</label>
              {(form.blocks || []).map(b => (
                <BlockEditor key={b.id} block={b} onChange={updated => updateBlock(b.id, updated)} onDelete={() => deleteBlock(b.id)} onUp={() => moveBlock(b.id, -1)} onDown={() => moveBlock(b.id, 1)} />
              ))}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {BLOCK_TYPES.map(t => (
                  <button key={t} onClick={() => addBlock(t)} style={{ padding: "7px 14px", background: "transparent", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.5)", fontSize: 10, cursor: "pointer", ...HN, letterSpacing: ".06em", textTransform: "uppercase", borderRadius: 2 }}>+ {t}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.featured || false} onChange={e => setForm({ ...form, featured: e.target.checked })} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", letterSpacing: ".04em" }}>Featured</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.ready || false} onChange={e => setForm({ ...form, ready: e.target.checked })} />
                <span style={{ fontSize: 11, color: form.ready ? "#fff" : "rgba(255,255,255,.45)", letterSpacing: ".04em", fontWeight: form.ready ? 700 : 400 }}>Ready ✓</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveProject} style={{ padding: "11px 28px", background: "#fff", color: "#000", border: "none", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", ...HN }}>
                {saving ? "Saving..." : "Save project"}
              </button>
              <button onClick={() => { setEditId(null); setForm(null); }} style={{ padding: "11px 20px", background: "transparent", color: "rgba(255,255,255,.4)", border: "1px solid rgba(255,255,255,.1)", fontSize: 10, cursor: "pointer", ...HN, borderRadius: 2 }}>Cancel</button>
            </div>
          </div>
        )}

        {tab === "seo" && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em" }}>SEO & Meta</h2>
              {saved && <span style={{ fontSize: 10, color: "#4caf86", letterSpacing: ".07em", textTransform: "uppercase" }}>✓ Saved</span>}
            </div>
            <div style={{ background: "#fff", borderRadius: 4, padding: 18, marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: "#999", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>Google preview</div>
              <div style={{ fontSize: 17, color: "#1a0dab", marginBottom: 3, fontFamily: "Arial, sans-serif" }}>{seoForm.metaTitle || "Your title"}</div>
              <div style={{ fontSize: 12, color: "#006621", marginBottom: 3, fontFamily: "Arial, sans-serif" }}>yourwebsite.com</div>
              <div style={{ fontSize: 13, color: "#545454", lineHeight: 1.5, fontFamily: "Arial, sans-serif" }}>{seoForm.metaDesc || "Your description"}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[{ k: "siteName", l: "Site name" }, { k: "tagline", l: "Tagline" }, { k: "metaTitle", l: "Meta title", max: 60 }, { k: "email", l: "Email" }, { k: "instagramUrl", l: "Instagram URL" }, { k: "whatsappUrl", l: "WhatsApp URL (wa.me/...)" }, { k: "behance", l: "Behance" }, { k: "ogImage", l: "OG image URL" }, { k: "adminPassword", l: "Admin password" }].map(({ k, l, max }) => (
                <div key={k}>
                  <label style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
                    <span>{l}</span>
                    {max && <span style={{ color: (seoForm[k]?.length || 0) > max ? "rgba(255,80,80,.8)" : "rgba(255,255,255,.25)", textTransform: "none", letterSpacing: 0 }}>{seoForm[k]?.length || 0}/{max}</span>}
                  </label>
                  <input value={seoForm[k] || ""} onChange={e => setSeoForm({ ...seoForm, [k]: e.target.value })} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
                  <span>Meta description</span>
                  <span style={{ color: (seoForm.metaDesc?.length || 0) > 160 ? "rgba(255,80,80,.8)" : "rgba(255,255,255,.25)", textTransform: "none", letterSpacing: 0 }}>{seoForm.metaDesc?.length || 0}/160</span>
                </label>
                <textarea value={seoForm.metaDesc || ""} onChange={e => setSeoForm({ ...seoForm, metaDesc: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <button onClick={saveSeo} style={{ alignSelf: "flex-start", padding: "11px 28px", background: "#fff", color: "#000", border: "none", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", ...HN }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {tab === "contacts" && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em", marginBottom: 8 }}>Inbox</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 28, lineHeight: 1.7 }}>Form submissions appear here. Connect to a backend or email service in production.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { name: "Anna Morozova", email: "anna@studio.ru", msg: "I'd like to discuss a brand identity for a new restaurant.", time: "2h ago" },
                { name: "Ivan Petrov", email: "ivan@tech.co", msg: "Looking for a mobile app redesign — available for Q3?", time: "yesterday" },
                { name: "Maria Garcia", email: "m.garcia@brand.es", msg: "Interested in packaging design collaboration.", time: "3 days ago" },
              ].map((c, i) => (
                <div key={i} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,.06)", padding: "16px 18px", display: "flex", gap: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.3)", flexShrink: 0 }}>{c.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.name}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>{c.time}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginBottom: 6 }}>{c.email}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.5 }}>{c.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [seo, setSeo] = useState(DEFAULT_SEO);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dbProjects, dbSeo] = await Promise.all([db.getProjects(), db.getSettings()]);
        if (dbProjects.length > 0) setProjects(dbProjects);
        if (dbSeo) setSeo({ ...DEFAULT_SEO, ...dbSeo });
      } catch (e) { console.error("DB load error:", e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.2)", letterSpacing: ".1em", textTransform: "uppercase", ...HN }}>Loading...</div>
    </div>
  );

  if (isAdmin) return <AdminPanel projects={projects} setProjects={setProjects} seo={seo} setSeo={setSeo} onBack={() => setIsAdmin(false)} />;
  return <PublicSite projects={projects} seo={seo} onAdmin={() => setIsAdmin(true)} />;
}
