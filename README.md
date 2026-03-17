# ALTO — Aerial Logistics & Transit Open-standard

**Version 0.1 — Draft for Public Comment**

ALTO is an open data standard for drones and aerial vehicles. It fills the consumer and operational data layer absent from existing FAA/ICAO safety frameworks — covering routes, vertiports, ETAs, delivery tracking, and cross-operator roaming.

## What ALTO Covers

| Layer | Existing Standards | Gap ALTO Fills |
|-------|-------------------|----------------|
| Identity broadcast | ASTM F3411 (Remote ID) | Schedules, routes, delivery status |
| Airspace deconfliction | InterUSS DSS / ASTM F3548 | Consumer data, cargo, vertiports |
| Drone registry | Flight registration databases | Operational feeds, ETAs |
| Traffic management | FAA/ICAO UTM | API-level interoperability |
| **Consumer + ops data** | **Nothing — until ALTO** | **Routes, ETAs, delivery, roaming** |

## Quick Start

```bash
npm install
npm run dev
```

The interactive spec browser runs at `http://localhost:5173` with two views:

- **Spec Browser** — navigate the full ALTO spec: static feeds, realtime feeds, delivery extension, roaming API, and compliance mapping
- **Design Lessons** — 14 spec design issues sourced from prior mobility standard failures, mapped to ALTO-specific risks with severity ratings and recommendations

## Spec Structure

### Static Feeds (ZIP bundle or JSON directory)

```
alto_feed/
  feed_info.json        — Feed metadata and ALTO version
  agency.json           — Operator identity and UTM registration
  vehicles.json         — Fleet registry (class, payload, certifications)
  vertiports.json       — Ground nodes (pads, hubs, delivery points)
  corridors.json        — Aerial routes with 3D waypoints
  flight_patterns.json  — Scheduled/on-demand flight windows
  altitude_zones.json   — Airspace constraints (optional)
  landing_zones.json    — Delivery endpoint profiles (optional)
```

### Realtime Feeds (JSON polling or WebSocket)

| Endpoint | Purpose | Update Rate |
|----------|---------|-------------|
| `GET /vehicle_positions` | Live 3D position, heading, speed, battery | ≤ 1s (private) / 5s (public) |
| `GET /flight_updates` | ETA changes, delays, progress | ≤ 30s |
| `GET /alerts` | Weather holds, airspace closures, faults | Event-driven |

### Delivery Extension

Full cargo lifecycle: `created → queued → loading → picked_up → in_flight → approach → hovering_delivery → delivered`

Includes the **Delivery Result Record (DRR)** — an immutable completion record for billing, audit, and carbon accounting.

### Roaming API

Cross-operator delivery handoffs at neutral interchange vertiports:

- `POST /roaming/register` — Register as an ALTO peer
- `POST /roaming/handoff` — Request delivery handoff to partner
- `GET /roaming/operators` — Network directory

## Examples

### Create a delivery

```json
POST /alto/v1/deliveries
{
  "delivery_id": "DEL-2025-SKY-88821",
  "pickup": { "vertiport_id": "SFO-DOCK-01", "scheduled_time": "2025-06-01T14:30:00Z" },
  "dropoff": {
    "vertiport_id": "SOMA-DROP-07",
    "landing_zone_id": "LZ-SOMA-RES-0042",
    "lat": 37.7849, "lon": -122.3960,
    "contact_code": "RING-2B"
  },
  "cargo": {
    "weight_kg": 0.85,
    "category": "retail_general",
    "fragile": true,
    "declared_value_usd": 120.00
  }
}
```

### Multi-phase delivery (aerial + ground handoff)

```json
{
  "delivery_id": "DEL-2025-SKY-99301",
  "phases": [
    {
      "phase_seq": 1,
      "phase_type": "AERIAL_TRANSIT",
      "vehicle_id": "sky-fw-012",
      "corridor_id": "CORR-HUB-SUBURB-07",
      "distance_km": 18.2
    },
    {
      "phase_seq": 2,
      "phase_type": "HOVER_HANDOFF",
      "handoff": {
        "handoff_type": "tethered_lower",
        "receiving_vehicle_id": "sky-gnd-088",
        "custody_transfer_timestamp": "2025-06-01T14:38:45Z"
      }
    },
    {
      "phase_seq": 3,
      "phase_type": "GROUND_DELIVERY",
      "vehicle_id": "sky-gnd-088",
      "distance_km": 0.8
    }
  ]
}
```

### Weather hold alert

```json
{
  "alert_type": "weather_hold",
  "severity": "severe",
  "weather_status": "NO_GO",
  "current_conditions": {
    "wind_sustained_kts": 32,
    "wind_gust_kts": 42,
    "visibility_m": 600
  },
  "affected_corridors": ["CORR-SFO-SOMA-01"],
  "weather_hold": {
    "hold_reason": "Wind gusts exceeding 35 kts at cruise altitude",
    "estimated_resume_time": "2025-06-01T17:00:00Z",
    "auto_cancel_after_sec": 10800
  }
}
```

### Ground clearance check (realtime)

```json
{
  "ground_clearance": {
    "clearance_method": "visual_camera",
    "clearance_status": "ANIMAL_DETECTED",
    "abort_reason": "Dog detected in landing zone — holding at 50ft"
  },
  "ground_exclusion_zone": {
    "type": "circle",
    "center": { "lat": 37.7849, "lon": -122.3960 },
    "radius_m": 15
  }
}
```

### Delivery Result Record (DRR)

```json
{
  "drr_id": "DRR-2025-SKY-88821",
  "delivery_id": "DEL-2025-SKY-88821",
  "duration_sec": 1177,
  "distance_km": 22.1,
  "energy_kwh": 0.12,
  "outcome": "success",
  "sla_met": true,
  "co2_saved_vs_truck_g": 420,
  "weather_at_departure": { "wind_kts": 12, "visibility_m": 5000, "temp_c": 18 },
  "weather_at_arrival": { "wind_kts": 18, "visibility_m": 3200, "temp_c": 16 },
  "delivery_incident": { "incident_type": "none" }
}
```

## Spec Files

| File | Description |
|------|-------------|
| [`spec/ALTO-v0.1.md`](spec/ALTO-v0.1.md) | Full specification document |
| [`spec/openapi.yaml`](spec/openapi.yaml) | OpenAPI 3.0.3 schema for REST endpoints |

## Design Principles

1. **Open by default** — Apache 2.0, no license fees
2. **Static + Realtime** — Static feeds for planning, realtime for operations
3. **REST + JSON** — Protobuf bindings optional for high-throughput telemetry
4. **Modular extensions** — Core + opt-in Delivery, AAM Passenger, Inspection
5. **Privacy-preserving** — No PII in public feeds
6. **3D-native** — Altitude is a first-class field
7. **Complements UTM** — References Remote ID and InterUSS, doesn't replace them

## License

Apache 2.0
