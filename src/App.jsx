import { useState } from 'react'
import ALTOBrowser from './ALTOBrowser'
import ALTOLessons from './ALTOLessons'

const VIEWS = [
  { id: "spec", label: "Spec Browser" },
  { id: "lessons", label: "Design Lessons" },
];

function App() {
  const [view, setView] = useState("spec");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0",
        background: "#050810", borderBottom: "1px solid #0F172A",
        padding: "0 20px", flexShrink: 0, zIndex: 10
      }}>
        <div style={{
          fontSize: "13px", fontWeight: 800, color: "#38BDF8",
          letterSpacing: "-0.02em", padding: "10px 16px 10px 0",
          borderRight: "1px solid #0F172A", marginRight: "4px",
          fontFamily: "'DM Mono', 'IBM Plex Mono', monospace"
        }}>
          ALTO
        </div>
        {VIEWS.map(v => (
          <div
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              padding: "10px 14px", cursor: "pointer",
              fontSize: "11px", fontWeight: view === v.id ? 700 : 400,
              color: view === v.id ? "#38BDF8" : "#475569",
              borderBottom: `2px solid ${view === v.id ? "#38BDF8" : "transparent"}`,
              fontFamily: "'DM Mono', 'IBM Plex Mono', monospace",
              letterSpacing: "0.02em", transition: "all 0.12s"
            }}
          >
            {v.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "spec" && <ALTOBrowser />}
        {view === "lessons" && <ALTOLessons />}
      </div>
    </div>
  );
}

export default App
