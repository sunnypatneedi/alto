# ALTO: Aerial Logistics & Transit Open-standard

**Version 0.1 — Draft for Public Comment**

> Fills the gap between FAA/ICAO safety frameworks and developer-ready open data feeds.
> Inspired by lessons from ground transit and EV charging interoperability standards.

-----

## 0. Preamble

### Why ALTO Exists

|Layer                  |Existing Standard        |What It Solves            |What It Misses                              |
|-----------------------|-------------------------|--------------------------|--------------------------------------------|
|Identity broadcast     |ASTM F3411 (Remote ID)   |"What drone is that?" (RF)|Schedules, routes, delivery status          |
|Airspace deconfliction |InterUSS DSS / ASTM F3548|USS-to-USS safety sync    |Consumer data, cargo, vertiports            |
|Drone registry         |GUTMA Registry           |Fleet registration        |Operational feeds, ETAs                     |
|Traffic management     |FAA/ICAO UTM             |Governance framework      |API-level interoperability                  |
|**Consumer + ops data**|**Nothing**              |—                         |**Routes, ETAs, delivery tracking, roaming**|

ALTO occupies the application layer. It does not replace Remote ID or UTM — it sits above them, exactly as ground transit data standards sit above traffic signal protocols.

### Design Principles

1. **Open by default.** Apache 2.0. No license fees.
1. **Static + Realtime.** Static feeds describe what *should* happen; realtime feeds describe what *is* happening.
1. **REST + JSON.** No proprietary encoding. Protobuf bindings optional for high-throughput realtime.
1. **Modular extensions.** Core spec + optional extension modules (Delivery, AAM/Passenger, Inspection).
1. **Privacy-preserving.** No PII in public feeds. Operator-level not pilot-level data.
1. **3D-native.** Altitude is a first-class field, not an afterthought.
1. **Complements UTM.** ALTO feeds reference UTM operation IDs where applicable. Not a replacement.

-----

## 1. Concepts and Terminology

|Term                 |Definition                                                                 |
|---------------------|---------------------------------------------------------------------------|
|**Operator**         |An entity authorized to operate aerial vehicles (equiv. to transit agency) |
|**Vehicle**          |A registered aerial vehicle — drone, AAM, cargo VTOL                       |
|**Vertiport**        |A ground node for takeoff/landing/charging/loading (equiv. to transit stop)|
|**Corridor**         |An established aerial route between two points (equiv. to transit route)   |
|**Flight**           |A single scheduled or on-demand trip along a corridor                      |
|**Segment**          |One leg of a multi-hop flight                                              |
|**Altitude Layer**   |A vertical band within which a flight operates                             |
|**USS**              |UAS Service Supplier — existing UTM concept, referenced by ALTO            |
|**Delivery Session** |A cargo pickup-to-delivery event (delivery extension only)                 |
|**Vertiport Network**|A collection of vertiports under one operator or region                    |

-----

## 2. ALTO Static Feeds

Static feeds are published as a ZIP bundle or as a directory of JSON files. They describe the planned, recurring structure of an aerial operation — analogous to a transit static dataset.

### 2.1 `agency.json`

Describes the operating entity.

```json
{
  "agency_id": "alto-demo-operator",
  "agency_name": "SkyOps Delivery — US West",
  "agency_url": "https://skyops-example.com",
  "agency_timezone": "America/Los_Angeles",
  "agency_lang": "en",
  "agency_phone": "+1-800-555-0100",
  "agency_email": "ops@skyops-example.com",
  "uss_id": "uss.skyops-example.com",
  "faa_operator_id": "FAA-OP-123456",
  "easa_operator_id": null,
  "alto_version": "0.1"
}
```

|Field             |Type     |Required|Notes            |
|------------------|---------|--------|-----------------|
|`agency_id`       |string   |Yes     |Unique, URL-safe |
|`agency_name`     |string   |Yes     |                 |
|`agency_url`      |URL      |Yes     |                 |
|`agency_timezone` |TZ string|Yes     |IANA tz database |
|`agency_lang`     |ISO 639-1|Yes     |                 |
|`uss_id`          |string   |Cond.   |If UTM-registered|
|`faa_operator_id` |string   |Cond.   |US deployments   |
|`easa_operator_id`|string   |Cond.   |EU deployments   |

-----

### 2.2 `vehicles.json`

Fleet registry — what vehicles exist and their capabilities.

```json
[
  {
    "vehicle_id": "sky-x2-007",
    "agency_id": "alto-demo-operator",
    "vehicle_name": "SkyOps X2 #007",
    "vehicle_class": "delivery_drone",
    "vehicle_type": "fixed_wing_vtol",
    "remote_id": "ASTM-F3411-SN-ABC123",
    "max_payload_kg": 1.5,
    "endurance_min": 45,
    "max_speed_kts": 65,
    "max_altitude_ft_agl": 400,
    "propulsion": "electric",
    "detect_and_avoid": true,
    "weatherproof": ["rain_light", "wind_up_to_20kts"],
    "certifications": ["FAA_Part107", "EASA_STS-01"],
    "color_hex": "#FF6B35",
    "icon_url": "https://skyops-example.com/assets/x2-icon.png"
  }
]
```

#### `vehicle_class` Enum

|Value             |Description                     |
|------------------|--------------------------------|
|`delivery_drone`  |Cargo, uncrewed                 |
|`inspection_drone`|Survey/inspection, uncrewed     |
|`aam_passenger`   |Air taxi, crewed or autonomous  |
|`aam_cargo`       |Large cargo VTOL                |
|`tethered_uas`    |Tethered aerial platform        |
|`hybrid_evtol`    |eVTOL with fixed-wing transition|

#### `vehicle_type` Enum

|Value            |
|-----------------|
|`multirotor`     |
|`fixed_wing`     |
|`fixed_wing_vtol`|
|`coaxial`        |
|`helicopter`     |
|`airship`        |

-----

### 2.3 `vertiports.json`

Ground infrastructure nodes — takeoff pads, delivery points, charging stations, landing zones.

```json
[
  {
    "vertiport_id": "SFO-DOCK-01",
    "agency_id": "alto-demo-operator",
    "vertiport_name": "SF Distribution Hub — Pad A",
    "vertiport_type": "distribution_hub",
    "lat": 37.6213,
    "lon": -122.3790,
    "elevation_m": 4.0,
    "address": "1 Airport Blvd, South San Francisco, CA",
    "timezone": "America/Los_Angeles",
    "accessible": true,
    "max_vehicle_class": ["delivery_drone", "aam_cargo"],
    "pad_count": 4,
    "charging_available": true,
    "charging_type": ["wireless", "ccs2"],
    "operating_hours": {
      "monday": "06:00-22:00",
      "tuesday": "06:00-22:00",
      "wednesday": "06:00-22:00",
      "thursday": "06:00-22:00",
      "friday": "06:00-23:00",
      "saturday": "08:00-20:00",
      "sunday": "09:00-18:00"
    },
    "weather_constraints": {
      "max_wind_kts": 25,
      "min_visibility_m": 800,
      "ceiling_min_ft": 300
    },
    "utm_geo_zone_id": "UTM-ZONE-KSFO-05"
  }
]
```

#### `vertiport_type` Enum

|Value               |Description                    |
|--------------------|-------------------------------|
|`distribution_hub`  |Large ops center, multiple pads|
|`micro_hub`         |Small neighborhood node        |
|`rooftop_pad`       |Building rooftop               |
|`delivery_point`    |Customer-facing drop zone      |
|`charging_only`     |No ops, charging stop          |
|`passenger_terminal`|AAM boarding point             |
|`emergency_landing` |Contingency/emergency only     |

-----

### 2.4 `corridors.json`

Established aerial routes — the "lines" of the network.

```json
[
  {
    "corridor_id": "CORR-SFO-SOMA-01",
    "agency_id": "alto-demo-operator",
    "corridor_name": "SFO Hub → SOMA Zone",
    "corridor_short_name": "SFO-SOMA",
    "corridor_type": "delivery",
    "color_hex": "#FF6B35",
    "waypoints": [
      { "seq": 1, "vertiport_id": "SFO-DOCK-01", "lat": 37.6213, "lon": -122.3790, "alt_ft_agl": 0 },
      { "seq": 2, "lat": 37.6580, "lon": -122.3420, "alt_ft_agl": 300, "waypoint_type": "en_route" },
      { "seq": 3, "lat": 37.7749, "lon": -122.4194, "alt_ft_agl": 300, "waypoint_type": "en_route" },
      { "seq": 4, "vertiport_id": "SOMA-DROP-07", "lat": 37.7849, "lon": -122.3960, "alt_ft_agl": 0 }
    ],
    "altitude_profile": {
      "cruise_ft_agl": 300,
      "max_ft_agl": 400,
      "min_ft_agl": 50,
      "altitude_layer": "layer_b"
    },
    "distance_km": 22.4,
    "est_duration_min": 18,
    "direction_a_to_b": "southbound",
    "bidirectional": true,
    "geofence_buffer_m": 100
  }
]
```

#### `altitude_layer` Enum

|Layer    |Alt Range (AGL)|Use                      |
|---------|---------------|-------------------------|
|`layer_a`|0-50 ft        |Ground/near ops          |
|`layer_b`|50-400 ft      |Main drone delivery layer|
|`layer_c`|400-1200 ft    |AAM transition           |
|`layer_d`|1200-5000 ft   |Advanced AAM, cargo      |
|`layer_e`|5000+ ft       |High-altitude / BVLOS    |

-----

### 2.5 `flight_patterns.json`

Recurring scheduled flights — when and how often vehicles fly established corridors.

```json
[
  {
    "pattern_id": "PAT-SFO-SOMA-AM-MON",
    "corridor_id": "CORR-SFO-SOMA-01",
    "agency_id": "alto-demo-operator",
    "service_type": "scheduled",
    "frequency_min": 15,
    "operating_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "window_start": "07:00",
    "window_end": "20:00",
    "first_departure": "07:00",
    "last_departure": "19:45",
    "vehicle_class": "delivery_drone",
    "max_payload_kg": 1.5,
    "calendar": {
      "start_date": "2025-01-01",
      "end_date": "2025-12-31",
      "exceptions": []
    }
  }
]
```

#### `service_type` Enum

|Value       |Description                      |
|------------|---------------------------------|
|`scheduled` |Fixed timetable, like a bus route|
|`on_demand` |Triggered by order/request       |
|`continuous`|Always-on shuttle                |
|`emergency` |Priority override                |

-----

### 2.6 `altitude_zones.json`

Static airspace constraints applied to geographic areas — complements UTM geofencing.

```json
[
  {
    "zone_id": "AZ-SFO-APPROACH-CORRIDOR",
    "zone_name": "SFO Approach Exclusion",
    "zone_type": "exclusion",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-122.40, 37.60], [-122.35, 37.60], [-122.35, 37.65], [-122.40, 37.65], [-122.40, 37.60]]]
    },
    "alt_floor_ft_agl": 0,
    "alt_ceiling_ft_agl": 400,
    "active_always": true,
    "active_schedule": null,
    "authority": "FAA",
    "reference_id": "LAANC-KSFO-C"
  }
]
```

-----

## 3. ALTO Realtime Feeds

Realtime feeds are served as polling endpoints or WebSocket streams. JSON preferred; Protobuf bindings provided for high-frequency telemetry.

Base path: `https://{operator-host}/alto/v1/realtime/`

### 3.1 `GET /vehicle_positions`

Live position of active vehicles.

**Response:**

```json
{
  "header": {
    "timestamp": "2025-06-01T14:32:10Z",
    "agency_id": "alto-demo-operator",
    "feed_version": "0.1"
  },
  "entities": [
    {
      "id": "VP-sky-x2-007-20250601",
      "vehicle": {
        "vehicle_id": "sky-x2-007",
        "position": {
          "lat": 37.7100,
          "lon": -122.4050,
          "alt_ft_agl": 298,
          "alt_ft_msl": 330,
          "heading_deg": 352,
          "speed_kts": 48,
          "climb_rate_fpm": 0
        },
        "flight_id": "FLT-20250601-0847",
        "timestamp": "2025-06-01T14:32:09Z",
        "status": "in_flight",
        "battery_pct": 67,
        "signal_strength": "strong",
        "remote_id_active": true
      }
    }
  ]
}
```

#### Vehicle `status` Enum

|Value       |Description      |
|------------|-----------------|
|`pre_flight`|On pad, preparing|
|`in_flight` |Airborne         |
|`hovering`  |Stationary hover |
|`landing`   |Descent to pad   |
|`charging`  |On pad, charging |
|`grounded`  |Ops suspended    |
|`emergency` |Emergency mode   |

-----

### 3.2 `GET /flight_updates`

ETA changes, delays, and status updates for active flights.

```json
{
  "header": { "timestamp": "2025-06-01T14:32:10Z", "agency_id": "alto-demo-operator" },
  "entities": [
    {
      "id": "FU-FLT-20250601-0847",
      "flight_id": "FLT-20250601-0847",
      "corridor_id": "CORR-SFO-SOMA-01",
      "status": "active",
      "scheduled_arrival": "2025-06-01T14:48:00Z",
      "estimated_arrival": "2025-06-01T14:50:30Z",
      "delay_sec": 150,
      "delay_reason": "headwind",
      "next_vertiport_id": "SOMA-DROP-07",
      "progress_pct": 62
    }
  ]
}
```

-----

### 3.3 `GET /alerts`

Service disruptions, weather holds, airspace restrictions.

```json
{
  "header": { "timestamp": "2025-06-01T14:00:00Z", "agency_id": "alto-demo-operator" },
  "entities": [
    {
      "id": "ALERT-2025-0601-WIND",
      "alert_type": "weather_hold",
      "severity": "moderate",
      "affected_corridors": ["CORR-SFO-SOMA-01", "CORR-SFO-MISSION-03"],
      "affected_vertiports": [],
      "active_period": {
        "start": "2025-06-01T14:00:00Z",
        "end": "2025-06-01T17:00:00Z"
      },
      "cause": "Wind gusts exceeding 30 kts at cruise altitude",
      "effect": "operations_suspended",
      "header_text": "Delivery suspended — strong winds",
      "description_text": "Wind gusts of 35 kts forecast until 17:00. Flights on SFO-SOMA and SFO-Mission corridors are suspended.",
      "url": "https://skyops-example.com/status/alert-2025-0601-wind"
    }
  ]
}
```

#### `alert_type` Enum

|Value                |
|---------------------|
|`weather_hold`       |
|`airspace_closure`   |
|`technical_fault`    |
|`emergency_landing`  |
|`geofence_activation`|
|`schedule_change`    |
|`vertiport_closure`  |

-----

## 4. ALTO Delivery Extension

The Delivery Extension adds cargo/package lifecycle to the core spec. Modeled on session + completion record patterns from EV charging interoperability.

### 4.1 `POST /deliveries` — Create Delivery Session

```json
{
  "delivery_id": "DEL-2025-SKY-88821",
  "agency_id": "alto-demo-operator",
  "external_ref": "RETAILER-ORDER-XZ991",
  "pickup": {
    "vertiport_id": "SFO-DOCK-01",
    "scheduled_time": "2025-06-01T14:30:00Z"
  },
  "dropoff": {
    "vertiport_id": "SOMA-DROP-07",
    "address_hint": "123 Main St, Unit 4",
    "lat": 37.7849,
    "lon": -122.3960,
    "contact_code": "RING-2B"
  },
  "cargo": {
    "weight_kg": 0.85,
    "dimensions_cm": { "l": 25, "w": 20, "h": 10 },
    "category": "retail_general",
    "hazmat": false,
    "temperature_controlled": false,
    "fragile": true,
    "declared_value_usd": 120.00
  },
  "priority": "standard",
  "signature_required": false,
  "notify_webhook": "https://retailer.com/webhooks/delivery"
}
```

#### Cargo `category` Enum

|Value                                    |
|-----------------------------------------|
|`retail_general`                         |
|`retail_food`                            |
|`retail_pharmacy`                        |
|`retail_alcohol`                         |
|`medical_supply`                         |
|`medical_specimen`                       |
|`documents`                              |
|`electronics`                            |
|`temperature_sensitive`                  |
|`hazmat_class_1` through `hazmat_class_9`|

-----

### 4.2 `GET /deliveries/{delivery_id}` — Delivery Status

```json
{
  "delivery_id": "DEL-2025-SKY-88821",
  "status": "in_flight",
  "flight_id": "FLT-20250601-0847",
  "vehicle_id": "sky-x2-007",
  "timeline": [
    { "event": "created", "timestamp": "2025-06-01T13:15:00Z" },
    { "event": "picked_up", "timestamp": "2025-06-01T14:31:45Z" },
    { "event": "departed", "timestamp": "2025-06-01T14:33:10Z" },
    { "event": "in_flight", "timestamp": "2025-06-01T14:33:10Z" }
  ],
  "eta": "2025-06-01T14:50:30Z",
  "tracking_url": "https://skyops-example.com/track/DEL-2025-SKY-88821",
  "vehicle_position": {
    "lat": 37.7100, "lon": -122.4050, "alt_ft_agl": 298
  }
}
```

#### Delivery `status` Enum

|Value              |Description                 |
|-------------------|----------------------------|
|`created`          |Order received              |
|`queued`           |Awaiting vehicle assignment |
|`loading`          |Cargo being loaded          |
|`picked_up`        |Cargo secured               |
|`in_flight`        |Airborne                    |
|`approach`         |Within 500m of drop point   |
|`hovering_delivery`|Lowering payload            |
|`delivered`        |Confirmed delivery          |
|`failed`           |Delivery failed (see reason)|
|`returned`         |Returned to origin          |
|`cancelled`        |Cancelled pre-flight        |

-----

### 4.3 Delivery Result Record (DRR)

Immutable record of a completed delivery — analogous to a Charge Detail Record in EV charging protocols.

```json
{
  "drr_id": "DRR-2025-SKY-88821",
  "delivery_id": "DEL-2025-SKY-88821",
  "agency_id": "alto-demo-operator",
  "start_time": "2025-06-01T14:31:45Z",
  "end_time": "2025-06-01T14:51:22Z",
  "duration_sec": 1177,
  "distance_km": 22.1,
  "vehicle_id": "sky-x2-007",
  "corridor_id": "CORR-SFO-SOMA-01",
  "cargo_weight_kg": 0.85,
  "energy_kwh": 0.12,
  "outcome": "success",
  "delivery_proof": {
    "type": "photo",
    "url": "https://skyops-example.com/proof/DRR-2025-SKY-88821.jpg",
    "timestamp": "2025-06-01T14:51:20Z"
  },
  "sla_met": true,
  "co2_saved_vs_truck_g": 420
}
```

-----

## 5. ALTO Roaming API (Cross-Operator)

Enables an operator in City A to hand off a delivery to a partner operator in City B — inspired by EV charging roaming patterns.

### 5.1 Peer Registration

```http
POST /alto/v1/roaming/register
Authorization: Token {api_token}
```

```json
{
  "operator_id": "alto-demo-operator",
  "operator_name": "SkyOps Delivery — US West",
  "alto_endpoint": "https://api.skyops-example.com/alto/v1",
  "supported_modules": ["static", "realtime", "delivery", "roaming"],
  "coverage_geojson_url": "https://api.skyops-example.com/alto/v1/coverage.geojson",
  "contact_email": "partners@skyops-example.com"
}
```

### 5.2 Handoff Request

```http
POST /alto/v1/roaming/handoff
```

```json
{
  "handoff_id": "HO-88821-PARTNER",
  "requesting_operator": "alto-demo-operator",
  "fulfilling_operator": "partner-ops-us-west",
  "delivery_ref": "DEL-2025-SKY-88821",
  "handoff_vertiport_id": "SOMA-INTEROP-01",
  "handoff_time": "2025-06-01T14:51:00Z",
  "cargo_spec": {
    "weight_kg": 0.85,
    "category": "retail_general",
    "hazmat": false,
    "fragile": true
  },
  "final_destination": {
    "lat": 37.8049, "lon": -122.2711,
    "address_hint": "456 Oak Ave, Oakland, CA"
  }
}
```

### 5.3 Network Directory

```http
GET /alto/v1/roaming/operators
```

Returns a list of all registered ALTO operators with coverage, supported modules, and endpoint URLs.

-----

## 6. Authentication and Security

|Mechanism                         |Use Case                       |
|----------------------------------|-------------------------------|
|**OAuth 2.0 (Client Credentials)**|Operator-to-operator API calls |
|**API Token (Bearer)**            |Realtime feed access           |
|**Signed Feed Manifests**         |Static feed integrity (SHA-256)|
|**Remote ID passthrough**         |ASTM F3411 compliance reference|
|**Webhook HMAC**                  |Delivery event hooks           |

Security requirements:

- All endpoints over TLS 1.2+
- Realtime position feeds must be delayed >= 5 seconds for public access (privacy + security)
- Operator ID must be verifiable against registry (FAA UAS registry or EASA equivalent)
- No PII in public feeds (no pilot names, no customer addresses)

-----

## 7. AAM / Passenger Extension (Stub)

For Advanced Air Mobility passenger vehicles (eVTOL air taxis):

Additional files:

- `seats.json` — Seating capacity, class, accessibility per vehicle
- `bookings` API — Roaming seat reservations across operators
- `passenger_updates` — Boarding status, ETA, gate changes

Stub only in v0.1. Full AAM Extension targeted for v0.3.

-----

## 8. Compliance Mapping

|ALTO Object                                   |UTM / Regulatory Reference        |
|----------------------------------------------|----------------------------------|
|`vehicles.json` -> `remote_id`                |ASTM F3411-22a                    |
|`vertiports.json` -> `utm_geo_zone_id`        |EUROCAE ED-269 / ED-318           |
|`flight_patterns.json`                        |GUTMA Flight Declaration Protocol |
|`corridors.json`                              |FAA UTM ConOps corridors concept  |
|`alerts.json` -> `alert_type: airspace_closure`|LAANC / FAA NOTAM                |
|`vehicle_positions`                           |InterUSS DSS position reporting   |
|`deliveries`                                  |No existing standard (ALTO-native)|

-----

## 9. Sample ALTO Feed Bundle

A minimal valid ALTO static bundle (ZIP) contains:

```
alto_feed/
  feed_info.json
  agency.json
  vehicles.json
  vertiports.json
  corridors.json
  flight_patterns.json
  altitude_zones.json    (optional)
```

`feed_info.json`:

```json
{
  "feed_publisher_name": "SkyOps Delivery",
  "feed_publisher_url": "https://skyops-example.com",
  "feed_lang": "en",
  "feed_start_date": "2025-01-01",
  "feed_end_date": "2025-12-31",
  "feed_version": "2025-01-01-v3",
  "alto_spec_version": "0.1",
  "contact_email": "data@skyops-example.com",
  "modules": ["static", "delivery"]
}
```

-----

## 10. Versioning and Governance

|Version|Status                                           |Target |
|-------|-------------------------------------------------|-------|
|**0.1**|Draft for comment                                |2025 Q1|
|**0.2**|Incorporate feedback, finalize Delivery Extension|2025 Q3|
|**0.3**|AAM Passenger Extension                          |2026 Q1|
|**1.0**|Stable, submit to ASTM/GUTMA for ratification    |2026 Q4|

Governance model (proposed):

- GitHub-hosted spec (Apache 2.0)
- Steering committee: operators, city planners, UTM regulators, app developers
- Change proposals via GitHub Issues + RFC process
- Validator tool (CLI + web) for feed compliance

-----

## Appendix A: Landing Zone Schema

Landing zones model the extraordinary diversity of delivery endpoints. A residential front yard, a commercial loading dock, a hospital rooftop helipad, and a high-rise balcony each require different approach profiles, obstacle environments, and precision requirements.

### `landing_zones.json` (optional static feed file)

```json
[
  {
    "landing_zone_id": "LZ-SOMA-RES-0042",
    "agency_id": "alto-demo-operator",
    "zone_type": "residential_ground",
    "lat": 37.7849,
    "lon": -122.3960,
    "elevation_m": 12.0,
    "approach_volume": {
      "type": "cone",
      "apex_alt_m_agl": 50,
      "base_radius_m": 8,
      "approach_heading_deg": [0, 360]
    },
    "surface_type": "grass",
    "max_wind_speed_kts": 20,
    "noise_curfew_windows": [
      { "start": "22:00", "end": "07:00", "timezone": "America/Los_Angeles" }
    ],
    "gps_augmentation_required": false,
    "vertical_precision_m": 3.0,
    "obstruction_last_surveyed": "2025-05-15T10:00:00Z",
    "load_bearing_kg": 50
  },
  {
    "landing_zone_id": "LZ-FIN-ROOF-0108",
    "agency_id": "alto-demo-operator",
    "zone_type": "commercial_rooftop",
    "lat": 37.7920,
    "lon": -122.3980,
    "elevation_m": 85.0,
    "approach_volume": {
      "type": "cylinder",
      "radius_m": 5,
      "min_alt_m_agl": 10,
      "max_alt_m_agl": 60
    },
    "surface_type": "concrete",
    "max_wind_speed_kts": 15,
    "noise_curfew_windows": [],
    "gps_augmentation_required": false,
    "vertical_precision_m": 1.5,
    "obstruction_last_surveyed": "2025-04-20T14:30:00Z",
    "load_bearing_kg": 200,
    "hvac_clearance_m": 4.0
  }
]
```

#### `zone_type` Enum (open — vendor extensions allowed)

|Value                 |Description                                |
|----------------------|-------------------------------------------|
|`residential_ground`  |Front/back yard, ground-level residential  |
|`commercial_rooftop`  |Building rooftop with pad infrastructure   |
|`high_rise_balcony`   |High-rise building balcony or terrace      |
|`medical_helipad`     |Hospital/medical facility helipad          |
|`rural_open`          |Open rural area, minimal infrastructure    |
|`parking_structure`   |Multi-story garage rooftop                 |
|`industrial_yard`     |Warehouse/factory loading area             |

Every delivery entity MUST reference a `landing_zone_id`. Static feeds publish known landing zones; realtime feeds can declare ad-hoc zones with inline definitions for unplanned deliveries.

#### Realtime Landing Zone Condition

The realtime feed includes a `landing_zone_condition` field per active delivery:

|Value        |Description                               |
|-------------|------------------------------------------|
|`VERIFIED`   |Zone surveyed and clear within 24 hours   |
|`UNVERIFIED` |Zone exists but not recently surveyed     |
|`OBSTRUCTED` |Known obstruction detected                |
|`CLOSED`     |Zone temporarily or permanently unavailable|

-----

## Appendix B: Ground Hazard Assessment

Aerial delivery introduces a hazard category unique to drone operations: the interaction between an arriving vehicle and the uncontrolled ground environment. Animals, bystanders, loose objects, and property all create risk during the final descent and initial climb-out.

### Ground Clearance Object (Realtime)

Included in every realtime delivery entity during descent/ascent phases:

```json
{
  "ground_clearance": {
    "clearance_method": "visual_camera",
    "clearance_status": "CLEAR",
    "clearance_timestamp": "2025-06-01T14:50:55Z",
    "abort_reason": null
  },
  "ground_exclusion_zone": {
    "type": "circle",
    "center": { "lat": 37.7849, "lon": -122.3960 },
    "radius_m": 15,
    "active_from": "2025-06-01T14:50:30Z",
    "active_until": "2025-06-01T14:52:00Z"
  }
}
```

#### `clearance_method` Enum

|Value            |Description                      |
|-----------------|---------------------------------|
|`visual_camera`  |Onboard camera visual inspection |
|`lidar_scan`     |LIDAR-based ground scan          |
|`acoustic_sensor`|Acoustic detection (animal noise)|
|`none`           |No clearance performed           |

#### `clearance_status` Enum

|Value              |Description                            |
|-------------------|---------------------------------------|
|`CLEAR`            |No hazards detected                    |
|`OBSTRUCTED`       |Physical obstruction in landing zone   |
|`ANIMAL_DETECTED`  |Animal present in zone                 |
|`PERSON_DETECTED`  |Person present in zone                 |
|`UNKNOWN`          |Unable to determine                    |

### Delivery Incident Record (DRR Extension)

The DRR includes a `delivery_incident` field when any ground-level event occurs:

```json
{
  "delivery_incident": {
    "incident_type": "animal_damage",
    "severity": "minor",
    "description": "Dog contacted vehicle during final descent at 8ft AGL. Minor prop damage. Payload intact.",
    "timestamp": "2025-06-01T14:51:05Z"
  }
}
```

#### `incident_type` Enum

|Value              |Description                          |
|-------------------|-------------------------------------|
|`animal_damage`    |Animal contact with vehicle/payload  |
|`property_damage`  |Damage to ground property            |
|`bystander_approach`|Person entered exclusion zone       |
|`payload_drop`     |Unplanned payload release            |
|`rotor_wash_damage`|Wind damage from rotor downwash      |
|`none`             |No incident                          |

-----

## Appendix C: Weather Envelope Schema

Weather is an operational gate for aerial delivery — not just an advisory. Specific thresholds determine whether a flight can legally and safely operate, and these thresholds vary by vehicle class and corridor.

### Weather Envelope (Static — per vehicle_class and corridor)

```json
{
  "weather_envelope_id": "WE-DELIVERY-DRONE-DEFAULT",
  "vehicle_class": "delivery_drone",
  "corridor_id": "CORR-SFO-SOMA-01",
  "max_sustained_wind_kts": 25,
  "max_gust_kts": 35,
  "min_visibility_m": 800,
  "max_precipitation_rate_mm_hr": 4.0,
  "temperature_range_c": { "min": -10, "max": 45 },
  "icing_prohibited": true,
  "max_crosswind_kts": 15,
  "ceiling_min_ft": 300
}
```

### Weather Status (Realtime — per corridor and vertiport)

```json
{
  "corridor_id": "CORR-SFO-SOMA-01",
  "weather_status": "MARGINAL",
  "current_conditions": {
    "wind_sustained_kts": 22,
    "wind_gust_kts": 28,
    "visibility_m": 1200,
    "precipitation_rate_mm_hr": 2.1,
    "temperature_c": 14,
    "icing_risk": false
  },
  "weather_source_ref": "NWS-KSFO-METAR-20250601T1450Z",
  "last_updated": "2025-06-01T14:50:00Z",
  "next_update_expected": "2025-06-01T14:51:00Z"
}
```

#### `weather_status` Enum

|Value      |Description                                          |
|-----------|-----------------------------------------------------|
|`GO`       |All conditions within weather envelope                |
|`MARGINAL` |One or more conditions near threshold limits          |
|`NO_GO`    |One or more conditions exceed thresholds — ops halted |
|`UNKNOWN`  |Weather data unavailable — treat as NO_GO             |

### Weather Hold (Realtime — on delivery entity)

```json
{
  "weather_hold": {
    "hold_reason": "Wind gusts exceeding 35 kts at cruise altitude",
    "hold_start_time": "2025-06-01T14:30:00Z",
    "estimated_resume_time": "2025-06-01T17:00:00Z",
    "auto_cancel_after_sec": 10800
  }
}
```

DRRs MUST record weather conditions at both departure and arrival for post-incident analysis:

```json
{
  "weather_at_departure": { "wind_kts": 12, "visibility_m": 5000, "temp_c": 18 },
  "weather_at_arrival": { "wind_kts": 18, "visibility_m": 3200, "temp_c": 16 }
}
```

-----

## Appendix D: Multi-Phase Delivery

Some delivery architectures split a single delivery into multiple phases performed by different vehicle types — for example, a long-range aerial vehicle covers the high-altitude transit segment, then hands off the payload to a quiet ground-level delivery unit for the last mile. This solves noise constraints (the loud vehicle never descends into neighborhoods) and precision requirements (the ground unit navigates to the exact doorstep).

### Delivery Phase Schema

Each delivery consists of one or more ordered phases:

```json
{
  "delivery_id": "DEL-2025-SKY-99301",
  "phases": [
    {
      "phase_seq": 1,
      "phase_type": "AERIAL_TRANSIT",
      "flight_id": "FLT-20250601-1422",
      "vehicle_id": "sky-fw-012",
      "corridor_id": "CORR-HUB-SUBURB-07",
      "status": "completed",
      "start_time": "2025-06-01T14:22:00Z",
      "end_time": "2025-06-01T14:38:00Z",
      "distance_km": 18.2,
      "energy_kwh": 0.45
    },
    {
      "phase_seq": 2,
      "phase_type": "HOVER_HANDOFF",
      "flight_id": "FLT-20250601-1422",
      "vehicle_id": "sky-fw-012",
      "handoff": {
        "handoff_point": { "lat": 37.7520, "lon": -122.4180, "alt_m_agl": 30 },
        "handoff_type": "tethered_lower",
        "receiving_vehicle_id": "sky-gnd-088",
        "custody_transfer_timestamp": "2025-06-01T14:38:45Z",
        "handoff_status": "COMPLETED"
      }
    },
    {
      "phase_seq": 3,
      "phase_type": "GROUND_DELIVERY",
      "flight_id": null,
      "vehicle_id": "sky-gnd-088",
      "corridor_id": null,
      "status": "completed",
      "start_time": "2025-06-01T14:39:00Z",
      "end_time": "2025-06-01T14:46:30Z",
      "distance_km": 0.8,
      "energy_kwh": 0.02
    }
  ]
}
```

#### `phase_type` Enum

|Value              |Description                               |
|-------------------|------------------------------------------|
|`AERIAL_TRANSIT`   |High-altitude flight segment              |
|`GROUND_DELIVERY`  |Ground-level vehicle last-mile delivery   |
|`TETHERED_DESCENT` |Payload lowered on tether from hover      |
|`HOVER_HANDOFF`    |Aerial vehicle transfers payload at hover |
|`STATION_TRANSFER` |Payload transferred at fixed station point|

#### Handoff Status Enum

|Value        |Description                          |
|-------------|-------------------------------------|
|`PENDING`    |Handoff not yet initiated            |
|`IN_PROGRESS`|Custody transfer underway            |
|`COMPLETED`  |Payload successfully transferred     |
|`FAILED`     |Transfer failed — see abort_reason   |

### DRR with Phase Breakdown

The DRR includes a `phases[]` array with per-phase cost, duration, distance, and energy. The `delivery_id` is the only stable identifier across the entire multi-phase operation — all phase-level IDs are children of it.

```json
{
  "drr_id": "DRR-2025-SKY-99301",
  "delivery_id": "DEL-2025-SKY-99301",
  "total_duration_sec": 1470,
  "total_distance_km": 19.0,
  "total_energy_kwh": 0.47,
  "phases": [
    { "phase_seq": 1, "vehicle_id": "sky-fw-012", "duration_sec": 960, "distance_km": 18.2, "energy_kwh": 0.45 },
    { "phase_seq": 2, "vehicle_id": "sky-fw-012", "duration_sec": 45, "distance_km": 0, "energy_kwh": 0.0 },
    { "phase_seq": 3, "vehicle_id": "sky-gnd-088", "duration_sec": 450, "distance_km": 0.8, "energy_kwh": 0.02 }
  ],
  "outcome": "success"
}
```

-----

## Appendix E: Business Case for Operator Adoption

### Why Operators Should Adopt ALTO

**1. Enterprise integration acceleration.** Every enterprise integration today requires custom data work — proprietary APIs, bespoke webhooks, one-off contracts. An open standard turns "can your system talk to ours" from a multi-month integration project into a compliance checkbox. ALTO is a direct sales velocity tool for operators selling into healthcare, retail, and logistics enterprises.

**2. City permitting speed.** Operators entering new cities currently require custom data-sharing agreements with each city's traffic management and emergency services. A city that says "we require ALTO compliance" is a door an operator can walk through in weeks instead of months. The operator who helped write the spec has the working implementation on day one.

**3. Regulatory inevitability.** FAA UTM requirements are tightening. EASA U-space mandates are already live in Europe. Regulators will eventually require standardized operational data reporting. Operators that help write the standard shape it to fit their existing architecture. Operators that don't will retrofit to whatever gets specified without them.

**4. Insurance and liability data.** Insurers pricing drone delivery risk need standardized incident and completion data. The DRR is exactly that format. Operators with the most flight data benefit most from defining the audit trail fields — their data becomes the industry benchmark, not an outlier format.

**5. Auditable sustainability claims.** Enterprise partners with Scope 3 emissions commitments need verifiable carbon data. ALTO's `co2_saved_vs_truck_g` field in the DRR makes sustainability claims independently auditable. Without a standard, those numbers are marketing copy. With one, they're supply chain data.

### Adoption Cost vs. Benefit

|Investment                    |Return                                                      |
|------------------------------|------------------------------------------------------------|
|Static feed generation        |Unlock city open-data portals and trip planner integrations |
|Realtime feed endpoint        |Enable cross-operator conflict awareness                    |
|DRR compliance                |Standardized billing, insurance, and carbon audit trail     |
|Roaming API implementation    |Cross-operator delivery handoffs without custom contracts   |

-----

*ALTO v0.1 — Published for public comment. Contributions welcome at github.com/openalto-spec/alto*
