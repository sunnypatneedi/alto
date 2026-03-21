# ALTO Enhancement Plan: Ground Vehicle Coordination Layer

## Context

The Autolane analysis identifies 4 existential challenges for coordinating black-box autonomous vehicles on private property. ALTO v0.1 currently covers **aerial logistics** (drones, eVTOL) with strong foundations in corridors, vertiports, delivery lifecycle, and roaming. But it has **zero coverage** of ground-level AV coordination — the exact domain Autolane needs.

The enhancement strategy: extend ALTO from an aerial-only standard into a **multimodal autonomous vehicle coordination standard** that also covers ground AVs operating in private property environments (parking lots, curbs, loading zones, campus roads).

---

## Enhancement 1: Ground Vehicle Coordination Extension

**Problem addressed:** AVs as black boxes with no shared control port (Autolane challenge #1)

### New static feed: `ground_vehicles.json`
- `ground_vehicle_id`, `oem` (waymo, tesla, cruise, zoox, etc.), `sensor_suite` (lidar, vision_only, sensor_fusion)
- `adas_capabilities[]` — what the vehicle can respond to
- `control_interface` enum: `api_direct`, `prompt_based`, `geofence_only`, `manual_override_only`
- `instruction_format` enum: `waypoint_gps`, `natural_language`, `geofence_polygon`, `lane_graph`
- `supported_protocols[]` — which ALTO instruction types this vehicle understands

### New static feed: `oem_profiles.json`
- Per-OEM adapter profiles: what instructions they accept, API shape, map format, update cadence
- `oem_id`, `instruction_modes[]`, `map_format` (hd_map, lightweight_prior, vision_only, opendrive)
- `reservation_support` (boolean), `priority_support` (boolean), `speed_control_support` (boolean)
- `api_version`, `known_limitations[]`

**Rationale:** This makes the black-box problem explicit in the spec. Instead of pretending all AVs are the same, ALTO formally models their capability differences so coordination systems can adapt per-OEM.

---

## Enhancement 2: Property Zone & Curb Management

**Problem addressed:** No standard for mapping and coordination (Autolane challenge #2)

### New static feed: `property_zones.json`
- `zone_id`, `property_id`, `zone_type` enum:
  - `parking_stall`, `loading_zone`, `pickup_dropoff`, `fire_lane`, `crosswalk`, `driveway`, `drive_aisle`, `ev_charging`, `handicap`, `no_stop`, `staging_area`
- `geometry` (GeoJSON polygon)
- `max_speed_mph`, `direction` (one_way_in, one_way_out, bidirectional, no_entry)
- `allowed_vehicle_types[]`, `priority_rules[]`
- `time_restrictions[]` — conditional availability windows
- `capacity` (for stalls/zones)

### New static feed: `property_maps.json`
- `property_id`, `property_name`, `boundary` (GeoJSON polygon)
- `driveways[]` — entry/exit points with approach geometry
- `internal_road_graph` — lane-level connectivity for navigation within the property
- `conflict_points[]` — intersections, merge points, pedestrian crossings
- `speed_zones[]` — max speed by area

### New realtime endpoint: `GET /property_zones/status`
- Real-time zone occupancy, reservations, and availability
- `zone_id`, `status` (available, occupied, reserved, blocked, maintenance)
- `reserved_for` (vehicle_id + time window)
- `occupant_vehicle_id`, `occupied_since`

**Rationale:** This is the single coordination model Autolane needs — one way to describe every zone, stall, and constraint on a property, regardless of which OEM shows up.

---

## Enhancement 3: Vehicle Instruction Abstraction Layer

**Problem addressed:** No standard instruction set across OEMs (Autolane challenges #1 + #2 + #3)

### New API: Vehicle Instructions

#### `POST /instructions`
Create a vehicle instruction (the universal abstraction that gets translated per-OEM):

```json
{
  "instruction_id": "INS-2025-PROP-44201",
  "vehicle_id": "waymo-veh-0891",
  "property_id": "PROP-WALMART-SUPERCENTER-4412",
  "instruction_type": "APPROACH_AND_PARK",
  "parameters": {
    "target_zone_id": "ZONE-PICKUP-A3",
    "approach_driveway_id": "DW-NORTH-MAIN",
    "max_speed_mph": 5,
    "avoid_zones": ["ZONE-CROSSWALK-01", "ZONE-FIRE-LANE-02"],
    "arrival_window": {
      "earliest": "2025-06-01T10:31:00Z",
      "latest": "2025-06-01T10:33:00Z"
    }
  },
  "natural_language_hint": "Enter via the north driveway, proceed at 5 mph, park in pickup stall A3. Do not cross the pedestrian crosswalk near the pharmacy entrance.",
  "priority": "standard",
  "expiry": "2025-06-01T10:35:00Z"
}
```

#### Instruction types enum:
- `APPROACH_AND_PARK` — navigate to a specific zone and stop
- `DEPART_VIA` — exit via a specific driveway/route
- `REROUTE` — abort current approach, go to alternative
- `HOLD_POSITION` — stay where you are
- `REDUCE_SPEED` — slow to specified limit
- `YIELD_TO` — give priority to another vehicle/pedestrian
- `ABORT_AND_EXIT` — leave the property immediately

#### `GET /instructions/{instruction_id}/status`
- `status`: `pending`, `acknowledged`, `executing`, `completed`, `failed`, `expired`
- `oem_translation_status`: whether the instruction was successfully mapped to OEM-native format

**Rationale:** This is the "single instruction set" — one abstraction that Autolane translates into OEM-specific commands. The `natural_language_hint` field directly addresses the neural-net prompting problem (challenge #3).

---

## Enhancement 4: Neural Net / VLA Instruction Support

**Problem addressed:** Neural nets don't read maps the way humans do (Autolane challenge #3)

### New static feed: `property_prompts.json`
Per-property natural language rule sets designed to be consumed by vision-language models:

```json
{
  "property_id": "PROP-WALMART-SUPERCENTER-4412",
  "prompt_version": "2025-06-01",
  "rules": [
    {
      "rule_id": "R001",
      "category": "navigation",
      "prompt": "The north driveway is entrance-only. Do not exit through the north driveway.",
      "geometry_ref": "DW-NORTH-MAIN",
      "priority": "mandatory"
    },
    {
      "rule_id": "R002",
      "category": "safety",
      "prompt": "Never block the fire lane along the west side of the building. The fire lane is painted red.",
      "geometry_ref": "ZONE-FIRE-LANE-02",
      "priority": "mandatory"
    },
    {
      "rule_id": "R003",
      "category": "speed",
      "prompt": "Drive no faster than 5 miles per hour when within 50 feet of the store entrance.",
      "geometry_ref": "ZONE-ENTRANCE-PROXIMITY",
      "priority": "mandatory"
    },
    {
      "rule_id": "R004",
      "category": "pedestrian",
      "prompt": "Always yield to pedestrians at the crosswalk near the pharmacy entrance. Stop completely if any pedestrian is present.",
      "geometry_ref": "ZONE-CROSSWALK-01",
      "priority": "mandatory"
    }
  ]
}
```

### Dual-format instruction model
Every vehicle instruction carries both:
1. **Structured parameters** (zone IDs, coordinates, speed limits) — for traditional HD-map-based planners
2. **Natural language hint** — for VLA/neural-net-based systems (Tesla-style)

The OEM profile declares which format the vehicle consumes. The coordination system sends both; the adapter selects the right one.

**Rationale:** This directly addresses Ben's insight that "the map of the future may just be natural language prompts per property." ALTO becomes the standard for expressing those prompts.

---

## Enhancement 5: Precision Curb Operations

**Problem addressed:** Beyond GPS and basic maps (Autolane challenge #4)

### Enhancements to `property_zones.json`:
- `approach_path` — ordered waypoints for approaching this zone (not just the zone polygon)
- `required_precision_m` — how accurately the vehicle must position (0.5m for tight loading docks, 3m for open lots)
- `reference_markers[]` — visual/physical landmarks for vision-based systems:
  ```json
  {
    "marker_type": "painted_line",
    "description": "Yellow painted stall boundary",
    "visual_cue": "Park between the two yellow lines"
  }
  ```
- `pedestrian_conflict_zones[]` — areas near this zone where pedestrians are expected
- `vulnerable_road_user_density` enum: `none`, `low`, `moderate`, `high` (e.g., near school, hospital)

### New realtime endpoint: `GET /property/conflicts`
- Real-time conflict detection: which vehicles are approaching the same zone, which pedestrian crossings are active
- Enables the coordination layer to sequence arrivals and prevent gridlock

**Rationale:** A GPS coordinate isn't enough for a Walmart parking lot. The spec must model approach paths, visual cues, and conflict points — the full context a vehicle needs.

---

## Implementation Plan (Code Changes)

### Step 1: Spec document updates
- Add Section 11: Ground Vehicle Coordination Extension to `spec/ALTO-v0.1.md`
- Add new static feeds: `ground_vehicles.json`, `oem_profiles.json`, `property_zones.json`, `property_maps.json`, `property_prompts.json`
- Add new API endpoints to spec and OpenAPI schema

### Step 2: OpenAPI schema updates (`spec/openapi.yaml`)
- Add new tags: `Property`, `Instructions`
- Add schemas: `PropertyZone`, `PropertyMap`, `VehicleInstruction`, `PropertyPrompt`, `OEMProfile`, `GroundVehicle`
- Add endpoints: `/instructions`, `/property_zones/status`, `/property/conflicts`

### Step 3: UI updates — new Spec Browser section
- Add "Ground Coordination" section to ALTOBrowser.jsx
- Display new feeds, endpoints, and schemas in the existing UI pattern

### Step 4: Design Lessons updates
- Add 2 new lessons to ALTOLessons.jsx addressing the Autolane-specific failure modes:
  - "Black-Box AV Coordination" — the OEM adapter problem
  - "Neural Net Instruction Formats" — prompts vs maps for VLAs

### Step 5: Update README.md
- Add Ground Coordination Extension to the feature table
- Add examples for property zones and vehicle instructions
