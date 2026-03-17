import { useState } from "react";

const ISSUES = [
  {
    id: "versioning",
    title: "Versioning & Breaking Changes",
    severity: "critical",
    source: "GTFS + OCPI",
    problem: `GTFS had no formal version numbers for years \u2014 relying on Git commit dates as "versions." When Fares V2 arrived, it created the first real backward-incompatibility crisis: two parallel models (V1 and V2) now co-exist indefinitely. OCPI is worse: versions 2.1.1, 2.2, 2.2.1, 2.3.0, and 3.0 all live simultaneously in production deployments, forcing implementers to maintain multi-version compatibility matrices.`,
    evidence: [
      "GTFS versioning GitHub issue #215: 'I believe the easy reason why GTFS has not used a versioning system is because it doesn\u2019t (hardly ever?) add any breaking changes' \u2014 until Fares V2 broke that assumption.",
      "OCPI 2.1.1 officially deprecated, but many hubs still require it. Implementers must support 3+ versions simultaneously.",
      "GTFS validator v4.0 found 73 of 1200 production feeds broke on Fares V2 rule addition alone."
    ],
    altoRisk: `ALTO has more breaking-change surface than GTFS. Weather constraints, altitude layers, and UTM regulatory references will all evolve as regulation matures. A UTM geo-zone format change (ED-269 \u2192 ED-318 is already happening) could cascade into a breaking schema change. On-demand drone delivery is ALTO\u2019s default mode \u2014 not an extension \u2014 so any change to the delivery object has maximum impact.`,
    recommendation: `Adopt strict semver from day one. Major version = breaking change. Lock the Protobuf field enum space immediately. Establish a formal deprecation window (min 18 months) for any removed field. Never rename a field \u2014 add a new one and deprecate the old. Adopt OCPI\u2019s "documentation revision" pattern: doc-only fixes get d2/d3 suffixes; no field changes allowed in doc revisions.`
  },
  {
    id: "static-rt-sync",
    title: "Static \u2194 Realtime ID Synchronization",
    severity: "critical",
    source: "GTFS-RT",
    problem: `GTFS-RT\u2019s most common and damaging failure mode: realtime feeds reference trip_ids, route_ids, and stop_ids that don\u2019t exist in the static feed. The root cause is a timing gap \u2014 static feeds update every few days, but operations change in real time. Operators also discovered that tools that normalize stop_sequence values in static data silently break RT feeds that reference those same sequences.`,
    evidence: [
      "GTFS-RT best practices: 'Vehicle position should be within 200 meters of GTFS shapes.txt data for the current trip.'",
      "GitHub conveyal/gtfs-lib #283: Normalizing stop_sequence in editor silently breaks RT feeds targeting those sequences.",
      "Malaysia API: 'Known errors E003 (RT trip_id does not exist in GTFS data) and E004 (RT route_id does not exist) due to legacy operational systems.' Teams worked around it with ID prefix-matching heuristics.",
      "GitHub issue #529: Operators asking whether to use fake negative trip_ids for RT trips not in static, because consumers assume trip_ids always exist."
    ],
    altoRisk: `ALTO\u2019s equivalent is the flight_id \u2194 flight_patterns.json link. A drone dispatched on an unscheduled urgent delivery will have a flight_id with no matching pattern_id in static. Weather diversions create mid-flight corridor changes that reference corridor_ids not in static. The problem is more acute than transit: drones operate at higher cadence (Wing does 15-min frequency), so static-RT drift compounds faster. Every realtime vehicle_position entity references a vehicle_id, corridor_id, and flight_id \u2014 three independent foreign keys all requiring static consistency.`,
    recommendation: `Define a formal ALTO "operational triplet": (flight_id, vehicle_id, corridor_id). Realtime feeds must declare whether each entity is SCHEDULED (anchored to static) or DYNAMIC (stand-alone). Dynamic entities must include all fields normally pulled from static \u2014 no silent lookups. Publish a static feed freshness SLA: operators must update static within 2 hours of any operational change. Add a realtime-only "dynamic_corridor" inline object for diversions, avoiding the broken-reference problem entirely.`
  },
  {
    id: "timestamps",
    title: "Timestamp & Timezone Ambiguity",
    severity: "critical",
    source: "GTFS + OCPI",
    problem: `GTFS\u2019s time model is notoriously subtle: times are measured from "noon minus 12 hours" of the service day \u2014 not midnight \u2014 specifically to handle DST transitions. Times after midnight are encoded as 24:30:00, 25:00:00, etc. This works for ground transit but produces edge cases: a bus at 00:02:00 with a -5 minute delay produces a negative time (-00:03:00), which the spec never explicitly handles. Multi-timezone operators (Eurostar London\u2192Paris) require complex timezone gymnastics. OCPI separately discovered CDR timestamp standardization across regions is one of its top recurring interoperability failures.`,
    evidence: [
      "GTFS Google Group: 'Fun fact: the only proper way to encode a bus starting at 00:30:00 local time is to define it as 24:30:00 of the previous day.'",
      "GTFS spec: times measured from 'noon minus 12h of the service day (effectively midnight except for days on which DST changes occur).'",
      "OCPI 2025 ChargeX report: 'Timestamp standardization across regions' listed as top CDR consistency issue. UTC vs local time ambiguity persists across 400+ implementations."
    ],
    altoRisk: `Drones operate 24/7 with no service-day abstraction. A delivery dispatched at 23:50 and landing at 00:10 crosses midnight \u2014 the exact failure zone GTFS struggles with. ALTO adds an altitude dimension to timing: a vehicle at 300 ft AGL experiences no timezone, but the vertiport it departs from and arrives at may be in different timezones (transborder corridors). The Delivery Result Record (DRR) must timestamp pickup and delivery to the second for SLA calculation \u2014 any ambiguity cascades into billing disputes. Weather hold timestamps need a "valid_from/valid_to in UTC" contract that can\u2019t drift.`,
    recommendation: `Mandate UTC everywhere in ALTO. No local time strings, no "noon minus 12h" abstractions. All timestamps are ISO 8601 with explicit Z suffix. Duration fields use integer seconds \u2014 never HH:MM:SS strings. Vertiports declare their IANA timezone independently for display purposes only. The DRR uses Unix epoch integers for start_time and end_time to make SLA arithmetic unambiguous. Add an explicit note in the spec: "ALTO timestamps are always UTC. Local time conversion is a consumer concern."`
  },
  {
    id: "stale-feeds",
    title: "Stale Feed Behavior & Feed Health",
    severity: "high",
    source: "GTFS-RT",
    problem: `GTFS-RT treats every feed as a complete state snapshot \u2014 a feed that stops updating doesn\u2019t explicitly say "no change," it simply goes stale. Different consumers define staleness differently: Google discards vehicle positions older than 15 minutes; Transit App drops TripUpdates with headers older than 10 minutes; stale alerts are kept indefinitely. This inconsistency across consumers means a producer can comply with the spec and still fail with specific platforms. Feeds are also expected to be stateless \u2014 every fetch returns the full current world state \u2014 making incremental updates impossible.`,
    evidence: [
      "GTFS-RT best practices: 'Data should not be older than 90 seconds for Trip Updates and Vehicle Positions, not older than 10 minutes for Service Alerts.'",
      "Google Transit: 'Feed considered stale after 1 hour without updated feed timestamp. Entire feed will be discarded.'",
      "Transit App: 'If the header of the TripUpdate protobuf is older than 10 minutes, we drop TripUpdates and revert to showing scheduled times.'"
    ],
    altoRisk: `A stale drone position feed is a safety problem, not just a UX problem. A vehicle shown at the wrong position could mislead conflict detection systems or emergency responders. ALTO must define staleness with precision: vehicle_positions older than 5 seconds are suspect; flight_updates older than 30 seconds should trigger a consumer warning; alerts should have explicit expiry timestamps rather than relying on feed refresh absence. Unlike GTFS, ALTO can\u2019t afford consumer-defined staleness thresholds. The consequence of a stale drone position is higher than a stale bus ETA.`,
    recommendation: `Define three explicit staleness tiers in the spec with hard numbers: CRITICAL (vehicle_positions: max age 5s), OPERATIONAL (flight_updates: max age 30s), INFORMATIONAL (alerts: max age 10min). All realtime entities must include a max_valid_until field \u2014 a UTC timestamp after which the consumer must treat the record as expired, not merely stale. Feed health endpoint required: GET /alto/v1/health returns feed freshness, last update time, and a degraded/healthy status. Encode this into the validator.`
  },
  {
    id: "cdr-record",
    title: "Completion Record (DRR) Integrity & Billing",
    severity: "high",
    source: "OCPI",
    problem: `OCPI\u2019s CDR (Charge Detail Record) is its most troubled object. Issues discovered across hundreds of deployments: CDRs can be sent at any time (including mid-session), making real-time billing calculation impossible; CDR format differs significantly across CPOs; session_id was optional in early versions, making CDR-to-session linking unreliable; no built-in mechanism for corrected or amended CDRs until "Credit CDRs" were added in v2.2; the final session cost calculation algorithm is not specified \u2014 implementers invented their own.`,
    evidence: [
      "OCPI 2025 ChargeX report: 'Fragile session-CDR linking, inconsistent CDR formats, CDR can be sent at any time \u2014 making real-time billing impossible.'",
      "Medium OCPI analysis: 'CDR can be sent at any time, which makes real-time billing impossible. The financial model is mostly left out of the protocol \u2014 how to calculate final session cost isn\u2019t explained.'",
      "OCPI 2.2.1 changelog: Added Credit CDRs, session_id, AuthorizationReference \u2014 all addressing CDR reliability gaps from prior versions."
    ],
    altoRisk: `The ALTO DRR (Delivery Result Record) carries more commercial weight than a CDR: SLA compliance flags, carbon accounting, proof-of-delivery photos, declared cargo value, and cross-operator settlement amounts all depend on it. A DRR that can be amended post-facto, or that doesn\u2019t specify when it becomes immutable, creates fraud surface. Roaming handoffs double the risk: two operators each produce partial records for a single delivery, and they must reconcile.`,
    recommendation: `Define the DRR lifecycle with explicit state machine: DRAFT \u2192 PROVISIONAL \u2192 FINAL \u2192 DISPUTED. Only DRAFT and PROVISIONAL can be modified. FINAL is immutable (hash-signed). DISPUTED triggers a resolution flow. Specify exact timing: DRR must reach PROVISIONAL within 60 seconds of delivery confirmation; FINAL within 24 hours. Roaming handoffs produce two linked DRRs (one per operator) with a shared handoff_id foreign key. Mandate the cost calculation algorithm in the spec \u2014 don\u2019t leave it to implementers.`
  },
  {
    id: "enum-sprawl",
    title: "Enum Sprawl & Field Value Abandonment",
    severity: "high",
    source: "GTFS-RT + OCPI",
    problem: `GTFS-RT uses Protobuf, where once a field number or enum value is assigned, it can never be reused \u2014 even if the feature it represented is abandoned. This creates permanent dead space in the spec. The OccupancyStatus field was marked experimental for years with no route to graduation. OCPI separately suffered from roles \u2014 originally CPO and eMSP only \u2014 being extended in a bolt-on way when HUB was added, creating a messy role model that developers describe as "a mess" in production.`,
    evidence: [
      "GTFS-RT GitHub issue #101: 'To my knowledge we haven\u2019t yet had a field exit experimental status under this approach' \u2014 experimental fields get stranded.",
      "GTFS-RT spec note: 'If not [adopted], we set aside the .proto field value (it can\u2019t be re-used) and remove the field from the spec.'",
      "Medium OCPI analysis: 'The way roles are handled is kind of a mess. Originally CPO and EMSP. Later, HUB was added \u2014 in a patchy, bolt-on way that doesn\u2019t really fit into the original model.'"
    ],
    altoRisk: `ALTO\u2019s vehicle_class and vertiport_type enums will expand as the industry matures. AAM passenger vehicles (Joby, Archer, Lilium) are coming. Cargo drone categories will splinter (medical cold-chain vs retail vs hazmat). If ALTO bakes closed enums into v0.1, every new vehicle class requires a spec version bump. The roaming API will grow new participant roles beyond Operator (regulators, city planners, emergency services will want read access). The delivery extension will need new cargo categories (live organ transport, chemotherapy agents).`,
    recommendation: `Use open enums everywhere \u2014 define a core set but allow custom string values with a vendor prefix pattern (e.g., "x-joby-evtol"). Reserve a formal extension namespace. For Protobuf bindings, use string types for all user-facing enums. Create an official ALTO Extension Registry (hosted on GitHub) where new values can be proposed and ratified without a spec version bump. Define a clear lifecycle: proposed \u2192 experimental \u2192 ratified \u2192 deprecated.`
  },
  {
    id: "on-demand-mismatch",
    title: "On-Demand vs Scheduled Paradigm Mismatch",
    severity: "high",
    source: "GTFS-Flex",
    problem: `GTFS was built for fixed-route scheduled transit. Demand-responsive transit (DRT) was bolted on as an extension (GTFS-Flex), and it took 11 years from initial proposal to official adoption. Even after adoption, as of April 2025 only Transit App and OpenTripPlanner consume Flex data \u2014 Google Maps and Apple Maps still ignore it. The core tension: GTFS\u2019s trip model assumes a vehicle visits stops in a fixed sequence at scheduled times. Flex required a completely different mental model (zones, booking windows, conditional stop visits) that sits awkwardly alongside the existing model.`,
    evidence: [
      "GTFS-Flex N-CATT report: 'Over half of US public transportation services are unavailable in trip planning applications' \u2014 the direct cost of fixing DRT as an afterthought.",
      "GTFS-Flex adoption blog: 'It took 11 years of collaborative work across many companies, nonprofits, transit agencies, and government agencies.'",
      "April 2025: Google Maps and Apple Maps have still not implemented GTFS-Flex support despite official adoption."
    ],
    altoRisk: `Drone delivery is inherently on-demand \u2014 ALTO\u2019s primary use case is what GTFS spent 11 years failing to model. If ALTO\u2019s core data model is designed around the scheduled flight_patterns.json file with on-demand as an afterthought, it will repeat GTFS-Flex\u2019s mistake. An on-demand delivery has no pattern_id, no pre-defined waypoints, and a dynamically assigned vehicle. The static/realtime split itself may be the wrong primitive for a fully dynamic system.`,
    recommendation: `Invert the default assumption. In ALTO, on_demand is the primary flight type; scheduled is the special case. The static feed models fleet capacity and corridor availability windows \u2014 not fixed timetables. The realtime feed is where actual flights live. This mirrors how ride-share APIs work (Uber doesn\u2019t publish a schedule.txt). Consider a third feed type: operational, updated every 1\u20135 minutes, sitting between static (days-old) and realtime (seconds-old). This avoids the static-RT sync problem for the majority of ALTO deployments.`
  },
  {
    id: "id-namespacing",
    title: "Global ID Uniqueness & Namespacing",
    severity: "medium",
    source: "GTFS + OCPI",
    problem: `GTFS IDs (stop_id, route_id, trip_id) are only required to be unique within a single feed. When aggregators combine feeds from multiple agencies, ID collisions are common and require prefix-mangling workarounds. GTFS validator rule: "Every GeoJSON Feature must have an id unique across all stops.stop_id, locations.geojson id, and location_group_id values" \u2014 this is consistently violated in production. OCPI addressed this later by adding country_code and party_id to CdrToken for globally unique identification \u2014 a fix that required a spec version bump.`,
    evidence: [
      "GTFS validator: Route network identifiers 'redundantly defined in more than one file' is a common production error.",
      "GTFS-RT: 'If separate VehiclePosition and TripUpdate feeds are provided, TripDescriptor and VehicleDescriptor ID values pairing should match between the two feeds' \u2014 this fails silently when agencies have overlapping ID spaces.",
      "OCPI 2.2.1 changelog: 'CdrToken now includes country_code and party_id for globally unique identification' \u2014 this was missing in 2.1.1."
    ],
    altoRisk: `ALTO will aggregate feeds from Wing, Amazon Air, Zipline, Joby, Archer, and municipal operators simultaneously. A vehicle_id of "drone-001" is guaranteed to collide. A vertiport_id of "HUB-01" across three operators in the same city is a real scenario. The roaming API specifically requires cross-operator ID resolution \u2014 a handoff_id must be uniquely traceable across the networks of both operators. Collision today, regulatory dispute tomorrow.`,
    recommendation: `Mandate globally unique IDs from day one using a URI scheme: {agency_id}/{object_type}/{local_id}. Example: wm-delivery-us-west/vehicle/x2-007. For the roaming API, adopt OCPI\u2019s country_code + party_id pattern. All DRR and delivery_id fields must include the originating agency_id as a namespace prefix. Publish a global ALTO Registry (GitHub-hosted, like npm) where agency_ids are claimed and verified \u2014 preventing namespace collisions across operators.`
  },
  {
    id: "weather-invalidation",
    title: "Dynamic Constraint Invalidation (Weather / Airspace)",
    severity: "medium",
    source: "Novel \u2014 no GTFS/OCPI equivalent",
    problem: `Neither GTFS nor OCPI has a concept of operational constraints that dynamically invalidate static data. Transit routes don\u2019t disappear when it rains. EV chargers aren\u2019t blocked by a NOTAM. ALTO is the first mobility data standard where a static feed object (a corridor, a vertiport) can become temporarily invalid due to external constraints \u2014 weather, temporary flight restrictions (TFRs), emergency airspace closures \u2014 that are themselves managed by a separate authority (FAA/EASA).`,
    evidence: [
      "FAA UTM framework: 'The FAA will provide real-time constraints to UAS operators, who are responsible for managing their operations within these constraints.'",
      "ALTO v0.1 spec: weather_constraints fields exist on vertiports, but no mechanism exists to signal when those constraints are breached in realtime.",
      "InterUSS: ED-269 \u2192 ED-318 transition shows geofence formats change over time, requiring translation layers."
    ],
    altoRisk: `A consumer reads the static ALTO feed, sees corridor CORR-SFO-SOMA-01 is available, and plans a delivery. A TFR is issued mid-planning. The static feed is now wrong, the realtime alert feed may not yet reflect it, and the UTM geofence system (a separate authority) is the ground truth. ALTO data can become not just stale but actively dangerous if a consumer uses static data without checking realtime constraints. This is an entirely new failure mode with no GTFS/OCPI precedent.`,
    recommendation: `Introduce a formal ALTO Constraint Invalidation model. Every static entity (corridor, vertiport) has a constraint_status field in the realtime feed: NOMINAL, CONSTRAINED, or CLOSED. Consumers must treat static data as indicative and realtime constraint_status as authoritative. Add a utm_constraint_ref field that links ALTO alerts to the authoritative UTM/LAANC/NOTAM reference. Define a "dead reckoning" rule: if constraint_status has not been updated in X seconds, consumer must treat the entity as UNKNOWN (not NOMINAL). This makes the unknown-unknown case explicit.`
  },
  {
    id: "governance",
    title: "Governance, Stewardship & Contributor Capture",
    severity: "medium",
    source: "GTFS + OCPI",
    problem: `GTFS was created by Google and Portland TriMet in 2005. For over a decade, Google effectively controlled the spec \u2014 a single company\u2019s product needs drove the standard\u2019s evolution. MobilityData was created in 2018 partly to address this. OCPI has the opposite problem: it\u2019s governed by the EVRoaming Foundation, whose "Full Contributors" pay fees to participate in OCPI 3.0 development \u2014 the current development branch is private to paying members, creating a two-tier spec community. Both models create adoption friction and community mistrust.`,
    evidence: [
      "GTFS versioning issue #215: Community frustration at Google\u2019s unilateral pace-setting for what is nominally an open standard.",
      "OCPI GitHub: 'Development of OCPI 3.0 is done in the ocpi-3 repository, which is only accessible to Contributors of the EV Roaming Foundation.'",
      "GTFS-Flex: Took 11 years and explicit nonprofit stewardship (MobilityData) to get adopted \u2014 partly due to governance friction."
    ],
    altoRisk: `Wing (Google/Alphabet), Amazon Prime Air, and Zipline will all want to shape ALTO to fit their operational models. If one operator gets disproportionate governance influence, ALTO becomes a de facto proprietary standard with an open veneer \u2014 exactly what happened to GTFS before MobilityData. Conversely, a closed contributor model like OCPI 3.0 will exclude the cities, regulators, and small operators who need ALTO most.`,
    recommendation: `Publish ALTO under a Linux Foundation or Apache Software Foundation governance model from day one \u2014 not a company-controlled repo. Form a Technical Steering Committee with mandatory representation from: operators (max 40% of votes), cities/regulators (min 25%), independent developers (min 25%), and safety/consumer advocates (min 10%). All spec development in the open on GitHub. No private development track. Modeled on GTFS post-MobilityData. File this as a founding document at the same time as the spec.`
  }
];

const SEVERITY_CONFIG = {
  critical: { color: "#F87171", label: "CRITICAL" },
  high: { color: "#FB923C", label: "HIGH" },
  medium: { color: "#FBBF24", label: "MEDIUM" },
};

const SOURCE_CONFIG = {
  "GTFS": { color: "#38BDF8" },
  "GTFS-RT": { color: "#818CF8" },
  "OCPI": { color: "#34D399" },
  "GTFS + OCPI": { color: "#A78BFA" },
  "GTFS-RT + OCPI": { color: "#6EE7B7" },
  "GTFS-Flex": { color: "#FCD34D" },
  "Novel \u2014 no GTFS/OCPI equivalent": { color: "#F472B6" },
  "GTFS + OCPI + Novel": { color: "#F472B6" },
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
    "static-rt-sync": "Drones operate at 15-min+ frequency. Static-RT drift compounds faster than transit.",
    timestamps: "DRRs need second-precision for SLA billing. GTFS only needed minute precision for trip planning.",
    "stale-feeds": "Stale drone position = safety risk, not just UX degradation. The stakes are categorically higher.",
    "cdr-record": "DRR carries commercial, legal, and carbon accounting weight. More fields, more dispute surface.",
    "enum-sprawl": "Vehicle classes, vertiport types, and cargo categories will all expand faster than transit route types.",
    "on-demand-mismatch": "On-demand is ALTO\u2019s default mode \u2014 not a bolt-on. Building it in from day one avoids 11 years of GTFS-Flex pain.",
    "id-namespacing": "Cross-operator delivery tracking requires globally unique IDs \u2014 not just feed-unique IDs.",
    "weather-invalidation": "No prior mobility standard has had to handle externally-invalidated static data. Entirely novel problem.",
    governance: "Wing/Google, Amazon, Zipline all have resources to capture a weakly-governed spec.",
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
              <div style={{ ...s.label, color: "#64748B" }}>Why ALTO is More Exposed Than GTFS/OCPI</div>
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
                {issue.severity === "critical" && "Must be in v0.1. Retrofitting this after adoption is extremely painful \u2014 OCPI and GTFS both prove this."}
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
