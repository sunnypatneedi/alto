import { useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: "\u25C8" },
  { id: "static", label: "Static Feeds", icon: "\u2B21" },
  { id: "realtime", label: "Realtime Feeds", icon: "\u25C9" },
  { id: "delivery", label: "Delivery Extension", icon: "\u25B2" },
  { id: "roaming", label: "Roaming API", icon: "\u27F3" },
  { id: "compliance", label: "Compliance Map", icon: "\u229E" },
];

const GAP_DATA = [
  { standard: "ASTM F3411 (Remote ID)", covers: "Drone identity broadcast over BT/WiFi", gap: "No routes, schedules, cargo, or consumer feeds" },
  { standard: "InterUSS DSS / ASTM F3548", covers: "USS-to-USS airspace deconfliction", gap: "No delivery data, no vertiports, no ETAs" },
  { standard: "GUTMA Registry", covers: "Fleet registration database", gap: "No operational feeds, no real-time data" },
  { standard: "ICAO/FAA UTM Framework", covers: "Governance + safety framework", gap: "No developer API, no open data format" },
  { standard: "ALTO (This Spec) \u2726", covers: "Routes, vertiports, ETAs, delivery, roaming", gap: "Fills the gap above" },
];

const STATIC_FEEDS = [
  { file: "agency.json", analogy: "Operator identity", purpose: "Operator identity, UTM registration, jurisdiction IDs", keyFields: ["agency_id", "uss_id", "faa_operator_id", "agency_timezone"] },
  { file: "vehicles.json", analogy: "Fleet registry", purpose: "Fleet registry \u2014 class, payload, certifications, capabilities", keyFields: ["vehicle_class", "max_payload_kg", "detect_and_avoid", "certifications"] },
  { file: "vertiports.json", analogy: "Ground nodes", purpose: "Landing pads, hubs, delivery points, charging nodes", keyFields: ["vertiport_type", "pad_count", "charging_type", "weather_constraints"] },
  { file: "corridors.json", analogy: "Aerial routes", purpose: "Established aerial routes with 3D waypoints and altitude profiles", keyFields: ["waypoints[].alt_ft_agl", "altitude_layer", "geofence_buffer_m", "bidirectional"] },
  { file: "flight_patterns.json", analogy: "Flight schedules", purpose: "Scheduled or on-demand recurring flight windows", keyFields: ["service_type", "frequency_min", "operating_days", "window_start"] },
  { file: "altitude_zones.json", analogy: "Airspace constraints", purpose: "Static airspace constraints, exclusion zones (refs UTM geofence)", keyFields: ["zone_type", "alt_floor_ft_agl", "alt_ceiling_ft_agl", "authority"] },
];

const REALTIME_FEEDS = [
  { endpoint: "GET /vehicle_positions", purpose: "Live 3D position, heading, speed, battery, Remote ID status", updateRate: "\u2264 1 sec (private) / 5 sec (public)", keyFields: ["lat/lon/alt_ft_agl", "heading_deg", "speed_kts", "battery_pct", "status"] },
  { endpoint: "GET /flight_updates", purpose: "ETA changes, delays, progress, next vertiport", updateRate: "\u2264 30 sec", keyFields: ["estimated_arrival", "delay_sec", "delay_reason", "progress_pct"] },
  { endpoint: "GET /alerts", purpose: "Weather holds, airspace closures, tech faults, schedule changes", updateRate: "Event-driven", keyFields: ["alert_type", "severity", "affected_corridors", "effect"] },
];

const DELIVERY_STATUSES = [
  { status: "created", color: "#6B7280" },
  { status: "queued", color: "#9CA3AF" },
  { status: "loading", color: "#F59E0B" },
  { status: "picked_up", color: "#F59E0B" },
  { status: "in_flight", color: "#38BDF8" },
  { status: "approach", color: "#818CF8" },
  { status: "hovering_delivery", color: "#818CF8" },
  { status: "delivered", color: "#34D399" },
  { status: "failed", color: "#F87171" },
  { status: "returned", color: "#F87171" },
  { status: "cancelled", color: "#6B7280" },
];

const COMPLIANCE = [
  { alto: "vehicles.json \u2192 remote_id", regulatory: "ASTM F3411-22a", type: "reference" },
  { alto: "vertiports.json \u2192 utm_geo_zone_id", regulatory: "EUROCAE ED-269 / ED-318", type: "reference" },
  { alto: "corridors.json", regulatory: "FAA UTM ConOps corridors", type: "aligned" },
  { alto: "flight_patterns.json", regulatory: "GUTMA Flight Declaration Protocol", type: "aligned" },
  { alto: "alerts \u2192 airspace_closure", regulatory: "LAANC / FAA NOTAM", type: "complement" },
  { alto: "vehicle_positions feed", regulatory: "InterUSS DSS position reporting", type: "complement" },
  { alto: "deliveries + DRR", regulatory: "No existing standard", type: "native" },
  { alto: "roaming API", regulatory: "No existing standard", type: "native" },
];

const ALT_LAYERS = [
  { layer: "A", range: "0\u201350 ft AGL", use: "Ground ops, rooftop loading", color: "#34D399" },
  { layer: "B", range: "50\u2013400 ft AGL", use: "Main delivery layer (ALTO primary)", color: "#38BDF8" },
  { layer: "C", range: "400\u20131,200 ft AGL", use: "AAM transition corridor", color: "#818CF8" },
  { layer: "D", range: "1,200\u20135,000 ft AGL", use: "Advanced AAM, cargo VTOL", color: "#FB923C" },
  { layer: "E", range: "5,000+ ft AGL", use: "High-altitude / BVLOS", color: "#F87171" },
];

const CodeBlock = ({ code }) => (
  <pre style={{
    background: "#060910", color: "#CBD5E1", padding: "16px", borderRadius: "6px",
    fontSize: "11px", lineHeight: "1.7", overflowX: "auto", margin: "12px 0",
    border: "1px solid #1E293B", fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
  }}>
    <code>{code}</code>
  </pre>
);

const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: "3px",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    background: color + "18", color: color, border: `1px solid ${color}35`
  }}>{text}</span>
);

const Tag = ({ text }) => (
  <span style={{
    display: "inline-block", padding: "2px 7px", borderRadius: "3px",
    fontSize: "10px", background: "#0F172A", color: "#64748B",
    border: "1px solid #1E293B", marginRight: "4px", marginTop: "4px",
    fontFamily: "monospace"
  }}>{text}</span>
);

export default function ALTOBrowser() {
  const [active, setActive] = useState("overview");
  const [expandedFeed, setExpandedFeed] = useState(null);

  const accent = "#38BDF8";

  const s = {
    root: { fontFamily: "'DM Mono', 'IBM Plex Mono', monospace", background: "#060910", color: "#CBD5E1", minHeight: "100vh", display: "flex" },
    sidebar: { width: "210px", background: "#080C14", borderRight: "1px solid #0F172A", padding: "28px 0", flexShrink: 0, display: "flex", flexDirection: "column" },
    logo: { padding: "0 20px 24px", borderBottom: "1px solid #0F172A", marginBottom: "16px" },
    logoText: { fontSize: "22px", fontWeight: 800, color: accent, letterSpacing: "-0.03em", lineHeight: 1 },
    logoSub: { fontSize: "9px", color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "4px" },
    navItem: (on) => ({
      display: "flex", alignItems: "center", gap: "10px", padding: "9px 20px",
      cursor: "pointer", fontSize: "11px", fontWeight: on ? 600 : 400,
      color: on ? accent : "#475569",
      background: on ? accent + "0D" : "transparent",
      borderLeft: `2px solid ${on ? accent : "transparent"}`,
      transition: "all 0.12s", letterSpacing: "0.02em"
    }),
    pill: { margin: "auto 20px 20px", padding: "10px 12px", background: "#0F172A", borderRadius: "6px", border: "1px solid #1E293B" },
    main: { flex: 1, padding: "36px 40px", overflowY: "auto", maxHeight: "100vh" },
    h1: { fontSize: "20px", fontWeight: 800, color: "#F1F5F9", marginBottom: "6px", letterSpacing: "-0.025em" },
    h2: { fontSize: "13px", fontWeight: 700, color: "#94A3B8", margin: "28px 0 12px", textTransform: "uppercase", letterSpacing: "0.1em" },
    sub: { fontSize: "12px", color: "#475569", marginBottom: "24px", lineHeight: 1.6 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "11.5px", marginBottom: "20px" },
    th: { textAlign: "left", padding: "8px 12px", background: "#0D1526", color: "#475569", fontWeight: 700, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid #0F172A" },
    td: { padding: "9px 12px", borderBottom: "1px solid #0D1526", color: "#94A3B8", verticalAlign: "top", lineHeight: 1.5 },
    card: { background: "#0A1020", border: "1px solid #0F172A", borderRadius: "6px", padding: "16px", marginBottom: "10px" },
  };

  const sampleVehicle = `{
  "vehicle_id": "sky-x2-007",
  "vehicle_class": "delivery_drone",
  "vehicle_type": "fixed_wing_vtol",
  "remote_id": "ASTM-F3411-SN-ABC123",
  "max_payload_kg": 1.5,
  "endurance_min": 45,
  "detect_and_avoid": true,
  "certifications": ["FAA_Part107"]
}`;

  const sampleVertiport = `{
  "vertiport_id": "SFO-DOCK-01",
  "vertiport_type": "distribution_hub",
  "lat": 37.6213, "lon": -122.3790, "elevation_m": 4.0,
  "pad_count": 4,
  "charging_available": true,
  "weather_constraints": {
    "max_wind_kts": 25, "min_visibility_m": 800
  },
  "utm_geo_zone_id": "UTM-ZONE-KSFO-05"
}`;

  const samplePosition = `{
  "vehicle_id": "sky-x2-007",
  "position": {
    "lat": 37.7100, "lon": -122.4050,
    "alt_ft_agl": 298, "heading_deg": 352,
    "speed_kts": 48, "climb_rate_fpm": 0
  },
  "status": "in_flight",
  "battery_pct": 67,
  "remote_id_active": true
}`;

  const sampleDelivery = `POST /alto/v1/deliveries
{
  "delivery_id": "DEL-2025-SKY-88821",
  "cargo": {
    "weight_kg": 0.85,
    "category": "retail_general",
    "fragile": true, "hazmat": false
  },
  "pickup":  { "vertiport_id": "SFO-DOCK-01" },
  "dropoff": { "vertiport_id": "SOMA-DROP-07",
               "lat": 37.7849, "lon": -122.3960 },
  "notify_webhook": "https://retailer.example.com/webhooks"
}`;

  return (
    <div style={s.root}>
      <nav style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoText}>ALTO</div>
          <div style={s.logoSub}>Aerial Logistics & Transit Open-standard</div>
        </div>
        {SECTIONS.map(sec => (
          <div key={sec.id} style={s.navItem(active === sec.id)} onClick={() => setActive(sec.id)}>
            <span style={{ opacity: 0.7 }}>{sec.icon}</span>
            <span>{sec.label}</span>
          </div>
        ))}
        <div style={s.pill}>
          <div style={{ fontSize: "9px", color: accent, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "6px" }}>VERSION</div>
          <div style={{ fontSize: "11px", color: "#94A3B8" }}>v0.1 Draft</div>
          <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px" }}>Open for comment</div>
          <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px" }}>apache-2.0-license</div>
        </div>
      </nav>

      <main style={s.main}>

        {active === "overview" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <h1 style={s.h1}>Aerial Logistics & Transit Open-standard</h1>
              <Badge text="v0.1" color={accent} />
            </div>
            <p style={s.sub}>
              ALTO is an open data standard for drones and aerial vehicles.
              It fills the consumer and operational data layer absent from all existing FAA/ICAO safety frameworks.
            </p>

            <h2 style={s.h2}>The Gap ALTO Fills</h2>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Existing Standard</th>
                <th style={s.th}>What It Covers</th>
                <th style={s.th}>What&#39;s Missing</th>
              </tr></thead>
              <tbody>
                {GAP_DATA.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, color: row.standard.includes("ALTO") ? accent : "#94A3B8", fontWeight: row.standard.includes("ALTO") ? 700 : 400 }}>{row.standard}</td>
                    <td style={s.td}>{row.covers}</td>
                    <td style={{ ...s.td, color: row.standard.includes("ALTO") ? "#34D399" : "#334155" }}>{row.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={s.h2}>Design Principles</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "28px" }}>
              {[
                ["Open by Default", "Apache 2.0. No license fees. GitHub-hosted at openalto-spec/alto."],
                ["Static + Realtime", "Static feeds for planning. Realtime polling/WebSocket for ops."],
                ["3D-Native", "Altitude is a first-class field \u2014 not retrofitted."],
                ["Modular Extensions", "Core + opt-in Delivery, AAM Passenger, Inspection modules."],
                ["Privacy-Preserving", "No PII in public feeds. Operator-level data only."],
                ["Complements UTM", "References Remote ID + InterUSS. Does not replace them."],
              ].map(([title, desc]) => (
                <div key={title} style={s.card}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: accent, marginBottom: "4px" }}>{title}</div>
                  <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>

            <h2 style={s.h2}>Altitude Layer Model</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {ALT_LAYERS.map(l => (
                <div key={l.layer} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "4px", background: l.color + "20", border: `1px solid ${l.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: l.color, flexShrink: 0 }}>{l.layer}</div>
                  <div style={{ width: "100px", fontSize: "10px", color: "#94A3B8", fontWeight: 600 }}>{l.range}</div>
                  <div style={{ flex: 1, height: "6px", background: l.color + "20", borderRadius: "2px", border: `1px solid ${l.color}30` }} />
                  <div style={{ width: "220px", fontSize: "11px", color: "#475569" }}>{l.use}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "static" && (
          <div>
            <h1 style={s.h1}>Static Feeds</h1>
            <p style={s.sub}>Published as a ZIP bundle or JSON directory. Describes the planned structure of aerial operations.</p>

            <div style={{ ...s.card, fontSize: "11px", color: "#475569", marginBottom: "20px" }}>
              <span style={{ color: accent, fontFamily: "monospace" }}>alto_feed.zip</span>
              {" \u2192 "}
              {["feed_info.json", "agency.json", "vehicles.json", "vertiports.json", "corridors.json", "flight_patterns.json", "altitude_zones.json"].map(f => (
                <span key={f} style={{ color: "#64748B", marginRight: "6px" }}>{f}</span>
              ))}
            </div>

            {STATIC_FEEDS.map((feed, i) => (
              <div key={feed.file} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                  onClick={() => setExpandedFeed(expandedFeed === i ? null : i)}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: accent, marginBottom: "4px", fontFamily: "monospace" }}>{feed.file}</div>
                    <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "6px" }}>{feed.purpose}</div>
                    <Badge text={feed.analogy} color="#475569" />
                  </div>
                  <span style={{ color: "#334155" }}>{expandedFeed === i ? "\u25B4" : "\u25BE"}</span>
                </div>
                {expandedFeed === i && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #0F172A", paddingTop: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Key fields</div>
                    <div style={{ marginBottom: "8px" }}>{feed.keyFields.map(f => <Tag key={f} text={f} />)}</div>
                    {feed.file === "vehicles.json" && <CodeBlock code={sampleVehicle} />}
                    {feed.file === "vertiports.json" && <CodeBlock code={sampleVertiport} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {active === "realtime" && (
          <div>
            <h1 style={s.h1}>Realtime Feeds</h1>
            <p style={s.sub}>JSON polling or WebSocket. Protobuf bindings optional for high-frequency telemetry.</p>
            <div style={{ fontSize: "11px", color: "#334155", marginBottom: "20px" }}>
              Base path: <span style={{ color: accent, fontFamily: "monospace" }}>https://&#123;operator&#125;/alto/v1/realtime/</span>
            </div>

            {REALTIME_FEEDS.map(feed => (
              <div key={feed.endpoint} style={s.card}>
                <div style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#38BDF8", marginBottom: "6px" }}>{feed.endpoint}</div>
                <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "6px" }}>{feed.purpose}</div>
                <div style={{ fontSize: "11px", color: "#334155", marginBottom: "8px" }}>
                  Update rate: <span style={{ color: "#FB923C" }}>{feed.updateRate}</span>
                </div>
                <div>{feed.keyFields.map(f => <Tag key={f} text={f} />)}</div>
              </div>
            ))}

            <h2 style={s.h2}>Sample: Vehicle Position</h2>
            <CodeBlock code={samplePosition} />

            <h2 style={s.h2}>Vehicle Status States</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {[
                { s: "pre_flight", c: "#94A3B8" }, { s: "in_flight", c: "#38BDF8" }, { s: "hovering", c: "#818CF8" },
                { s: "landing", c: "#FB923C" }, { s: "charging", c: "#34D399" }, { s: "grounded", c: "#475569" }, { s: "emergency", c: "#F87171" }
              ].map(({ s: st, c }) => <Badge key={st} text={st} color={c} />)}
            </div>
          </div>
        )}

        {active === "delivery" && (
          <div>
            <h1 style={s.h1}>Delivery Extension</h1>
            <p style={s.sub}>Cargo lifecycle from order to confirmed drop. No equivalent open standard exists today.</p>

            <h2 style={s.h2}>Lifecycle</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center", marginBottom: "24px" }}>
              {DELIVERY_STATUSES.map((ds, i) => (
                <span key={ds.status} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <Badge text={ds.status} color={ds.color} />
                  {i < DELIVERY_STATUSES.length - 1 && i !== 7 && <span style={{ color: "#1E293B" }}>&rsaquo;</span>}
                </span>
              ))}
            </div>

            <h2 style={s.h2}>Create Delivery Session</h2>
            <CodeBlock code={sampleDelivery} />

            <h2 style={s.h2}>Cargo Categories</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "20px" }}>
              {["retail_general","retail_food","retail_pharmacy","retail_alcohol","medical_supply","medical_specimen","documents","electronics","temperature_sensitive","hazmat_class_1\u20139"].map(c => <Tag key={c} text={c} />)}
            </div>

            <h2 style={s.h2}>Delivery Result Record (DRR)</h2>
            <p style={{ fontSize: "11px", color: "#475569", marginBottom: "12px" }}>Immutable completion record. Enables billing, audit, and carbon accounting.</p>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Field</th><th style={s.th}>Example</th><th style={s.th}>Purpose</th>
              </tr></thead>
              <tbody>
                {[
                  ["drr_id", "DRR-2025-SKY-88821", "Immutable record ID"],
                  ["duration_sec", "1177", "Total delivery time"],
                  ["distance_km", "22.1", "Actual route flown"],
                  ["energy_kwh", "0.12", "Energy consumed \u2014 billing + carbon"],
                  ["co2_saved_vs_truck_g", "420", "Sustainability metric"],
                  ["sla_met", "true", "SLA compliance flag"],
                  ["delivery_proof", "photo URL + timestamp", "Proof of delivery"],
                ].map(([f, e, p]) => (
                  <tr key={f}>
                    <td style={{ ...s.td, fontFamily: "monospace", color: accent, fontSize: "11px" }}>{f}</td>
                    <td style={{ ...s.td, color: "#64748B" }}>{e}</td>
                    <td style={{ ...s.td, color: "#475569" }}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {active === "roaming" && (
          <div>
            <h1 style={s.h1}>Roaming API</h1>
            <p style={s.sub}>Cross-operator interoperability — enables one operator to hand off a delivery to a partner operator at a neutral interchange vertiport.</p>

            <h2 style={s.h2}>Concept Mapping</h2>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Roaming Concept</th><th style={s.th}>ALTO Equivalent</th></tr></thead>
              <tbody>
                {[
                  ["Charging station", "Vertiport"],
                  ["Location / coverage", "Vertiport + Corridor"],
                  ["Usage session", "Flight / Delivery Session"],
                  ["Billing record", "Delivery Result Record (DRR)"],
                  ["Auth token", "Operator peer credential"],
                  ["Hub / directory", "ALTO Network Directory"],
                ].map(([o, a]) => (
                  <tr key={o}>
                    <td style={s.td}>{o}</td>
                    <td style={{ ...s.td, color: accent, fontWeight: 600 }}>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={s.h2}>Endpoints</h2>
            {[
              ["POST /roaming/register", "Register as an ALTO peer \u2014 share endpoint, coverage, supported modules"],
              ["POST /roaming/handoff", "Request a delivery handoff to a partner operator"],
              ["GET /roaming/operators", "Network directory of all registered ALTO operators"],
              ["GET /roaming/coverage", "GeoJSON coverage polygon for this operator\u2019s network"],
            ].map(([ep, desc]) => (
              <div key={ep} style={s.card}>
                <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: "#38BDF8", marginBottom: "4px" }}>{ep}</div>
                <div style={{ fontSize: "11px", color: "#475569" }}>{desc}</div>
              </div>
            ))}

            <h2 style={s.h2}>Auth Model</h2>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Mechanism</th><th style={s.th}>Use</th></tr></thead>
              <tbody>
                {[
                  ["OAuth 2.0 Client Credentials", "Operator-to-operator API calls"],
                  ["Bearer Token", "Realtime feed access"],
                  ["SHA-256 Feed Manifests", "Static feed integrity verification"],
                  ["Webhook HMAC", "Delivery event push notifications"],
                ].map(([m, u]) => (
                  <tr key={m}>
                    <td style={{ ...s.td, fontFamily: "monospace", fontSize: "11px", color: "#FB923C" }}>{m}</td>
                    <td style={{ ...s.td, color: "#475569" }}>{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {active === "compliance" && (
          <div>
            <h1 style={s.h1}>Compliance Mapping</h1>
            <p style={s.sub}>ALTO complements — not replaces — existing UTM safety standards. Every ALTO object has a clear regulatory relationship.</p>

            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>ALTO Object</th>
                <th style={s.th}>Regulatory Reference</th>
                <th style={s.th}>Relationship</th>
              </tr></thead>
              <tbody>
                {COMPLIANCE.map(row => (
                  <tr key={row.alto}>
                    <td style={{ ...s.td, fontFamily: "monospace", color: accent, fontSize: "11px" }}>{row.alto}</td>
                    <td style={s.td}>{row.regulatory}</td>
                    <td style={s.td}>
                      <Badge
                        text={row.type}
                        color={row.type === "reference" ? "#38BDF8" : row.type === "aligned" ? "#818CF8" : row.type === "complement" ? "#FB923C" : "#34D399"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
              {[["reference", "#38BDF8", "ALTO field points to existing standard"], ["aligned", "#818CF8", "ALTO concept maps to existing framework"], ["complement", "#FB923C", "ALTO extends an existing feed"], ["native", "#34D399", "ALTO fills a gap with no prior standard"]].map(([t, c, d]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "#475569" }}>
                  <Badge text={t} color={c} />{d}
                </div>
              ))}
            </div>

            <h2 style={s.h2}>Roadmap</h2>
            {[
              { v: "0.1", label: "Current", color: accent, target: "2025 Q1", items: "Core spec: agency, vehicles, vertiports, corridors, flights, delivery extension" },
              { v: "0.2", label: "Planned", color: "#475569", target: "2025 Q3", items: "Community feedback, finalized delivery extension, validator CLI" },
              { v: "0.3", label: "Planned", color: "#475569", target: "2026 Q1", items: "AAM Passenger Extension, inspection module stub" },
              { v: "1.0", label: "Target", color: "#34D399", target: "2026 Q4", items: "Stable release \u2014 submit to ASTM / GUTMA for ratification" },
            ].map(row => (
              <div key={row.v} style={{ ...s.card, display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: row.color, width: "28px", flexShrink: 0, letterSpacing: "-0.03em" }}>v{row.v}</div>
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "4px", alignItems: "center" }}>
                    <Badge text={row.label} color={row.color} />
                    <span style={{ fontSize: "10px", color: "#334155" }}>{row.target}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>{row.items}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
