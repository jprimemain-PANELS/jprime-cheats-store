export function StoreBanned() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui,sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }} aria-hidden>🚫</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>This website is banned by the admin</h1>
        <p style={{ opacity: 0.65, fontSize: 15, lineHeight: 1.5 }}>This store is not available right now. If you think this is a mistake, please contact the platform owner.</p>
      </div>
    </div>
  );
}
