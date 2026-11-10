export function StoreMoved({ name, to }: { name: string; to: string }) {
  const url = `https://${to}`;
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "system-ui,sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>{name} has a new website</h1>
        <p style={{ opacity: 0.7, fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>This website has changed to a new address. Click the new website link below and visit.</p>
        <a href={url} style={{ display: "inline-block", background: "#7c3aed", color: "#fff", padding: "12px 22px", borderRadius: 12, fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}>{to}</a>
        <p style={{ opacity: 0.45, fontSize: 12, marginTop: 16 }}>Your account and wallet are the same. Just log in again on the new website.</p>
      </div>
    </div>
  );
}
