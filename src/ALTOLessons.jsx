import { useState } from "react";

const ISSUES = [
  {
    id: "versioning",
    title: "Versioning & Breaking Changes",
    severity: "critical",
    source: "Legacy Standards",
    problem: `Prior mobility data standards had no formal version numbers for years \u2014 relying on Git commit dates as "versions." When the first major feature revision arrived, it created a real backward-incompatibility crisis: two parallel models (V1 and V2) now co-exist indefinitely. EV charging protocols are worse: five or more versions all live simultaneously in production deployments, forcing implementers to maintain multi-version compatibility matrices.`,
    evidence: [
      "Community versioning discussions: 'I believe the easy reason why [the standard] has not used a versioning system is because it doesn\u2019t (hardly ever?) add any breaking changes' \u2014 until a major feature revision broke that assumption.",
      "Older protocol versions officially deprecated, but many hubs still require them. Implementers must support 3+ versions simultaneously.",
      "Validator tooling found 73 of 1200 production feeds broke on a single rule addition from a new feature module."
    ],
    altoRisk: `ALTO has more breaking-change surface than ground transit standards. Weather constraints, altitude layers, and UTM regulatory references will all evolve as regulation matures. A UTM geo-zone format change (e.g., ED-269 \u2192 ED-318 transitions already underway) could cascade into a breaking schema change. On-demand drone delivery is ALTO\u2019s default mode \u2014 not an extension \u2014 so any change to the delivery object has maximum impact.`,
    recommendation: `Adopt strict semver from day one. Major version = breaking change. Lock the Protobuf field enum space immediately. Establish a formal deprecation window (min 18 months) for any removed field. Never rename a field \u2014 add a new one and deprecate the old. Adopt a "documentation revision" pattern: doc-only fixes get d2/d3 suffixes; no field changes allowed in doc revisions.`
  },
  {
    id: "static-rt-sync",
    title: "Static \u2194 Realtime ID Synchronization",
    severity: "critical",
    source: "Realtime Feeds",
    problem: `The most common and damaging failure mode in legacy realtime transit feeds: realtime data references trip_ids, route_ids, and stop_ids that don\u2019t exist in the static feed. The root cause is a timing gap \u2014 static feeds update every few days, but operations change in real time. Operators also discovered that tools which normalize sequence values in static data silently break realtime feeds that reference those same sequences.`,
    evidence: [
      "Realtime best practices: 'Vehicle position should be within 200 meters of static shape data for the current trip.'",
      "Feed editing tools: Normalizing stop_sequence in an editor silently breaks realtime feeds targeting those sequences.",
      "Production API deployments: 'Known errors where realtime trip_id does not exist in static data due to legacy operational systems.' Teams worked around it with ID prefix-matching heuristics.",
      "Operators asking whether to use fake negative trip_ids for realtime trips not in static, because consumers assume trip_ids always exist."
    ],
    altoRisk: `ALTO\u2019s equivalent is the flight_id \u2194 flight_patterns.json link. A drone dispatched on an unscheduled urgent delivery will have a flight_id with no matching pattern_id in static. Weather diversions create mid-flight corridor changes that reference corridor_ids not in static. The problem is more acute than transit: drones operate at higher cadence (some operators do 15-min frequency), so static-RT drift compounds faster. Every realtime vehicle_position entity references a vehicle_id, corridor_id, and flight_id \u2014 three independent foreign keys all requiring static consistency.`,
    recommendation: `Define a formal ALTO "operational triplet": (flight_id, vehicle_id, corridor_id). Realtime feeds must declare whether each entity is SCHEDULED (anchored to static) or DYNAMIC (stand-alone). Dynamic entities must include all fields normally pulled from static \u2014 no silent lookups. Publish a static feed freshness SLA: operators must update static within 2 hours of any operational change. Add a realtime-only "dynamic_corridor" inline object for diversions, avoiding the broken-reference problem entirely.`
  },
  {
    id: "timestamps",
    title: "Timestamp & Timezone Ambiguity",
    severity: "critical",
    source: "Legacy Standards",
    problem: `Legacy transit time models are notoriously subtle: times measured from "noon minus 12 hours" of the service day \u2014 not midnight \u2014 specifically to handle DST transitions. Times after midnight are encoded as 24:30:00, 25:00:00, etc. This works for ground transit but produces edge cases: a bus at 00:02:00 with a -5 minute delay produces a negative time (-00:03:00), which the spec never explicitly handles. Multi-timezone operators (cross-border rail) require complex timezone gymnastics. EV charging protocols separately discovered that timestamp standardization across regions is one of their top recurring interoperability failures.`,
    evidence: [
      "Community discussion: 'Fun fact: the only proper way to encode a bus starting at 00:30:00 local time is to define it as 24:30:00 of the previous day.'",
      "Transit spec: times measured from 'noon minus 12h of the service day (effectively midnight except for days on which DST changes occur).'",
      "EV charging industry report: 'Timestamp standardization across regions' listed as top billing consistency issue. UTC vs local time ambiguity persists across 400+ implementations."
    ],
    altoRisk: `Drones operate 24/7 with no service-day abstraction. A delivery dispatched at 23:50 and landing at 00:10 crosses midnight \u2014 the exact failure zone ground transit struggles with. ALTO adds an altitude dimension to timing: a vehicle at 300 ft AGL experiences no timezone, but the vertiport it departs from and arrives at may be in different timezones (transborder corridors). The Delivery Result Record (DRR) must timestamp pickup and delivery to the second for SLA calculation \u2014 any ambiguity cascades into billing disputes. Weather hold timestamps need a "valid_from/valid_to in UTC" contract that can\u2019t drift.`,
    recommendation: `Mandate UTC everywhere in ALTO. No local time strings, no "noon minus 12h" abstractions. All timestamps are ISO 8601 with explicit Z suffix. Duration fields use integer seconds \u2014 never HH:MM:SS strings. Vertiports declare their IANA timezone independently for display purposes only. The DRR uses Unix epoch integers for start_time and end_time to make SLA arithmetic unambiguous. Add an explicit note in the spec: "ALTO timestamps are always UTC. Local time conversion is a consumer concern."`
  },
  {
    id: "delivery-targets",
    title: "Delivery Target Sensitivity & Landing Zone Diversity",
    severity: "critical",
    source: "Novel \u2014 Aerial Delivery",
    problem: `No prior mobility standard has had to model the extraordinary diversity of delivery endpoints. A residential front yard, a commercial loading dock, a hospital rooftop helipad, and a 40th-floor skyscraper balcony each present radically different approach profiles, obstacle environments, noise constraints, GPS accuracy requirements, and legal liability surfaces. Ground delivery simply stops at a door. Aerial delivery must negotiate three-dimensional approach corridors that vary by building type, wind patterns at altitude, rooftop furniture, overhead wires, and local noise ordinances. The landing zone is not a point \u2014 it\u2019s a volumetric envelope with constraints that change by time of day and weather.`,
    evidence: [
      "Residential deliveries face yard obstacles (trees, trampolines, clotheslines, play equipment) invisible to aerial mapping until they appear on approach. A front-yard landing zone valid in winter may be obstructed by foliage in summer.",
      "Commercial rooftop deliveries require HVAC unit avoidance, parapet clearance, wind shear modeling around building edges, and coordination with building management systems. Many rooftops have no standardized marking for aerial landing zones.",
      "High-rise deliveries compound GPS multipath errors from surrounding buildings, create complex wind tunnel effects between towers, and introduce vertical precision requirements (correct floor/balcony) that no ground delivery system has ever needed.",
      "Rural deliveries invert the problem: vast open space but no infrastructure \u2014 no GPS-augmented precision, no ground markers, and potentially no cellular connectivity for real-time guidance updates."
    ],
    altoRisk: `ALTO must model the delivery endpoint not as a simple lat/lon coordinate but as a rich landing_zone object with type classification (residential_ground, commercial_rooftop, high_rise_balcony, rural_open, medical_helipad), approach constraints (min clearance altitude, noise curfew windows, wind speed limits by direction), surface characteristics (hard surface vs grass, slope grade, load-bearing capacity), and obstruction metadata. A single delivery_point field will fail catastrophically across target diversity. The DRR must record which landing_zone profile was used and whether the actual landing matched the planned profile \u2014 critical for insurance claims and safety investigations.`,
    recommendation: `Define a landing_zone schema as a first-class ALTO object \u2014 not a field on vertiport. Include: zone_type enum (with open extension), approach_volume (3D bounding box or cone), surface_type, max_wind_speed_by_direction, noise_curfew_windows, gps_augmentation_required (boolean), vertical_precision_meters, and obstruction_last_surveyed timestamp. Require that every delivery entity references a landing_zone_id. Static feeds publish known landing zones; realtime feeds can declare ad-hoc zones with inline definitions for unplanned deliveries. Add a landing_zone_condition field in the realtime feed: VERIFIED, UNVERIFIED, OBSTRUCTED, CLOSED.`
  },
  {
    id: "ground-hazards",
    title: "Ground-Level Hazard & Damage Mitigation",
    severity: "critical",
    source: "Novel \u2014 Aerial Delivery",
    problem: `Aerial delivery introduces a hazard category that no prior mobility data standard has addressed: the interaction between an arriving aerial vehicle and the uncontrolled ground environment at the delivery point. Animals (particularly dogs) can attack landing vehicles, damaging both the drone and the payload. Children and bystanders may approach a descending vehicle. Wind wash from rotors can scatter loose objects. A failed landing can damage property \u2014 vehicles, garden furniture, roofing material. The vehicle itself becomes a projectile if it loses power at low altitude. Every delivery creates a brief but real exclusion zone on the ground that the spec must model.`,
    evidence: [
      "Field operations report consistent animal interference: dogs chase and bite descending vehicles, causing payload drops from 10\u201320 feet. Some operators have experienced multiple vehicle losses per month from animal encounters at residential delivery points.",
      "Liability analysis shows the moment of highest risk is the final 50 feet of descent and the first 50 feet of climb-out \u2014 where a vehicle is low, slow, and near people/property. Insurance underwriters require per-delivery risk scoring that accounts for ground conditions.",
      "Post-delivery damage claims include: rotor wash displacing patio umbrellas into pools, prop wash triggering car alarms and scattering recycling bins, failed landings denting vehicle hoods, and payload release mechanisms dropping packages from 15+ feet onto fragile items below.",
      "Bystander safety incidents during descent have prompted multiple municipalities to require real-time ground clearance verification before any vehicle drops below 50 feet AGL."
    ],
    altoRisk: `ALTO needs a ground_hazard_assessment model that travels with every delivery. This is not a static property of the landing zone \u2014 it changes per delivery. A residential address may be safe at 2pm on a weekday (no children, dog inside) and hazardous at 4pm (school out, dog in yard). The DRR must capture whether a ground clearance check was performed, what method was used (visual/sensor/none), and whether any ground incident occurred. Without this, ALTO has no mechanism for operators to report, learn from, or prevent ground-level damage \u2014 and regulators will mandate it if the spec doesn\u2019t.`,
    recommendation: `Add a ground_clearance object to the realtime delivery entity: clearance_method (visual_camera, lidar_scan, acoustic_sensor, none), clearance_status (CLEAR, OBSTRUCTED, ANIMAL_DETECTED, PERSON_DETECTED, UNKNOWN), clearance_timestamp, and abort_reason if the delivery was diverted. Define a delivery_incident field on the DRR: incident_type (animal_damage, property_damage, bystander_approach, payload_drop, rotor_wash_damage, none), severity (minor, major, critical), and a free-text description. Require that the realtime feed expose a ground_exclusion_zone polygon (typically 10\u201330m radius) around any active descent/ascent operation \u2014 other vehicles and planning systems must respect this zone.`
  },
  {
    id: "severe-weather-ops",
    title: "Severe Weather Operational Thresholds",
    severity: "critical",
    source: "Novel \u2014 Aerial Delivery",
    problem: `Prior mobility standards treat weather as informational \u2014 a service alert, an advisory. For aerial delivery, weather is an operational gate: specific wind speeds, precipitation rates, temperature extremes, and visibility minimums determine whether a flight can legally and safely operate. This is not about data staleness (covered separately under constraint invalidation) \u2014 it\u2019s about the spec needing to model weather as a first-class operational constraint with hard thresholds that trigger automatic behavioral changes in the system. A delivery promised in clear weather may need to be held, rerouted, or cancelled when conditions deteriorate, and the spec must model the entire decision chain.`,
    evidence: [
      "Sustained winds above 25 knots ground most small UAS operations. Gusts above 35 knots ground all current commercial delivery platforms. Yet no mobility data standard defines a machine-readable wind threshold that triggers operational state changes.",
      "Icing conditions (freezing rain, supercooled droplets) are immediately disqualifying for small UAS \u2014 even light icing degrades rotor efficiency by 15\u201330% and can cause complete loss of lift. Temperature alone is insufficient; humidity, dewpoint, and precipitation type must be evaluated together.",
      "Heavy precipitation degrades sensor performance: rain attenuates lidar returns, fog blinds optical cameras, snow accumulates on airframe surfaces. Operators report that moderate rain (>4mm/hr) reduces obstacle detection range by 40\u201360%, fundamentally changing the safe approach profile.",
      "Heat extremes (>40\u00b0C / 104\u00b0F) reduce battery capacity by 10\u201320% and increase motor temperatures, shrinking effective range. Cold extremes (<-10\u00b0C / 14\u00b0F) cause battery voltage sag and brittle structural components. Both require adjusted flight envelopes that the spec must express."
    ],
    altoRisk: `ALTO\u2019s weather_constraints fields currently exist on vertiports as static metadata. But weather thresholds are vehicle-class-specific (a heavy cargo drone tolerates more wind than a lightweight courier), route-specific (a corridor through an urban canyon has different wind dynamics than open terrain), and time-varying (a threshold safe at dawn may be unsafe at noon due to thermal convection). If ALTO models weather as a static vertiport property, operators will build proprietary weather decision systems outside the spec \u2014 destroying interoperability. Cross-operator handoffs become impossible if each operator has incompatible weather go/no-go logic.`,
    recommendation: `Define a weather_envelope schema per vehicle_class and per corridor: max_sustained_wind_knots, max_gust_knots, min_visibility_meters, max_precipitation_rate_mm_hr, temperature_range_c (min/max), icing_prohibited (boolean), and a composite weather_status enum in the realtime feed: GO, MARGINAL, NO_GO, UNKNOWN. The realtime feed must publish current weather_status per corridor and per vertiport, updated at minimum every 60 seconds. Add a weather_hold object to the delivery entity: hold_reason, hold_start_time, estimated_resume_time, and auto_cancel_after_seconds. Mandate that DRRs record weather conditions at departure and arrival for post-incident analysis. Define a weather_source_ref field linking to the authoritative meteorological data provider.`
  },
  {
    id: "multi-phase-delivery",
    title: "Multi-Phase Delivery & Vehicle Handoff",
    severity: "critical",
    source: "Novel \u2014 Aerial Delivery",
    problem: `Emerging delivery architectures split a single delivery into multiple phases performed by different vehicle types: a long-range aerial vehicle covers the high-altitude transit segment, then hands off the payload to a quiet ground-level delivery unit for the last-mile approach. This solves the noise problem (the loud aerial vehicle never descends into neighborhoods) and the precision problem (the ground unit navigates to the exact doorstep). But no mobility data standard has ever modeled a single logical delivery performed by multiple sequential vehicles with a mid-delivery handoff point. The tracking, billing, liability, and real-time position reporting all become multi-entity problems.`,
    evidence: [
      "Operators are deploying architectures where a fixed-wing or large multirotor carries payloads 10\u201350 km at altitude, then transfers to a small ground-based delivery robot for the final 0.5\u20132 km. The handoff occurs at a designated transfer station or directly via a tethered lowering mechanism.",
      "Noise regulations in residential areas increasingly restrict aerial vehicle operations below 200 ft AGL during certain hours. Multi-phase architectures are the primary compliance strategy: the noisy vehicle stays at altitude while the quiet unit handles the sensitive last mile.",
      "Tracking continuity breaks at the handoff: the aerial vehicle has one vehicle_id, the ground unit has another, but the customer sees a single delivery. Existing delivery tracking APIs lose the package during the 30\u201390 second handoff window.",
      "Liability transfer at the handoff point is legally significant: if the payload is damaged during transfer, which operator/vehicle is responsible? The spec must capture the exact moment of custody transfer with sub-second precision."
    ],
    altoRisk: `ALTO\u2019s current model assumes one flight_id maps to one vehicle_id for the duration of a delivery. Multi-phase delivery breaks this assumption completely. A single delivery_id must span multiple flight_ids (one per phase), multiple vehicle_ids (aerial unit + ground unit), and potentially multiple corridor_ids (aerial corridor + ground path). The DRR must attribute cost, energy, carbon, and time to each phase independently while rolling up to a single delivery total. Real-time tracking must show the customer a unified delivery progress even as the underlying vehicle changes. If ALTO doesn\u2019t model this natively, operators will build proprietary orchestration layers that fragment the ecosystem.`,
    recommendation: `Introduce a delivery_phase schema: each delivery consists of one or more ordered phases, each with its own flight_id, vehicle_id, corridor_id, and phase_type (AERIAL_TRANSIT, GROUND_DELIVERY, TETHERED_DESCENT, HOVER_HANDOFF). Add a handoff object between phases: handoff_point (lat/lon/alt), handoff_type (station_transfer, aerial_to_ground, tethered_lower), custody_transfer_timestamp, and handoff_status (PENDING, IN_PROGRESS, COMPLETED, FAILED). The DRR includes a phases[] array with per-phase cost, duration, distance, and energy. Real-time feeds expose the current active phase and next expected phase. The delivery_id is the only stable identifier across the entire multi-phase operation \u2014 all phase-level IDs are children of it.`
  },
  {
    id: "stale-feeds",
    title: "Stale Feed Behavior & Feed Health",
    severity: "high",
    source: "Realtime Feeds",
    problem: `Legacy realtime transit feeds treat every fetch as a complete state snapshot \u2014 a feed that stops updating doesn\u2019t explicitly say "no change," it simply goes stale. Different consumers define staleness differently: one platform discards vehicle positions older than 15 minutes; another drops trip updates with headers older than 10 minutes; stale alerts are kept indefinitely. This inconsistency means a producer can comply with the spec and still fail with specific platforms. Feeds are expected to be stateless \u2014 every fetch returns the full current world state \u2014 making incremental updates impossible.`,
    evidence: [
      "Realtime best practices: 'Data should not be older than 90 seconds for trip updates and vehicle positions, not older than 10 minutes for service alerts.'",
      "Major trip planning platform: 'Feed considered stale after 1 hour without updated feed timestamp. Entire feed will be discarded.'",
      "Consumer app: 'If the header of the trip update feed is older than 10 minutes, we drop updates and revert to showing scheduled times.'"
    ],
    altoRisk: `A stale drone position feed is a safety problem, not just a UX problem. A vehicle shown at the wrong position could mislead conflict detection systems or emergency responders. ALTO must define staleness with precision: vehicle_positions older than 5 seconds are suspect; flight_updates older than 30 seconds should trigger a consumer warning; alerts should have explicit expiry timestamps rather than relying on feed refresh absence. Unlike ground transit, ALTO can\u2019t afford consumer-defined staleness thresholds. The consequence of a stale drone position is categorically higher than a stale bus ETA.`,
    recommendation: `Define three explicit staleness tiers in the spec with hard numbers: CRITICAL (vehicle_positions: max age 5s), OPERATIONAL (flight_updates: max age 30s), INFORMATIONAL (alerts: max age 10min). All realtime entities must include a max_valid_until field \u2014 a UTC timestamp after which the consumer must treat the record as expired, not merely stale. Feed health endpoint required: GET /alto/v1/health returns feed freshness, last update time, and a degraded/healthy status. Encode this into the validator.`
  },
  {
    id: "cdr-record",
    title: "Completion Record (DRR) Integrity & Billing",
    severity: "high",
    source: "EV Charging Protocols",
    problem: `EV charging billing records are the most troubled object in charging network protocols. Issues discovered across hundreds of deployments: billing records can be sent at any time (including mid-session), making real-time cost calculation impossible; record format differs significantly across providers; session_id was optional in early versions, making record-to-session linking unreliable; no built-in mechanism for corrected or amended records until "credit records" were added in later versions; the final session cost calculation algorithm was never specified \u2014 implementers invented their own.`,
    evidence: [
      "Industry report: 'Fragile session-record linking, inconsistent record formats, billing records can be sent at any time \u2014 making real-time billing impossible.'",
      "Protocol analysis: 'Billing records can be sent at any time, which makes real-time billing impossible. The financial model is mostly left out of the protocol \u2014 how to calculate final session cost isn\u2019t explained.'",
      "Protocol changelog: Credit records, session_id, and authorization references were added in later versions \u2014 all addressing billing reliability gaps from prior versions."
    ],
    altoRisk: `The ALTO DRR (Delivery Result Record) carries more commercial weight than a charging billing record: SLA compliance flags, carbon accounting, proof-of-delivery photos, declared cargo value, and cross-operator settlement amounts all depend on it. A DRR that can be amended post-facto, or that doesn\u2019t specify when it becomes immutable, creates fraud surface. Roaming handoffs double the risk: two operators each produce partial records for a single delivery, and they must reconcile.`,
    recommendation: `Define the DRR lifecycle with explicit state machine: DRAFT \u2192 PROVISIONAL \u2192 FINAL \u2192 DISPUTED. Only DRAFT and PROVISIONAL can be modified. FINAL is immutable (hash-signed). DISPUTED triggers a resolution flow. Specify exact timing: DRR must reach PROVISIONAL within 60 seconds of delivery confirmation; FINAL within 24 hours. Roaming handoffs produce two linked DRRs (one per operator) with a shared handoff_id foreign key. Mandate the cost calculation algorithm in the spec \u2014 don\u2019t leave it to implementers.`
  },
  {
    id: "enum-sprawl",
    title: "Enum Sprawl & Field Value Abandonment",
    severity: "high",
    source: "Legacy Standards",
    problem: `Protobuf-based mobility standards suffer from a permanent constraint: once a field number or enum value is assigned, it can never be reused \u2014 even if the feature it represented is abandoned. This creates permanent dead space in the spec. Experimental fields get stranded for years with no route to graduation. Role-based protocols separately suffered from their original role model (only two participant types) being extended in a bolt-on way when new roles were added, creating a messy role system that developers describe as "a mess" in production.`,
    evidence: [
      "Community discussion: 'To my knowledge we haven\u2019t yet had a field exit experimental status under this approach' \u2014 experimental fields get stranded indefinitely.",
      "Protocol spec note: 'If not [adopted], we set aside the .proto field value (it can\u2019t be re-used) and remove the field from the spec.'",
      "Industry analysis: 'The way roles are handled is kind of a mess. Originally two roles. Later, a third was added \u2014 in a patchy, bolt-on way that doesn\u2019t really fit into the original model.'"
    ],
    altoRisk: `ALTO\u2019s vehicle_class and vertiport_type enums will expand as the industry matures. AAM passenger vehicles are coming. Cargo drone categories will splinter (medical cold-chain vs retail vs hazmat). If ALTO bakes closed enums into v0.1, every new vehicle class requires a spec version bump. The roaming API will grow new participant roles beyond Operator (regulators, city planners, emergency services will want read access). The delivery extension will need new cargo categories (live organ transport, chemotherapy agents).`,
    recommendation: `Use open enums everywhere \u2014 define a core set but allow custom string values with a vendor prefix pattern (e.g., "x-vendor-evtol"). Reserve a formal extension namespace. For Protobuf bindings, use string types for all user-facing enums. Create an official ALTO Extension Registry (hosted on a public repo) where new values can be proposed and ratified without a spec version bump. Define a clear lifecycle: proposed \u2192 experimental \u2192 ratified \u2192 deprecated.`
  },
  {
    id: "on-demand-mismatch",
    title: "On-Demand vs Scheduled Paradigm Mismatch",
    severity: "high",
    source: "Legacy Standards",
    problem: `Legacy transit data standards were built for fixed-route scheduled transit. Demand-responsive transit (DRT) was bolted on as an extension, and it took 11 years from initial proposal to official adoption. Even after adoption, most major trip planning platforms still don\u2019t consume the on-demand data. The core tension: the trip model assumes a vehicle visits stops in a fixed sequence at scheduled times. Demand-responsive service required a completely different mental model (zones, booking windows, conditional stop visits) that sits awkwardly alongside the existing model.`,
    evidence: [
      "Research report: 'Over half of US public transportation services are unavailable in trip planning applications' \u2014 the direct cost of fixing demand-responsive transit as an afterthought.",
      "Industry blog: 'It took 11 years of collaborative work across many organizations to get demand-responsive extensions officially adopted.'",
      "As of 2025, major mapping platforms have still not implemented demand-responsive data support despite official spec adoption."
    ],
    altoRisk: `Drone delivery is inherently on-demand \u2014 ALTO\u2019s primary use case is what ground transit spent 11 years failing to model. If ALTO\u2019s core data model is designed around the scheduled flight_patterns.json file with on-demand as an afterthought, it will repeat that decade-long mistake. An on-demand delivery has no pattern_id, no pre-defined waypoints, and a dynamically assigned vehicle. The static/realtime split itself may be the wrong primitive for a fully dynamic system.`,
    recommendation: `Invert the default assumption. In ALTO, on_demand is the primary flight type; scheduled is the special case. The static feed models fleet capacity and corridor availability windows \u2014 not fixed timetables. The realtime feed is where actual flights live. This mirrors how ride-share platforms work (they don\u2019t publish a schedule). Consider a third feed type: operational, updated every 1\u20135 minutes, sitting between static (days-old) and realtime (seconds-old). This avoids the static-RT sync problem for the majority of ALTO deployments.`
  },
  {
    id: "id-namespacing",
    title: "Global ID Uniqueness & Namespacing",
    severity: "medium",
    source: "Legacy Standards",
    problem: `Legacy transit IDs (stop_id, route_id, trip_id) are only required to be unique within a single feed. When aggregators combine feeds from multiple agencies, ID collisions are common and require prefix-mangling workarounds. Validator rules require globally unique GeoJSON feature IDs \u2014 a rule consistently violated in production. EV charging protocols addressed this later by adding country_code and party_id to billing tokens for globally unique identification \u2014 a fix that required a spec version bump.`,
    evidence: [
      "Validator: Route network identifiers 'redundantly defined in more than one file' is a common production error.",
      "Realtime specs: 'If separate position and update feeds are provided, descriptor ID values should match between the two feeds' \u2014 this fails silently when agencies have overlapping ID spaces.",
      "EV charging protocol changelog: 'Billing token now includes country_code and party_id for globally unique identification' \u2014 this was missing in earlier versions."
    ],
    altoRisk: `ALTO will aggregate feeds from multiple delivery operators and municipal operators simultaneously. A vehicle_id of "drone-001" is guaranteed to collide. A vertiport_id of "HUB-01" across three operators in the same city is a real scenario. The roaming API specifically requires cross-operator ID resolution \u2014 a handoff_id must be uniquely traceable across the networks of both operators. Collision today, regulatory dispute tomorrow.`,
    recommendation: `Mandate globally unique IDs from day one using a URI scheme: {agency_id}/{object_type}/{local_id}. Example: delivery-us-west/vehicle/x2-007. For the roaming API, adopt a country_code + party_id pattern. All DRR and delivery_id fields must include the originating agency_id as a namespace prefix. Publish a global ALTO Registry (public repo) where agency_ids are claimed and verified \u2014 preventing namespace collisions across operators.`
  },
  {
    id: "weather-invalidation",
    title: "Dynamic Constraint Invalidation (Weather / Airspace)",
    severity: "medium",
    source: "Novel \u2014 Aerial Delivery",
    problem: `No prior mobility data standard has a concept of operational constraints that dynamically invalidate static data. Transit routes don\u2019t disappear when it rains. EV chargers aren\u2019t blocked by a NOTAM. ALTO is the first mobility data standard where a static feed object (a corridor, a vertiport) can become temporarily invalid due to external constraints \u2014 weather, temporary flight restrictions (TFRs), emergency airspace closures \u2014 that are themselves managed by a separate authority (aviation regulators).`,
    evidence: [
      "UTM framework: 'Aviation authorities will provide real-time constraints to UAS operators, who are responsible for managing their operations within these constraints.'",
      "ALTO v0.1 spec: weather_constraints fields exist on vertiports, but no mechanism exists to signal when those constraints are breached in realtime.",
      "Regulatory transitions: Geofence format changes between successive regulatory editions show that geofence formats change over time, requiring translation layers."
    ],
    altoRisk: `A consumer reads the static ALTO feed, sees a corridor is available, and plans a delivery. A TFR is issued mid-planning. The static feed is now wrong, the realtime alert feed may not yet reflect it, and the UTM geofence system (a separate authority) is the ground truth. ALTO data can become not just stale but actively dangerous if a consumer uses static data without checking realtime constraints. This is an entirely new failure mode with no precedent in prior mobility standards.`,
    recommendation: `Introduce a formal ALTO Constraint Invalidation model. Every static entity (corridor, vertiport) has a constraint_status field in the realtime feed: NOMINAL, CONSTRAINED, or CLOSED. Consumers must treat static data as indicative and realtime constraint_status as authoritative. Add a utm_constraint_ref field that links ALTO alerts to the authoritative UTM/LAANC/NOTAM reference. Define a "dead reckoning" rule: if constraint_status has not been updated in X seconds, consumer must treat the entity as UNKNOWN (not NOMINAL). This makes the unknown-unknown case explicit.`
  },
  {
    id: "governance",
    title: "Governance, Stewardship & Contributor Capture",
    severity: "medium",
    source: "Legacy Standards",
    problem: `One major transit data standard was created by a single tech company and a single transit agency. For over a decade, that company effectively controlled the spec \u2014 its product needs drove the standard\u2019s evolution. A nonprofit stewardship body was created years later partly to address this. EV charging protocols have the opposite problem: governed by a foundation whose "Full Contributors" pay fees to participate in development \u2014 the current development branch is private to paying members, creating a two-tier spec community. Both models create adoption friction and community mistrust.`,
    evidence: [
      "Community discussion: Frustration at a single company\u2019s unilateral pace-setting for what is nominally an open standard.",
      "EV charging protocol repo: 'Development of the next major version is done in a private repository, which is only accessible to Contributors of the governing foundation.'",
      "Demand-responsive transit extensions: Took 11 years and explicit nonprofit stewardship to get adopted \u2014 partly due to governance friction."
    ],
    altoRisk: `Major drone delivery operators will all want to shape ALTO to fit their operational models. If one operator gets disproportionate governance influence, ALTO becomes a de facto proprietary standard with an open veneer \u2014 exactly what happened to earlier mobility standards. Conversely, a closed contributor model will exclude the cities, regulators, and small operators who need ALTO most.`,
    recommendation: `Publish ALTO under a recognized open-source foundation governance model from day one \u2014 not a company-controlled repo. Form a Technical Steering Committee with mandatory representation from: operators (max 40% of votes), cities/regulators (min 25%), independent developers (min 25%), and safety/consumer advocates (min 10%). All spec development in the open on a public repository. No private development track. File this as a founding document at the same time as the spec.`
  }
];

const SEVERITY_CONFIG = {
  critical: { color: "#F87171", label: "CRITICAL" },
  high: { color: "#FB923C", label: "HIGH" },
  medium: { color: "#FBBF24", label: "MEDIUM" },
};

const SOURCE_CONFIG = {
  "Legacy Standards": { color: "#A78BFA" },
  "Realtime Feeds": { color: "#818CF8" },
  "EV Charging Protocols": { color: "#34D399" },
  "Novel \u2014 Aerial Delivery": { color: "#F472B6" },
};

export default function ALTOLessons() {
  const [selected, setSelected] = useState(ISSUES[0].id);
  const [tab, setTab] = useState("problem");

  const issue = ISSUES.find(i => i.id === selected);
  const sc = SEVERITY_CONFIG[issue.severity];
  const src = SOURCE_CONFIG[issue.source] || { color: "#94A3B8" };

  const s = {
    root: { fontFamily: "'DM Mono', 'IBM Plex Mono', monospace", background: "#060910", color: "#CBD5E1", minHeight: "100vh", display: "flex" },
    left: { width: "260px", background: "#080C14", borderRight: "1px solid #0F172A", padding: "24px 0", flexShrink: 0, overflowY: "auto" },
    header: { padding: "0 20px 20px", borderBottom: "1px solid #0F172A" },
    logoText: { fontSize: "18px", fontWeight: 800, color: "#38BDF8", letterSpacing: "-0.03em" },
    logoSub: { fontSize: "9px", color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "2px" },
    issueItem: (on) => ({
      padding: "12px 20px", cursor: "pointer",
      background: on ? "#38BDF810" : "transparent",
      borderLeft: `2px solid ${on ? "#38BDF8" : "transparent"}`,
      transition: "all 0.12s"
    }),
    issueTitle: (on) => ({ fontSize: "11px", fontWeight: on ? 700 : 400, color: on ? "#E2E8F0" : "#475569", lineHeight: 1.4 }),
    main: { flex: 1, padding: "32px 36px", overflowY: "auto", maxHeight: "100vh" },
    titleRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" },
    h1: { fontSize: "18px", fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.02em" },
    badge: (color) => ({
      display: "inline-block", padding: "2px 8px", borderRadius: "3px",
      fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
      background: color + "18", color, border: `1px solid ${color}30`
    }),
    tabs: { display: "flex", gap: "0", marginBottom: "20px", borderBottom: "1px solid #0F172A" },
    tab: (on) => ({
      padding: "8px 16px", cursor: "pointer", fontSize: "11px", fontWeight: on ? 700 : 400,
      color: on ? "#38BDF8" : "#475569", borderBottom: `2px solid ${on ? "#38BDF8" : "transparent"}`,
      transition: "all 0.12s", letterSpacing: "0.04em", textTransform: "uppercase"
    }),
    body: { fontSize: "12px", color: "#94A3B8", lineHeight: 1.75, marginBottom: "16px" },
    evidenceItem: { background: "#0A1020", border: "1px solid #1E293B", borderRadius: "6px", padding: "12px 14px", marginBottom: "8px", fontSize: "11px", color: "#64748B", lineHeight: 1.65, borderLeft: "3px solid #1E293B" },
    riskBox: { background: "#F871710A", border: "1px solid #F8717130", borderRadius: "6px", padding: "16px", marginBottom: "12px" },
    recBox: { background: "#38BDF80A", border: "1px solid #38BDF830", borderRadius: "6px", padding: "16px" },
    label: { fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" },
  };

  const criticalCount = ISSUES.filter(i => i.severity === "critical").length;
  const highCount = ISSUES.filter(i => i.severity === "high").length;
  const mediumCount = ISSUES.filter(i => i.severity === "medium").length;

  const exposureReason = {
    versioning: "ALTO has more breaking-change surface \u2014 weather, altitude layers, and UTM refs all evolve independently.",
    "static-rt-sync": "Drones operate at 15-min+ frequency. Static-RT drift compounds faster than ground transit.",
    timestamps: "DRRs need second-precision for SLA billing. Ground transit only needed minute precision for trip planning.",
    "delivery-targets": "Every delivery endpoint is unique. Ground delivery stops at a door; aerial delivery must negotiate a 3D volumetric approach.",
    "ground-hazards": "No prior standard models the uncontrolled ground environment. Animals, bystanders, and property damage are aerial-only risks.",
    "severe-weather-ops": "Weather is an operational gate for drones, not just an advisory. Hard thresholds determine whether flights can legally operate.",
    "multi-phase-delivery": "Multi-vehicle delivery chains break the one-flight-one-vehicle assumption. Tracking, billing, and liability all become multi-entity.",
    "stale-feeds": "Stale drone position = safety risk, not just UX degradation. The stakes are categorically higher.",
    "cdr-record": "DRR carries commercial, legal, and carbon accounting weight. More fields, more dispute surface.",
    "enum-sprawl": "Vehicle classes, vertiport types, and cargo categories will all expand faster than ground transit route types.",
    "on-demand-mismatch": "On-demand is ALTO\u2019s default mode \u2014 not a bolt-on. Building it in from day one avoids a decade of pain.",
    "id-namespacing": "Cross-operator delivery tracking requires globally unique IDs \u2014 not just feed-unique IDs.",
    "weather-invalidation": "No prior mobility standard has had to handle externally-invalidated static data. Entirely novel problem.",
    governance: "Major operators all have resources to capture a weakly-governed spec.",
  };

  return (
    <div style={s.root}>
      <nav style={s.left}>
        <div style={s.header}>
          <div style={s.logoText}>ALTO</div>
          <div style={s.logoSub}>Spec Design Lessons</div>
          <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={s.badge("#F87171")}>{criticalCount} critical</span>
            <span style={s.badge("#FB923C")}>{highCount} high</span>
            <span style={s.badge("#FBBF24")}>{mediumCount} medium</span>
          </div>
        </div>
        <div style={{ paddingTop: "8px" }}>
          {ISSUES.map(iss => {
            const isc = SEVERITY_CONFIG[iss.severity];
            return (
              <div key={iss.id} style={s.issueItem(selected === iss.id)} onClick={() => { setSelected(iss.id); setTab("problem"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={s.issueTitle(selected === iss.id)}>{iss.title}</div>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isc.color, flexShrink: 0, marginTop: "4px" }} />
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.titleRow}>
          <h1 style={s.h1}>{issue.title}</h1>
          <span style={s.badge(sc.color)}>{sc.label}</span>
          <span style={s.badge(src.color)}>{issue.source}</span>
        </div>

        <div style={s.tabs}>
          {["problem", "evidence", "alto_risk", "recommendation"].map(t => (
            <div key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
              {t === "alto_risk" ? "ALTO Risk" : t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        {tab === "problem" && (
          <div>
            <p style={s.body}>{issue.problem}</p>
            <div style={{ ...s.riskBox, background: "#38BDF80A", border: "1px solid #38BDF820" }}>
              <div style={{ ...s.label, color: "#38BDF8" }}>Quick Evidence Preview</div>
              <p style={{ ...s.body, marginBottom: 0, color: "#475569", fontSize: "11px" }}>{issue.evidence[0]}</p>
            </div>
          </div>
        )}

        {tab === "evidence" && (
          <div>
            <div style={{ ...s.label, color: "#64748B" }}>Source Citations ({issue.evidence.length})</div>
            {issue.evidence.map((e, i) => (
              <div key={i} style={{ ...s.evidenceItem, borderLeftColor: src.color + "60" }}>
                <span style={{ color: src.color, fontWeight: 700, marginRight: "6px" }}>[{i + 1}]</span>{e}
              </div>
            ))}
          </div>
        )}

        {tab === "alto_risk" && (
          <div>
            <div style={s.riskBox}>
              <div style={{ ...s.label, color: "#F87171" }}>ALTO-Specific Risk</div>
              <p style={{ ...s.body, marginBottom: 0, color: "#CBD5E1" }}>{issue.altoRisk}</p>
            </div>
            <div style={{ background: "#0F172A", borderRadius: "6px", padding: "14px", border: "1px solid #1E293B" }}>
              <div style={{ ...s.label, color: "#64748B" }}>Why ALTO is More Exposed Than Prior Standards</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.7 }}>
                {exposureReason[issue.id]}
              </div>
            </div>
          </div>
        )}

        {tab === "recommendation" && (
          <div>
            <div style={s.recBox}>
              <div style={{ ...s.label, color: "#34D399" }}>Recommended ALTO Design Decision</div>
              <p style={{ ...s.body, marginBottom: 0, color: "#CBD5E1" }}>{issue.recommendation}</p>
            </div>
            <div style={{ marginTop: "14px", background: "#0A1020", borderRadius: "6px", padding: "14px", border: "1px solid #0F172A" }}>
              <div style={{ ...s.label, color: "#64748B" }}>When to Address</div>
              <p style={{ fontSize: "11px", color: "#475569", lineHeight: 1.7, marginBottom: 0 }}>
                {issue.severity === "critical" && "Must be in v0.1. Retrofitting this after adoption is extremely painful \u2014 prior standards prove this."}
                {issue.severity === "high" && "Should be in v0.1 or formally deferred to v0.2 with a placeholder. Don\u2019t leave it undefined."}
                {issue.severity === "medium" && "Target v0.2. Document the known gap in v0.1 so early adopters build around it, not into it."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
