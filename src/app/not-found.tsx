import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary, #09090b)",
        color: "var(--text-primary, #fafafa)",
        fontFamily: "var(--font-sans, system-ui)",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "72px",
          fontWeight: 700,
          background: "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
        }}
      >
        404
      </div>
      <p style={{ color: "#a1a1aa", fontSize: "16px", maxWidth: "400px" }}>
        This page doesn&apos;t exist. It may have been moved or deleted.
      </p>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <Link
          href="/"
          style={{
            padding: "8px 20px",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Go to Dashboard
        </Link>
        <Link
          href="/studio"
          style={{
            padding: "8px 20px",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#a1a1aa",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          Try Studio
        </Link>
      </div>
    </div>
  );
}
