export default function AdminLoading() {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "var(--bg-primary)",
    }}>
      {/* Sidebar skeleton */}
      <div style={{
        width: 200,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{
          height: 28,
          width: 120,
          borderRadius: 8,
          background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          marginBottom: 24,
        }} />
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: 32 }}>
        <div style={{
          height: 32,
          width: 180,
          borderRadius: 8,
          background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          marginBottom: 24,
        }} />
        <div style={{ display: "flex", gap: 16 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              flex: 1,
              height: 100,
              borderRadius: 12,
              background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
