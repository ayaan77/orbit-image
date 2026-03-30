export default function Loading() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "var(--bg-primary)",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.06)",
        borderTopColor: "#8b5cf6",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{
        color: "var(--text-muted)",
        fontSize: "14px",
        letterSpacing: "0.02em",
      }}>Loading Orbit Image...</span>
    </div>
  );
}
