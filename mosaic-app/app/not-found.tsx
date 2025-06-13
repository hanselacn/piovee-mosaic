export default function NotFound() {
  return (
    <div
      style={{ minHeight: "100vh", backgroundColor: "#111827", padding: "2rem", color: "white", textAlign: "center" }}
    >
      <div style={{ maxWidth: "48rem", margin: "0 auto", paddingTop: "10rem" }}>
        <div style={{ fontSize: "6rem", marginBottom: "2rem" }}>404</div>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Page Not Found</h1>
        <p style={{ color: "#9ca3af", marginBottom: "2rem" }}>The page you are looking for does not exist.</p>
        <a
          href="/"
          style={{
            backgroundColor: "#3b82f6",
            color: "white",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.375rem",
            textDecoration: "none",
          }}
        >
          Go to Home
        </a>
      </div>
    </div>
  )
}
