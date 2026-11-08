export function StoreNotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui,sans-serif", padding: 24, textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Store not found</h1>
        <p style={{ opacity: 0.6, fontSize: 14 }}>This address is not an active store.</p>
      </div>
    </div>
  );
}
