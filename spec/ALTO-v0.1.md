# ALTO: Aerial Logistics & Transit Open-standard

**Version 0.1 — Draft for Public Comment**

> Modeled on GTFS (transit scheduling) and OCPI (EV charging interoperability).
> Fills the gap between FAA/ICAO safety frameworks and developer-ready open data feeds.

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

ALTO occupies the application layer. It does not replace Remote ID or UTM — it sits above them, exactly as GTFS sits above traffic light timing protocols.

### Design Principles

1. **Open by default.** Apache 2.0. No license fees.
1. **Static + Realtime.** Like GTFS, static feeds describe what *should* happen; realtime feeds describe what *is* happening.
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

Static feeds are published as a ZIP bundle or as a directory of JSON files. They describe the planned, recurring structure of an aerial operation — analogous to a GTFS static dataset.

### 2.1 `agency.json`

Describes the operating entity.

```json
{
  "agency_id": "wm-delivery-us-west",
  "agency_name": "Wing Delivery — US West",
  "agency_url": "https://wing.com",
  "agency_timezone": "America/Los_Angeles",
  "agency_lang": "en",
  "agency_phone": "+1-800-555-0100",
  "agency_email": "ops@wing.com",
  "uss_id": "uss.wing.com",
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
    "vehicle_id": "wm-x2-007",
    "agency_id": "wm-delivery-us-west",
    "vehicle_name": "Wing X2 #007",
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
    "icon_url": "https://wing.com/assets/x2-icon.png"
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

Ground infrastructure nodes — takeoff pads, delivery points, charging stations.

```json
[
  {
    "vertiport_id": "SFO-DOCK-01",
    "agency_id": "wm-delivery-us-west",
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

Established aerial routes — the "lines" of the network (equiv. to GTFS `routes.txt`).

```json
[
  {
    "corridor_id": "CORR-SFO-SOMA-01",
    "agency_id": "wm-delivery-us-west",
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

Recurring scheduled flights (equiv. to GTFS `trips.txt` + `stop_times.txt`).

```json
[
  {
    "pattern_id": "PAT-SFO-SOMA-AM-MON",
    "corridor_id": "CORR-SFO-SOMA-01",
    "agency_id": "wm-delivery-us-west",
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
    "agency_id": "wm-delivery-us-west",
    "feed_version": "0.1"
  },
  "entities": [
    {
      "id": "VP-wm-x2-007-20250601",
      "vehicle": {
        "vehicle_id": "wm-x2-007",
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
  "header": { "timestamp": "2025-06-01T14:32:10Z", "agency_id": "wm-delivery-us-west" },
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
  "header": { "timestamp": "2025-06-01T14:00:00Z", "agency_id": "wm-delivery-us-west" },
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
      "url": "https://wing.com/status/alert-2025-0601-wind"
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

The Delivery Extension adds cargo/package lifecycle to the core spec. Modeled on OCPI's Session + CDR pattern.

### 4.1 `POST /deliveries` — Create Delivery Session

```json
{
  "delivery_id": "DEL-2025-WING-88821",
  "agency_id": "wm-delivery-us-west",
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
  "delivery_id": "DEL-2025-WING-88821",
  "status": "in_flight",
  "flight_id": "FLT-20250601-0847",
  "vehicle_id": "wm-x2-007",
  "timeline": [
    { "event": "created", "timestamp": "2025-06-01T13:15:00Z" },
    { "event": "picked_up", "timestamp": "2025-06-01T14:31:45Z" },
    { "event": "departed", "timestamp": "2025-06-01T14:33:10Z" },
    { "event": "in_flight", "timestamp": "2025-06-01T14:33:10Z" }
  ],
  "eta": "2025-06-01T14:50:30Z",
  "tracking_url": "https://wing.com/track/DEL-2025-WING-88821",
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

Immutable record of a completed delivery — analogous to OCPI's CDR (Charge Detail Record).

```json
{
  "drr_id": "DRR-2025-WING-88821",
  "delivery_id": "DEL-2025-WING-88821",
  "agency_id": "wm-delivery-us-west",
  "start_time": "2025-06-01T14:31:45Z",
  "end_time": "2025-06-01T14:51:22Z",
  "duration_sec": 1177,
  "distance_km": 22.1,
  "vehicle_id": "wm-x2-007",
  "corridor_id": "CORR-SFO-SOMA-01",
  "cargo_weight_kg": 0.85,
  "energy_kwh": 0.12,
  "outcome": "success",
  "delivery_proof": {
    "type": "photo",
    "url": "https://wing.com/proof/DRR-2025-WING-88821.jpg",
    "timestamp": "2025-06-01T14:51:20Z"
  },
  "sla_met": true,
  "co2_saved_vs_truck_g": 420
}
```

-----

## 5. ALTO Roaming API (Cross-Operator)

Modeled on OCPI's roaming protocol — enables an operator in City A to hand off a delivery to a partner operator in City B.

### 5.1 Peer Registration

```http
POST /alto/v1/roaming/register
Authorization: Token {api_token}
```

```json
{
  "operator_id": "wm-delivery-us-west",
  "operator_name": "Wing Delivery — US West",
  "alto_endpoint": "https://api.wing.com/alto/v1",
  "supported_modules": ["static", "realtime", "delivery", "roaming"],
  "coverage_geojson_url": "https://api.wing.com/alto/v1/coverage.geojson",
  "contact_email": "partners@wing.com"
}
```

### 5.2 Handoff Request

```http
POST /alto/v1/roaming/handoff
```

```json
{
  "handoff_id": "HO-88821-AMAZON",
  "requesting_operator": "wm-delivery-us-west",
  "fulfilling_operator": "amazon-air-us-west",
  "delivery_ref": "DEL-2025-WING-88821",
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
- `bookings` API — Analogous to OCPI's `tokens` — roaming seat reservations
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
  "feed_publisher_name": "Wing Delivery",
  "feed_publisher_url": "https://wing.com",
  "feed_lang": "en",
  "feed_start_date": "2025-01-01",
  "feed_end_date": "2025-12-31",
  "feed_version": "2025-01-01-v3",
  "alto_spec_version": "0.1",
  "contact_email": "data@wing.com",
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

## Appendix A: Key Differences from GTFS

|Dimension             |GTFS              |ALTO                                |
|----------------------|------------------|------------------------------------|
|Coordinate system     |2D (lat/lon)      |3D (lat/lon/alt)                    |
|Vehicle               |Ground-only       |Aerial, multi-class                 |
|"Stop" equivalent     |Fixed stop        |Vertiport (dynamic pad availability)|
|Weather constraints   |Not applicable    |First-class fields                  |
|Cargo manifest        |Not applicable    |Delivery Extension                  |
|Cross-operator roaming|Not applicable    |Roaming API (OCPI-inspired)         |
|Realtime              |GTFS-RT (Protobuf)|JSON polling + WebSocket            |
|Regulatory refs       |None              |UTM, Remote ID, geofencing          |
|Altitude layers       |None              |5-layer model                       |

-----

## Appendix B: Key Differences from OCPI

|Dimension         |OCPI                |ALTO                         |
|------------------|--------------------|-----------------------------|
|Domain            |EV charging         |Aerial vehicle ops + delivery|
|"Location"        |Charge point        |Vertiport                    |
|"Session"         |Charging session    |Delivery session / flight    |
|"CDR"             |Charge detail record|Delivery Result Record (DRR) |
|Roaming           |Operator <-> eMSP   |Operator <-> Operator        |
|Static feed       |None                |ALTO Static (GTFS-inspired)  |
|Realtime telemetry|None                |Vehicle positions + alerts   |

-----

*ALTO v0.1 — Published for public comment. Contributions welcome at github.com/alto-spec/alto*
