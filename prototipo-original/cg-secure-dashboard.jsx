/* ============================================================
   DASHBOARD SEGURO — Portada con logo + atajo de teclado
   ============================================================ */

const { useEffect, useState } = React;

function SecureDashboardScreen({ children }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Atajo: Ctrl+Shift+C (o Cmd+Shift+C en Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyC") {
        e.preventDefault();
        setRevealed(!revealed);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed]);

  if (!revealed) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        {/* FONDO DIFUMINADO CON LOGO */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><text x=%22100%22 y=%22100%22 font-size=%2280%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22rgba(255,255,255,0.03)%22>CG</text></svg>')",
            backgroundRepeat: "repeat",
            backgroundSize: "400px 400px",
            filter: "blur(2px)",
            opacity: 0.5,
          }}
        ></div>

        {/* CONTENIDO CENTRAL */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* LOGO GRANDE */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ff6b35 0%, #cc2200 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 700,
              color: "#fff",
              boxShadow: "0 20px 60px rgba(255, 107, 53, 0.4)",
            }}
          >
            CG
          </div>

          {/* TEXTO */}
          <div>
            <h1
              style={{
                margin: "0 0 8px 0",
                fontSize: 32,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.5px",
              }}
            >
              Cárnicos Gustavo
            </h1>
            <p
              style={{
                margin: "0 0 20px 0",
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.5px",
              }}
            >
              Sistema de Gestión
            </p>
          </div>

          {/* INSTRUCCIÓN */}
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(10px)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 500,
              }}
            >
              Presiona <kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 3, fontFamily: "monospace", fontSize: 11 }}>Ctrl</kbd> + <kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 3, fontFamily: "monospace", fontSize: 11 }}>Shift</kbd> + <kbd style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 3, fontFamily: "monospace", fontSize: 11 }}>C</kbd> para acceder
            </p>
          </div>

          {/* INDICADOR ANIMADO */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ff6b35",
                animation: "pulse 2s infinite",
              }}
            ></div>
            Sistema listo
          </div>
        </div>

        {/* CSS ANIMATION */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return children;
}

// Export para que la app pueda usarlo
Object.assign(window, { SecureDashboardScreen });
