# PRD: HealthPulse — Personal Health Workbench for Mac

> **Version:** 3.1 (Final)  
> **Author:** Dror Ben-Eliyahu  
> **Date:** April 9, 2026  
> **Status:** FINAL — Start Building  
> **Philosophy:** MVP-first. Stats before AI. Evidence before narrative. One killer workflow before many features.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Landscape & Positioning](#2-competitive-landscape--positioning)
3. [Problem Statement](#3-problem-statement)
4. [The Data Bridge: How the Mac Gets the Data](#4-the-data-bridge-how-the-mac-gets-the-data)
5. [Data Contract (Single Source of Truth)](#5-data-contract-single-source-of-truth)
6. [Goals & Success Metrics](#6-goals--success-metrics)
7. [User Persona](#7-user-persona)
8. [System Architecture](#8-system-architecture)
9. [Data Model & Normalized Schema](#9-data-model--normalized-schema)
10. [Feature Requirements](#10-feature-requirements)
11. [Evidence Model (Insight Engine Design)](#11-evidence-model-insight-engine-design)
12. [The Killer Workflow: Sunday Review](#12-the-killer-workflow-sunday-review)
13. [UI/UX Specifications](#13-uiux-specifications)
14. [Technical Stack](#14-technical-stack)
15. [Privacy & Security](#15-privacy--security)
16. [Implementation Phases](#16-implementation-phases)
17. [HAE Dependency Risk Assessment](#17-hae-dependency-risk-assessment)
18. [Open Questions & Risks](#18-open-questions--risks)

---

## 1. Executive Summary

**HealthPulse** is a local-first Mac application that transforms Apple Health data into a personal health analysis workbench. It is not a tracker, not a sync tool, and not an AI health coach. It is a **quantified-self workbench** — a tool for someone who wants to understand their own body through data, with rigorous evidence backing every claim.

### What We Are

> A local-first quantified-self workbench for Mac.  
> Excellent charts. Deterministic insight engine. Optional AI narrative layer.  
> One killer workflow: the Sunday health review.

### What We Are NOT

- Not a health coach (no overclaiming)
- Not a Whoop/Oura replacement (we don't own hardware or data collection)
- Not a generic AI wrapper (stats first, LLM second)
- Not a sync tool (we buy sync, we build intelligence)

### The Strategic Bet

| Layer | Who Owns It | Our Role |
|---|---|---|
| Data collection | Apple Watch + iPhone + HealthKit | None — we consume |
| Data extraction + sync | Health Auto Export (3rd party, $25) | **Dependency — acknowledged and mitigated** |
| Local storage + normalization | **HealthPulse** | **We build this** |
| Visualization + dashboards | **HealthPulse** | **We build this** |
| Deterministic insight engine | **HealthPulse** | **We build this — our core moat** |
| AI narrative layer (optional) | **HealthPulse** + Claude API | Phase 2 — layered on validated signals only |

### Why This Is Worth Building

The competitive gap is not "can data reach Mac?" — that's solved. The gap is: **can someone make the Mac experience great AND the insights rigorous?** Nobody does both today.

---

## 2. Competitive Landscape & Positioning

### Landscape Matrix

| Product | Mac Dashboard | Auto Sync | Cross-Metric Correlation | Evidence-Based Insights | AI Narrative | UX Quality | Price |
|---|---|---|---|---|---|---|---|
| **Apple Health** | ❌ | N/A | ❌ | ❌ | ❌ | ⭐⭐⭐ | Free |
| **Health Auto Export (Mac)** | ⚠️ Basic | ✅ iCloud | ❌ | ❌ | ❌ | ⭐⭐ | $25 lifetime |
| **HAE + Grafana (DIY)** | ✅ Custom | ✅ REST API | ⚠️ Manual | ❌ | ❌ | ⭐ (dev-only) | $25 + time |
| **Gyroscope** | ❌ (web) | ✅ Cloud | ⚠️ Limited | ⚠️ Vague | ⚠️ Generic | ⭐⭐⭐⭐ | $15/mo |
| **Whoop** | ❌ | ✅ Proprietary | ✅ | ✅ Strong | ⚠️ | ⭐⭐⭐⭐ | $30/mo + hardware |
| **Oura** | ❌ (web) | ✅ Proprietary | ⚠️ Limited | ✅ Decent | ⚠️ | ⭐⭐⭐⭐ | $6/mo + hardware |
| **Athlytic** | ❌ | ✅ HealthKit | ⚠️ Limited | ⚠️ | ❌ | ⭐⭐⭐ | $7/mo |
| **HealthPulse (target)** | ✅ | ✅ via HAE | ✅ | ✅ Evidence-based | ✅ Phase 2 | ⭐⭐⭐⭐⭐ | OSS (requires HAE Premium ~$25) |

### Our Actual Competitor

The honest competitive question is not "Apple Health is bad." It is:

> "Why won't a power user just use HAE + Grafana + Claude?"

**Answer:** Because that's 3 separate tools requiring Docker, InfluxDB, Grafana config, manual Claude prompting, and zero cross-metric correlation. HealthPulse is the **productized version** of that DIY stack — zero-config, opinionated, with a built-in evidence engine.

### Moat Candidates (Ranked)

1. **Exceptional opinionated UX** — Must crush this. If the dashboard isn't meaningfully better than HAE's Mac app, we're a wrapper.
2. **Zero-config cross-metric correlations** — The thing nobody does automatically. "Your deep sleep drops 22% on days you run after 7pm" with sample count, confidence, and p-value.
3. **The Sunday Review workflow** — A ritual, not just a feature. A weekly 5-minute session that makes you smarter about your body.
4. **Evidence model** — Every insight cites its data. No "vibes-based" health claims.

---

## 3. Problem Statement

### Core Pain Points

| Pain Point | Severity | Who Else Solves It |
|---|---|---|
| No Mac dashboard for Apple Health data | High | HAE Mac (weak), Grafana (ugly/technical) |
| No cross-metric correlation (sleep ↔ workout ↔ HRV) | High | Nobody for Apple Health data |
| No evidence-backed insights ("why did my sleep suck?") | High | Whoop/Oura (but hardware-locked) |
| Fragmented tooling (3-4 apps for partial picture) | Medium | Nobody |
| No structured weekly review workflow | Medium | Nobody |

### Why This Gap Persists

Apple does not provide Health on macOS. Every Mac health solution is a workaround built on top of:
- HealthKit (iOS-only API)
- iOS background processing limits (apps can't access health data when phone is locked)
- iCloud sync (works, but indirect)

We accept this constraint and build the best possible experience within it.

---

## 4. The Data Bridge: How the Mac Gets the Data

### Decision: Single Data Contract

**v2 of this PRD mixed two HAE sync models.** v3 picks ONE for MVP.

| Option | Description | Parser Complexity | Debuggability | Data Ownership | MVP Pick? |
|---|---|---|---|---|---|
| **HAE iCloud Drive Automation (JSON)** | User creates iCloud Drive automation in HAE. JSON files land in a configurable iCloud Drive folder. | Low — standard JSON | High — human-readable files | High — we own the files | **✅ YES** |
| HAE Sync to Mac (AutoSync/.hae) | HAE's built-in Mac sync. Proprietary `.hae` format in app-managed folder. | High — undocumented binary format | Low — opaque format | Low — HAE controls schema | ❌ |
| HAE TCP/MCP Server | Real-time query over LAN when on same WiFi. | Medium | Medium | Medium | ❌ (see Appendix) |

### Why iCloud Drive JSON Automation Wins

1. **JSON is ownable.** We can parse, version, debug, reprocess, and migrate it. `.hae` is a black box.
2. **Files persist on disk.** Even if HAE changes or disappears, our historical JSON files remain.
3. **Schema is documented.** HAE publishes the JSON format on their GitHub wiki (pinned to Export Version 2).
4. **Folder location is user-configurable.** HAE lets users name their automation, which determines the folder path.
5. **Aggregation is configurable.** User can choose hourly, daily, etc. We recommend **hourly for metrics, individual for workouts.**

### How It Works (Step by Step)

```
1. User installs Health Auto Export (iOS) — $25 lifetime for Premium
2. User creates TWO iCloud Drive automations in HAE:

   Automation 1: "HealthPulse Metrics"
   ├── Data Type: Health Metrics
   ├── Metrics: HR, Resting HR, HRV, Sleep, Steps, Active Energy, 
   │            Walking+Running Distance, VO2 Max
   ├── Format: JSON
   ├── Export Version: 2
   ├── Summarize Data: ON
   ├── Aggregation: Hours
   ├── Date Range: Since Last Sync
   ├── Sync Cadence: 30 minutes
   └── Destination: iCloud Drive (folder auto-created: "HealthPulse Metrics")

   Automation 2: "HealthPulse Workouts"
   ├── Data Type: Workouts
   ├── Workouts: All types
   ├── Format: JSON
   ├── Export Version: 2
   ├── Include Workout Metrics: ON (heart rate data during workouts)
   ├── Workout Metrics Time Grouping: Minutes
   ├── Include Route Data: OFF (save space, add in Phase 2)
   ├── Date Range: Since Last Sync
   ├── Sync Cadence: 30 minutes
   └── Destination: iCloud Drive (folder auto-created: "HealthPulse Workouts")

3. iCloud syncs JSON files to Mac

4. Mac folder locations:
   ~/Library/Mobile Documents/com~apple~CloudDocs/
   ├── Health Auto Export/
   │   ├── HealthPulse Metrics/
   │   │   ├── 2026-04-09.json
   │   │   ├── 2026-04-08.json
   │   │   └── ...
   │   └── HealthPulse Workouts/
   │       ├── 2026-04-09.json
   │       ├── 2026-04-08.json
   │       └── ...

5. HealthPulse watches these folders via FSEvents / chokidar
6. On new/changed file: parse JSON → normalize → upsert into SQLite
7. Run aggregation pipeline → refresh dashboard
```

### Known Limitations & Mitigations

| Limitation | Reality | Mitigation |
|---|---|---|
| iOS background refresh is unpredictable (30min to hours) | HAE docs confirm apps cannot access health data while iPhone is locked and iOS does not guarantee background task timing | Show "last synced" timestamp. Document iPhone Mirroring trick (counts as unlocked). Document charging tip (iOS is more generous with background tasks when charging). Add HAE home screen widget to manually trigger sync. |
| iCloud Drive may keep files as cloud references (not downloaded) | macOS storage optimization can evict local copies | Onboarding forces user to right-click folder → "Keep Downloaded." App checks on launch and warns if files are missing. |
| Large historical backfill | First sync of 6+ months can produce large JSON files | Process incrementally. Show progress bar. Default to 6 months; user can extend. |
| HAE format may change | Low probability but nonzero | Pin to Export Version 2. Add format detection in parser. See Section 17 for full risk assessment. |

### TCP/MCP Server: Demoted to Advanced Mode

The HAE TCP/MCP server is useful but NOT a sync pillar:
- Requires same WiFi network
- App must be running in foreground on iPhone
- Server is unencrypted
- Default port is 9000 (not always available)

**Verdict:** Move to Appendix A as "Advanced/Developer Mode." Useful for one-off queries, Claude Desktop integration, and debugging. Not a production data path.

---

## 5. Data Contract (Single Source of Truth)

This section defines the EXACT data we expect from Health Auto Export. This is the contract between HAE and HealthPulse.

### Source: Health Auto Export JSON Format (Export Version 2)

**Reference:** [HAE JSON Format Wiki](https://github.com/Lybron/health-auto-export/wiki/API-Export---JSON-Format)

### Metrics JSON Structure

```json
{
  "data": {
    "metrics": [
      {
        "name": "heart_rate",
        "units": "count/min",
        "data": [
          {
            "date": "2026-04-09 08:30:00 +0300",
            "Min": 58,
            "Avg": 72,
            "Max": 89
          }
        ]
      },
      {
        "name": "resting_heart_rate",
        "units": "count/min",
        "data": [
          {
            "date": "2026-04-09 00:00:00 +0300",
            "qty": 58
          }
        ]
      },
      {
        "name": "heart_rate_variability",
        "units": "ms",
        "data": [
          {
            "date": "2026-04-09 07:15:00 +0300",
            "qty": 42
          }
        ]
      },
      {
        "name": "sleep_analysis",
        "units": "hr",
        "data": [
          {
            "date": "2026-04-09",
            "totalSleep": 7.2,
            "asleep": 6.8,
            "core": 3.1,
            "deep": 1.3,
            "rem": 1.6,
            "sleepStart": "2026-04-08 23:15:00 +0300",
            "sleepEnd": "2026-04-09 06:28:00 +0300",
            "inBed": 7.5,
            "inBedStart": "2026-04-08 22:58:00 +0300",
            "inBedEnd": "2026-04-09 06:32:00 +0300"
          }
        ]
      },
      {
        "name": "step_count",
        "units": "count",
        "data": [
          {
            "date": "2026-04-09 09:00:00 +0300",
            "qty": 1247
          }
        ]
      },
      {
        "name": "active_energy_burned",
        "units": "kcal",
        "data": [
          {
            "date": "2026-04-09 09:00:00 +0300",
            "qty": 87.3
          }
        ]
      },
      {
        "name": "walking_running_distance",
        "units": "km",
        "data": [
          {
            "date": "2026-04-09 09:00:00 +0300",
            "qty": 0.94
          }
        ]
      },
      {
        "name": "vo2_max",
        "units": "mL/min·kg",
        "data": [
          {
            "date": "2026-04-09 08:00:00 +0300",
            "qty": 44.2
          }
        ]
      }
    ]
  }
}
```

### Workouts JSON Structure (v2)

```json
{
  "data": {
    "workouts": [
      {
        "id": "ABC123-DEF456",
        "name": "Running",
        "start": "2026-04-09 06:30:00 +0300",
        "end": "2026-04-09 07:05:00 +0300",
        "duration": 2100,
        "activeEnergyBurned": { "qty": 412, "units": "kcal" },
        "distance": { "qty": 5.21, "units": "km" },
        "avgHeartRate": { "qty": 148, "units": "bpm" },
        "maxHeartRate": { "qty": 172, "units": "bpm" },
        "heartRateData": [
          {
            "date": "2026-04-09 06:30:00 +0300",
            "Min": 95,
            "Avg": 110,
            "Max": 118,
            "units": "bpm"
          },
          {
            "date": "2026-04-09 06:31:00 +0300",
            "Min": 118,
            "Avg": 135,
            "Max": 142,
            "units": "bpm"
          }
        ],
        "heartRateRecovery": [
          {
            "date": "2026-04-09 07:06:00 +0300",
            "qty": 145,
            "units": "bpm"
          },
          {
            "date": "2026-04-09 07:07:00 +0300",
            "qty": 128,
            "units": "bpm"
          }
        ],
        "elevationUp": { "qty": 34, "units": "m" }
      }
    ]
  }
}
```

### Parser Contract Rules

1. **Date format:** `yyyy-MM-dd HH:mm:ss Z` — parse with timezone awareness. Store internally as ISO 8601 UTC.
2. **Heart rate uses `Min/Avg/Max`** (not `qty`) — parser must handle both patterns.
3. **Sleep uses aggregated format** (we configure HAE with Summarize Data: ON).
4. **Workouts v2 format** — `id` field present, nested objects for `activeEnergyBurned`, `distance`, etc.
5. **Missing fields are `undefined`** — parser must handle nullable/missing fields gracefully.
6. **Dedup key for metrics:** `(metric_name, date, source)` — upsert semantics.
7. **Dedup key for workouts:** `(id)` or `(name, start)` — upsert semantics.
8. **Dedup key for sleep:** `(date)` — one sleep session per night.
9. **File-level dedup:** Hash each file. Track processed files in `sync_log` table. Never reprocess same file.

### Parser Fallback & Edge-Case Rules

These rules prevent silent data corruption when real-world HAE exports are messy.

| Scenario | Rule |
|---|---|
| **`source` field missing** | Default to `"Health Auto Export"`. The dedup key still works because metric_name + timestamp is usually unique per source. |
| **Sleep fields partially missing** (e.g., `deep` is null but `totalSleep` exists) | Ingest what's available. Set missing stage fields to `null`, not `0`. UI renders "—" for null stages. |
| **Duplicate workout IDs across files** | Upsert by `hae_id`. Last-write-wins. Log a warning. |
| **Malformed JSON file** | Skip entire file. Log error with filepath. Do NOT partially ingest. Retry on next watcher tick in case iCloud was mid-write. |
| **Partial/truncated file** (iCloud sync mid-write) | `JSON.parse()` will throw. Catch, log, skip. chokidar will re-fire when file is complete. Add 2-second debounce on file change events to avoid racing iCloud writes. |
| **Unexpected metric name** (HAE adds new metric we don't know) | Ingest anyway into `health_samples` with the unknown name. Don't crash. Dashboard ignores unknown metrics. |
| **Date parsing fails** | Skip that individual record (not the whole file). Log warning with raw date string. |
| **Negative or obviously wrong values** (e.g., HR = -5 or HR = 400) | Skip record. Log warning. |
| **File re-appears with same name but different content** | SHA-256 hash will differ → re-process the file. Old records with same dedup keys get overwritten (upsert). |
| **Empty `data` array in a metric** | Skip that metric silently. Not an error — HAE may export empty arrays for metrics with no data in the time window. |

---

## 6. Goals & Success Metrics

### MVP Success Criteria (Binary — Ship or Don't Ship)

| # | Criteria | Pass/Fail |
|---|---|---|
| 1 | Dashboard shows today's 6 core metrics with real HAE data | ☐ |
| 2 | Sleep page shows last night's stage breakdown + 30-day trend | ☐ |
| 3 | Workout list shows last 10 workouts with HR zone chart per workout | ☐ |
| 4 | HRV + Resting HR 30-day trend visible on Heart page | ☐ |
| 5 | Data refreshes within ~1 hour of iPhone recording (iCloud Drive lag) | ☐ |
| 6 | Dashboard loads in < 2 seconds on 90-day dataset | ☐ |
| 7 | Works fully offline (local SQLite, no external dependencies except initial sync) | ☐ |
| 8 | Can complete weekly health review in < 5 minutes without opening any other tool | ☐ |
| 9 | Sunday Review page renders a usable weekly summary | ☐ |

---

## 7. User Persona

### Primary: Dror (Quantified Self Optimizer)

- 41M, Ra'anana, Israel. Runner (7km PB), snowboarder, longevity-focused.
- Devices: iPhone, Mac, Apple Watch.
- Tracks: sleep stages, HRV, resting HR, VO2 Max, running pace, Zone 2 time.
- Technical comfort: High. Will install HAE, configure iCloud Drive, comfortable with terminal.
- Key frustration: "I only see my data on my phone. I want a Mac dashboard with correlations."
- **The workflow he wants:** Every Sunday morning, open HealthPulse, spend 5 minutes reviewing the week, understand trends, adjust training plan.

---

## 8. System Architecture

### Architecture Diagram (MVP)

```
┌────────────────────────────────────┐
│            iPhone                    │
│                                     │
│  Apple Health ──▶ Health Auto Export │
│                  (Premium, $25)     │
│                                     │
│  Automation 1: Metrics → JSON       │
│  Automation 2: Workouts → JSON      │
│        │                            │
│        ▼                            │
│  iCloud Drive/Health Auto Export/   │
│  ├── HealthPulse Metrics/*.json     │
│  └── HealthPulse Workouts/*.json    │
└────────────────┬───────────────────┘
                 │ iCloud Sync
                 │ (~1-60 min)
                 ▼
┌────────────────────────────────────────────────────────────┐
│                           Mac                               │
│                                                             │
│  ~/Library/Mobile Documents/com~apple~CloudDocs/            │
│  └── Health Auto Export/                                    │
│      ├── HealthPulse Metrics/*.json                         │
│      └── HealthPulse Workouts/*.json                        │
│           │                                                 │
│           │ chokidar file watcher                           │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   HealthPulse                         │  │
│  │                                                       │  │
│  │  ┌─────────┐   ┌──────────┐   ┌──────────────────┐  │  │
│  │  │ Parser  │──▶│ SQLite   │──▶│ Aggregation      │  │  │
│  │  │ (JSON   │   │ (~/.     │   │ Pipeline         │  │  │
│  │  │  v2)    │   │ healthpulse│  │                  │  │  │
│  │  └─────────┘   │ /data.db)│   └────────┬─────────┘  │  │
│  │                 └──────────┘            │            │  │
│  │                              ┌─────────┼─────────┐  │  │
│  │                              ▼         ▼         ▼  │  │
│  │                        ┌─────────┐ ┌──────┐ ┌────┐ │  │
│  │                        │Dashboard│ │Evid. │ │AI  │ │  │
│  │                        │ (React) │ │Engine│ │(v2)│ │  │
│  │                        └─────────┘ └──────┘ └────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  http://localhost:3000                                      │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Apple Watch records heart rate → HealthKit on iPhone
2. HAE background task fires (iOS decides when, ~30-60 min)
3. HAE reads new HealthKit samples
4. HAE writes JSON file to iCloud Drive (named by date)
5. iCloud syncs file to Mac (~1-5 min on good connection)
6. HealthPulse chokidar detects new/changed file
7. Parser reads JSON, validates against v2 schema
8. Normalizer converts to internal format, handles timezone → UTC
9. Deduplicator checks (metric_name, timestamp, source) uniqueness
10. SQLite upsert (INSERT OR REPLACE)
11. Aggregation pipeline: compute daily rollups + 7/14/30/90-day moving averages
12. Evidence engine: run deterministic insight checks (trend detection, anomaly detection, correlation)
13. Dashboard re-renders via React state update
```

---

## 9. Data Model & Normalized Schema

### SQLite Schema

```sql
-- ============================================================
-- INGESTION LAYER
-- ============================================================

-- Raw health samples (normalized from HAE JSON)
CREATE TABLE health_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,          -- e.g., "heart_rate", "step_count"
    value REAL NOT NULL,                -- primary value (qty, or Avg for HR)
    value_min REAL,                     -- Min (heart rate only)
    value_max REAL,                     -- Max (heart rate only)
    unit TEXT NOT NULL,                 -- e.g., "count/min", "ms", "kcal"
    timestamp_utc TEXT NOT NULL,        -- ISO 8601 UTC
    timestamp_local TEXT NOT NULL,      -- ISO 8601 with original timezone
    source TEXT,                        -- e.g., "Apple Watch"
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(metric_name, timestamp_utc, source)
);

-- Sleep sessions (one per night)
CREATE TABLE sleep_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,          -- YYYY-MM-DD (night of)
    total_sleep_hours REAL,
    asleep_hours REAL,
    core_hours REAL,
    deep_hours REAL,
    rem_hours REAL,
    in_bed_hours REAL,
    sleep_start TEXT,                   -- ISO 8601
    sleep_end TEXT,
    in_bed_start TEXT,
    in_bed_end TEXT,
    -- Derived
    sleep_efficiency REAL,              -- (asleep / in_bed) * 100
    deep_pct REAL,                      -- (deep / total_sleep) * 100
    rem_pct REAL,
    core_pct REAL,
    awake_minutes REAL,                 -- (in_bed - total_sleep) * 60
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workouts (v2 format)
CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hae_id TEXT,                         -- HAE's workout ID
    workout_type TEXT NOT NULL,          -- e.g., "Running", "Strength Training"
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_seconds REAL,
    distance_km REAL,
    active_energy_kcal REAL,
    avg_heart_rate REAL,
    max_heart_rate REAL,
    elevation_up_m REAL,
    heart_rate_data TEXT,                -- JSON array of HR samples during workout
    heart_rate_recovery TEXT,            -- JSON array of recovery HR samples
    -- Derived
    zone1_seconds REAL,                 -- Computed from heart_rate_data
    zone2_seconds REAL,
    zone3_seconds REAL,
    zone4_seconds REAL,
    zone5_seconds REAL,
    avg_pace_min_per_km REAL,           -- For running: duration / distance
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(COALESCE(hae_id, workout_type || start_time))
);

-- ============================================================
-- AGGREGATION LAYER
-- ============================================================

-- Daily aggregates (computed from raw samples)
CREATE TABLE daily_aggregates (
    date TEXT NOT NULL,                  -- YYYY-MM-DD
    metric_name TEXT NOT NULL,
    avg_value REAL,
    min_value REAL,
    max_value REAL,
    sum_value REAL,
    sample_count INTEGER,
    PRIMARY KEY (date, metric_name)
);

-- Moving averages (precomputed for dashboard performance)
CREATE TABLE moving_averages (
    date TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    window_days INTEGER NOT NULL,       -- 7, 14, 30, 90
    avg_value REAL,
    std_dev REAL,                        -- For baseline/anomaly detection
    sample_count INTEGER,
    PRIMARY KEY (date, metric_name, window_days)
);

-- ============================================================
-- EVIDENCE LAYER
-- ============================================================

-- Deterministic insights (stats-based, not AI-generated)
CREATE TABLE evidence_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    insight_type TEXT NOT NULL,          -- "trend", "anomaly", "correlation", "threshold"
    metric_a TEXT NOT NULL,             -- Primary metric
    metric_b TEXT,                       -- Secondary metric (for correlations)
    direction TEXT,                      -- "improving", "declining", "stable", "anomaly_high", "anomaly_low"
    magnitude REAL,                     -- e.g., +12%, -3ms
    date_window_start TEXT,
    date_window_end TEXT,
    sample_count INTEGER NOT NULL,      -- N: how many data points support this
    method TEXT NOT NULL,               -- "linear_regression", "z_score", "pearson_r", "threshold_check"
    confidence REAL,                    -- 0.0-1.0 (for correlations: abs(r); for trends: R²)
    p_value REAL,                       -- Statistical significance (for correlations)
    confounders_noted TEXT,             -- JSON array of known confounders not controlled for
    explanation TEXT NOT NULL,          -- Human-readable summary
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI-generated narratives (Phase 2 only, layered on evidence_insights)
CREATE TABLE ai_narratives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    narrative_type TEXT NOT NULL,       -- "daily_brief", "weekly_report"
    evidence_insight_ids TEXT NOT NULL, -- JSON array of evidence_insight IDs this narrative is based on
    content TEXT NOT NULL,              -- Markdown formatted narrative
    model TEXT NOT NULL,                -- e.g., "claude-sonnet-4-20250514"
    prompt_hash TEXT,                   -- Hash of prompt sent to API
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SYSTEM LAYER
-- ============================================================

-- Processed file tracking (dedup at file level)
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of file contents
    file_type TEXT NOT NULL,            -- "metrics" or "workouts"
    records_ingested INTEGER,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User configuration
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Default config entries:
-- max_heart_rate: 179 (220 - age, for Dror)
-- zone2_lower_pct: 60
-- zone2_upper_pct: 70
-- sleep_goal_hours: 7.5
-- metrics_folder: (auto-detected or user-set)
-- workouts_folder: (auto-detected or user-set)

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_samples_metric_ts ON health_samples(metric_name, timestamp_utc);
CREATE INDEX idx_samples_ts ON health_samples(timestamp_utc);
CREATE INDEX idx_daily_date ON daily_aggregates(date);
CREATE INDEX idx_daily_metric ON daily_aggregates(metric_name, date);
CREATE INDEX idx_ma_metric ON moving_averages(metric_name, date);
CREATE INDEX idx_workouts_date ON workouts(start_time);
CREATE INDEX idx_sleep_date ON sleep_sessions(date);
CREATE INDEX idx_evidence_date ON evidence_insights(date);
```

### Heart Rate Zone Computation

```typescript
// Computed during workout ingestion from heartRateData array
function computeHRZones(
  heartRateData: Array<{date: string; Avg: number}>,
  maxHR: number
): { zone1: number; zone2: number; zone3: number; zone4: number; zone5: number } {
  const zones = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  
  for (let i = 0; i < heartRateData.length; i++) {
    const hr = heartRateData[i].Avg;
    const pct = (hr / maxHR) * 100;
    // Each sample represents ~1 minute (based on workout metrics time grouping)
    const seconds = 60;
    
    if (pct < 60) zones.zone1 += seconds;
    else if (pct < 70) zones.zone2 += seconds;
    else if (pct < 80) zones.zone3 += seconds;
    else if (pct < 90) zones.zone4 += seconds;
    else zones.zone5 += seconds;
  }
  
  return zones;
}
```

---

## 10. Feature Requirements

### MVP Features (Phase 1)

#### F1: Onboarding Wizard

Step-by-step guide for HAE setup + iCloud Drive configuration. Static HTML page with screenshots and copy-paste settings. Verifies folder access before proceeding.

**Key screens:**
1. "Install Health Auto Export" (App Store link)
2. "Create Metrics Automation" (exact settings with screenshots)
3. "Create Workouts Automation" (exact settings with screenshots)
4. "Enable iCloud Drive on Mac" (System Settings path)
5. "Keep Downloaded" (right-click instruction)
6. "Initial Import" (progress bar, record counts)
7. "Done — Welcome to HealthPulse"

#### F2: Dashboard Home

Six metric cards in a grid. Each card: current value, delta vs. previous period, color-coded trend indicator, sparkline.

| Card | Primary Value | Delta Comparison | Sparkline |
|---|---|---|---|
| Sleep | Last night total | vs. 7-day avg | 30-day duration trend |
| HRV | Last reading SDNN | vs. 14-day baseline | 30-day trend |
| Resting HR | Today's reading | vs. 14-day baseline | 30-day trend |
| VO2 Max | Latest reading | vs. 30-day avg | 90-day trend |
| Steps | Today's total | vs. 7-day avg | 7-day daily bars |
| Last Workout | Type + distance/duration | time since last workout | N/A |

Global time range selector: 7D / 30D / 90D / 1Y. Affects sparklines and delta calculations.

"Last synced" indicator with link to HAE troubleshooting tips.

#### F3: Sleep Detail Page

- **Nightly stage timeline:** Horizontal stacked bar (Core=blue, Deep=indigo, REM=purple, Awake=red)
- **Duration trend:** Line chart with 7-day moving average overlay
- **Stage % breakdown:** Stacked area chart over time
- **Sleep efficiency:** Derived metric (asleep/in_bed × 100), trend line
- **Benchmarks table:** Compare user's stage %s vs. published targets for age/sex
- **Bedtime consistency:** Std dev of sleep_start times (lower = better)

#### F4: Workout Analytics Page

- **Calendar heatmap:** GitHub-style, colored by workout count per day
- **Workout list:** Table with columns: Date, Type, Duration, Distance, Avg HR, Zone 2 %, Calories. Sortable.
- **Per-workout detail (click to expand):**
  - HR over time chart (from heartRateData)
  - HR zone distribution bar chart
  - For running: pace calculated from duration/distance
  - HR recovery chart (from heartRateRecovery)
- **Running-specific dashboard:**
  - Weekly km trend
  - Zone 2 time as % of total running time (target: ≥70%)
  - Avg pace trend over 30/90 days

#### F5: Heart & Recovery Page

- **HRV trend:** Daily SDNN with 7-day and 14-day moving averages
- **Resting HR trend:** Same layout
- **VO2 Max trend:** With fitness classification bands for male age 40-49 (Superior ≥ 48.0, Excellent 44.2-48.0, Good 40.5-44.1, Fair 36.7-40.4, Poor < 36.7)
- **Recovery Score (renamed from "Readiness Score"):**
  ```
  Recovery Score = weighted composite:
  - HRV vs. 14-day baseline (z-score): 40%
  - Resting HR vs. 14-day baseline (z-score, inverted): 30%
  - Last night sleep efficiency: 20%
  - Last night sleep duration vs. goal: 10%
  
  Display: 0-100 gauge
  - 80-100: "Recovered" (green)
  - 60-79: "Moderate" (amber)
  - 0-59: "Fatigued" (red)
  ```
  **Important framing:** "This is a heuristic based on your personal baselines, not a medical assessment."

  **Recovery Score Guardrails:**

  | Condition | Behavior |
  |---|---|
  | Fewer than 10 days of HRV data | Hide gauge entirely. Show: "Building your baseline — need {10 - N} more days of HRV data." |
  | Fewer than 10 days of resting HR data | Same — hide gauge, show progress message. |
  | Std dev of HRV baseline is < 1.0 ms | Floor std dev to 1.0 to prevent z-score explosion. |
  | Std dev of resting HR baseline is < 0.5 bpm | Floor std dev to 0.5. |
  | Sleep data missing for last night | Degrade gracefully: compute score using HRV (57%) + RHR (43%) only. Show note: "Sleep data unavailable — score based on heart metrics only." |
  | HRV data missing for today | Degrade: compute from RHR (50%) + sleep (35%) + duration (15%). Show note. |
  | All inputs missing | Show "No data available" — grey gauge, no number. |
  | Score computes to exactly 0 | Display 0. Don't hide — the user should see extreme fatigue signals. |

#### F6: Sunday Review Page (The Killer Feature — See Section 12)

---

## 11. Evidence Model (Insight Engine Design)

### Philosophy: Stats First, LLM Second

Every insight HealthPulse generates must be **deterministic and auditable.** The evidence model exists to ensure we never show health claims without backing data.

### Insight Types

| Type | Method | Example | Requirements | Phase |
|---|---|---|---|---|
| **Threshold** | Simple comparison against goal or benchmark | "Zone 2 time was 48% of workout — below 70% target" | Always valid (direct measurement) | **1 — MVP** |
| **Trend** | Rolling delta (this week vs. last week) + direction | "HRV down 6.8% vs. last week" | N ≥ 7 days | **1 — MVP** |
| **Anomaly** | Z-score vs. personal baseline | "Resting HR 68 bpm today — 2.1σ above your 14-day baseline" | Baseline N ≥ 10 days, abs(z) ≥ 1.5 | **2** |
| **Correlation** | Pearson r between two daily metrics | "Deep sleep % correlates with next-day HRV (r=0.62, p=0.003, N=28)" | N ≥ 14 days, abs(r) ≥ 0.3, p < 0.05 | **2** |

**Phase 1 evidence is deliberately simple:** "X is above/below target" and "X went up/down vs. last period." That's enough for the Sunday Review to be useful. Anomalies and correlations add richness in Phase 2, but the product must work without them.

### Evidence Record Format

Every insight stored in `evidence_insights` must include:

```typescript
interface EvidenceInsight {
  // What
  insightType: "trend" | "anomaly" | "correlation" | "threshold";
  metricA: string;
  metricB?: string;
  direction: "improving" | "declining" | "stable" | "anomaly_high" | "anomaly_low";
  magnitude: number;          // The measured effect size
  
  // Evidence
  dateWindowStart: string;
  dateWindowEnd: string;
  sampleCount: number;        // N — how many data points
  method: string;             // Statistical method used
  confidence: number;         // R² for trends, abs(r) for correlations
  pValue?: number;            // Statistical significance
  confoundersNoted: string[]; // Known limitations
  
  // Human output
  explanation: string;        // e.g., "Your deep sleep improved 18% this week (N=7, regression R²=0.45)"
}
```

### Pre-Built Correlation Checks (Run Weekly)

| Metric A | Metric B | Hypothesis | Lag |
|---|---|---|---|
| Workout end time (hour) | Same-night deep sleep % | Late workouts hurt deep sleep | 0 days |
| Daily steps | Next-day resting HR | Activity lowers resting HR | 1 day |
| Sleep duration | Next-day HRV | More sleep → better HRV | 1 day |
| Weekly running km | Weekly avg HRV | Training load affects recovery | Same week |
| Weekend sleep duration | Weekday sleep duration | Weekend catch-up pattern | Same week |

### What This Prevents

Without this evidence model, the AI layer would produce statements like:

> ❌ "Your sleep dropped because of stress"  (no stress data)
> ❌ "You should rest tomorrow"  (overclaiming — not medical advice)
> ❌ "Evening workouts hurt your sleep"  (N=2, no statistical test)

With the evidence model:

> ✅ "On 8 of 12 days when you ran after 7pm, your deep sleep was below 14%. On 16 of 18 days when you ran before 7pm, deep sleep exceeded 16%. Pearson r=-0.58, p=0.012. Confounder: sample size is modest."

---

## 12. The Killer Workflow: Sunday Review

### Why This Matters

The Sunday Review is the product. Not the charts alone. It's the reason someone opens HealthPulse every week, the reason it sticks.

### The 5-Minute Sunday Review Flow

```
┌────────────────────────────────────────────────────────────┐
│  📋 WEEKLY REVIEW — Week of March 31 - April 6, 2026       │
│                                                             │
│  ┌─────────────── RECOVERY ──────────────────────────────┐ │
│  │  HRV Baseline: 44ms (14d avg)                         │ │
│  │  This Week Avg: 41ms  ▼ -6.8%                         │ │
│  │  Resting HR Baseline: 57 bpm                          │ │
│  │  This Week Avg: 59 bpm  ▲ +3.5%                       │ │
│  │                                                        │ │
│  │  Assessment: Recovery slightly below baseline.         │ │
│  │  Evidence: HRV declined 3ms (N=7, trend R²=0.31).     │ │
│  │  Resting HR rose 2 bpm over same window.               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────── SLEEP ─────────────────────────────────┐ │
│  │  Avg Duration: 7h 04m (goal: 7h 30m) — 94% of goal   │ │
│  │  Avg Efficiency: 89.2%                                 │ │
│  │  Deep Sleep Avg: 16.8% (target: 15-20%) ✅             │ │
│  │  REM Avg: 21.3% (target: 20-25%) ✅                    │ │
│  │  Bedtime Consistency: σ = 28 min (good < 30 min)       │ │
│  │                                                        │ │
│  │  ░░░░░░░░ Mon  ███████░░░ 6h 48m                      │ │
│  │  ░░░░░░░░ Tue  █████████░ 7h 12m                      │ │
│  │  ░░░░░░░░ Wed  ██████░░░░ 6h 15m ← worst night       │ │
│  │  ░░░░░░░░ Thu  █████████░ 7h 28m                      │ │
│  │  ░░░░░░░░ Fri  ██████████ 7h 42m                      │ │
│  │  ░░░░░░░░ Sat  █████████░ 7h 18m                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────── TRAINING ──────────────────────────────┐ │
│  │  Sessions: 3 (Mon run, Wed run, Sat strength)          │ │
│  │  Total Running: 12.3 km (prev week: 14.1 km) ▼ -12.8% │ │
│  │  Zone 2 Time: 63% of running time (target: ≥70%) ⚠️   │ │
│  │  Total Active Calories: 1,847 kcal                     │ │
│  │                                                        │ │
│  │  Volume Change: -12.8% vs last week — within safe      │ │
│  │  range (flag if >30% increase).                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────── INSIGHTS (Evidence-Based) ─────────────┐ │
│  │                                                        │ │
│  │  📊 "Wednesday's poor sleep (6h 15m, 10% deep) followed│ │
│  │  your 8:30pm run. On 6 of 8 occasions when you ran     │ │
│  │  after 7pm, deep sleep was below 14%."                  │ │
│  │  Method: threshold check | N=8 | No confounders tested │ │
│  │                                                        │ │
│  │  📊 "Zone 2 running time was 63% this week, below your │ │
│  │  70% target for 3 consecutive weeks. Consider slowing   │ │
│  │  your easy runs by 15-20 sec/km."                       │ │
│  │  Method: threshold check | N=3 weeks                    │ │
│  │                                                        │ │
│  │  📊 "HRV baseline dropped 6.8% with a concurrent       │ │
│  │  resting HR increase of 3.5%. Both metrics moving in    │ │
│  │  the same unfavorable direction for 5+ days may         │ │
│  │  indicate accumulated fatigue."                         │ │
│  │  Method: z-score vs 14d baseline | N=7                  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────── NEXT WEEK CONSIDERATIONS ──────────────┐ │
│  │  • Recovery below baseline — consider 1 fewer session   │ │
│  │  • Zone 2 discipline needed — slow down easy runs       │ │
│  │  • Sleep goal: aim for ≥7h 15m all 7 nights            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  [← Previous Week]                        [Next Week →]     │
│                                                             │
│  [Export as PDF] (Phase 3)    [Generate AI Summary] (Phase 2)│
└────────────────────────────────────────────────────────────┘
```

### Why This Is the Moat

Whoop has "weekly performance assessment" but it's locked behind hardware + subscription. Oura has "readiness" but it's iPhone-only. **Nobody offers this on Mac, for free, with Apple Watch data, with visible evidence for every claim.**

### Canonical Weekly Output (Every Review Must End With This)

The Sunday Review is not a chart gallery. It is a **decision tool.** Every weekly review MUST conclude with exactly four items:

```
┌──────────────────────────────────────────┐
│  THIS WEEK'S TAKEAWAY                     │
│                                           │
│  ✅ What improved: [one thing]            │
│  ⚠️ What declined: [one thing]            │
│  🔍 Likely cause: [one evidence-backed    │
│     explanation, citing N and method]     │
│  ➡️ One change for next week: [specific,  │
│     actionable, measurable]              │
│                                           │
│  Example:                                 │
│  ✅ Deep sleep up 14% (avg 17.8% vs 15.6%)│
│  ⚠️ HRV down 6.8% from baseline          │
│  🔍 3 runs this week vs 2 last week,     │
│     volume +38% — likely accumulated      │
│     fatigue (N=7 days, both metrics       │
│     moving unfavorably since Wednesday)   │
│  ➡️ Cap next week at 2 runs, ≤12km total │
└──────────────────────────────────────────┘
```

If the system cannot populate all four items with evidence-backed data, it shows what it can and marks missing items as "Not enough data yet (need N more days)."

### Acceptance Test (The Real Product Test)

The Sunday Review is the product's acceptance test. After 3 consecutive weeks of use:

1. Can you complete the review in under 5 minutes?
2. Did you change at least ONE behavior (training load, bedtime, workout timing, rest day) based on what you saw?
3. Did you NOT need to open any other app (Apple Health, HAE Mac, notes app) to understand your week?

If all three are YES → the product works.
If any are NO → iterate on the review page before building anything else.

---

## 13. UI/UX Specifications

### Design Principles

1. **Information density** — Power user tool. More data per pixel than consumer wellness apps.
2. **Dark mode default** — Health dashboards look best on dark backgrounds.
3. **One color per metric, everywhere** — No ambiguity.
4. **Keyboard-first** — Tab, Arrow, Enter, Escape, ⌘K spotlight search.
5. **Apple-quality polish** — This must feel like it belongs on macOS.

### Color Tokens

| Token | Hex | Use |
|---|---|---|
| `--color-sleep` | `#5E5CE6` | Sleep metrics |
| `--color-hr` | `#FF453A` | Heart rate |
| `--color-hrv` | `#64D2FF` | HRV |
| `--color-steps` | `#30D158` | Steps |
| `--color-calories` | `#FF9F0A` | Calories / energy |
| `--color-workout` | `#FF375F` | Workouts |
| `--color-vo2` | `#5AC8FA` | VO2 Max |
| `--color-bg` | `#1C1C1E` | Background |
| `--color-surface` | `#2C2C2E` | Card surfaces |
| `--color-text-primary` | `#FFFFFF` | Primary text |
| `--color-text-secondary` | `#8E8E93` | Secondary text |
| `--color-trend-up` | `#30D158` | Improving |
| `--color-trend-down` | `#FF453A` | Declining |
| `--color-trend-flat` | `#8E8E93` | Stable |

### Navigation

```
Sidebar (240px, collapsible)
├── 🏠 Dashboard
├── 😴 Sleep
├── 🏃 Workouts
├── ❤️ Heart & Recovery
├── 📋 Weekly Review ← THE KILLER FEATURE
├── ────────────
├── ⚙️ Settings
└── 🔄 Sync Status
```

Phase 2 additions: 📊 Correlations, 🤖 AI Insights

---

## 14. Technical Stack

### Stack Decision

| Component | Choice | Rationale |
|---|---|---|
| **App delivery** | **localhost:3000** (Node.js + Express) | Fastest MVP. User runs `npx healthpulse`. Wrap in Tauri later. |
| **Frontend** | **React 18 + TypeScript** | Claude Code's strongest stack. |
| **Styling** | **Tailwind CSS** | Dark mode built-in, fast iteration. |
| **Charts** | **Recharts** (standard) + **D3.js** (heatmaps, custom) | Recharts for 80%. D3 for calendar heatmap and gauge. |
| **Database** | **better-sqlite3** | Synchronous, fast, zero-config. |
| **File watching** | **chokidar** | Cross-platform file watcher, mature. |
| **State** | **Zustand** | Lightweight React state management. |
| **Dates** | **date-fns** + **date-fns-tz** | Timezone-aware parsing. |
| **Statistics** | **simple-statistics** (npm) | Mean, std dev, linear regression, Pearson r. |
| **AI (Phase 2)** | **Anthropic SDK** (Claude API) | Best reasoning for health narratives. |

### Project Structure

```
healthpulse/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── README.md
├── src/
│   ├── index.ts                       # Entry: Express server + chokidar
│   ├── config.ts                      # Config management (defaults, user overrides)
│   │
│   ├── ingester/
│   │   ├── watcher.ts                 # chokidar watching iCloud Drive folders
│   │   ├── parser.ts                  # HAE JSON v2 parser (metrics + workouts)
│   │   ├── normalizer.ts             # Timezone conversion, unit normalization
│   │   ├── dedup.ts                   # File-level (hash) + record-level dedup
│   │   └── zones.ts                   # HR zone computation from heartRateData
│   │
│   ├── db/
│   │   ├── schema.sql                 # Full schema (copy from Section 9)
│   │   ├── client.ts                  # better-sqlite3 wrapper
│   │   ├── seed.ts                    # Initial config values
│   │   └── migrations/               # Schema versioning
│   │
│   ├── pipeline/
│   │   ├── aggregator.ts             # Daily rollups from raw samples
│   │   ├── moving-averages.ts        # 7/14/30/90-day MA + std dev
│   │   └── sleep-derived.ts          # Sleep efficiency, stage %, consistency
│   │
│   ├── evidence/
│   │   ├── trends.ts                  # Rolling delta + direction (Phase 1)
│   │   ├── thresholds.ts             # Goal/benchmark comparison (Phase 1)
│   │   ├── recovery-score.ts         # Composite recovery score with guardrails (Phase 1)
│   │   ├── weekly-summary.ts         # Aggregate insights for Sunday Review (Phase 1)
│   │   ├── anomalies.ts              # Z-score anomaly detection (Phase 2)
│   │   └── correlations.ts           # Pearson r cross-metric correlations (Phase 2)
│   │
│   ├── api/
│   │   ├── routes.ts                  # Express REST endpoints
│   │   ├── dashboard.ts              # GET /api/dashboard?range=30d
│   │   ├── sleep.ts                   # GET /api/sleep?range=30d
│   │   ├── workouts.ts               # GET /api/workouts?range=30d
│   │   ├── heart.ts                   # GET /api/heart?range=30d
│   │   ├── weekly-review.ts          # GET /api/weekly-review?week=2026-W14
│   │   └── sync-status.ts            # GET /api/sync-status
│   │
│   └── frontend/
│       ├── index.html
│       ├── App.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── SleepPage.tsx
│       │   ├── WorkoutsPage.tsx
│       │   ├── HeartPage.tsx
│       │   ├── WeeklyReview.tsx       # THE KILLER FEATURE
│       │   ├── Settings.tsx
│       │   └── Onboarding.tsx
│       ├── components/
│       │   ├── MetricCard.tsx
│       │   ├── SyncIndicator.tsx
│       │   ├── TimeRangeSelector.tsx
│       │   ├── Sidebar.tsx
│       │   └── charts/
│       │       ├── TrendLine.tsx
│       │       ├── SleepTimeline.tsx
│       │       ├── HRZoneBar.tsx
│       │       ├── CalendarHeatmap.tsx
│       │       ├── Sparkline.tsx
│       │       └── RecoveryGauge.tsx
│       ├── hooks/
│       │   ├── useHealthData.ts
│       │   ├── useTimeRange.ts
│       │   └── useSyncStatus.ts
│       └── lib/
│           ├── colors.ts              # Color tokens
│           └── format.ts              # Number/date formatting utilities
│
├── scripts/
│   ├── setup.sh                       # First-run: create ~/.healthpulse, init DB
│   └── backfill.ts                    # Manual historical import script
│
└── test/
    ├── parser.test.ts                 # Test against real HAE JSON samples
    ├── evidence.test.ts               # Test trend/anomaly/correlation detection
    └── fixtures/                      # Sample HAE JSON files for testing
```

---

## 15. Privacy & Security

1. **100% local.** SQLite at `~/.healthpulse/data.db`. No cloud. No accounts. No telemetry.
2. **iCloud private.** Sync data travels via user's own iCloud account (Apple-encrypted).
3. **AI opt-in only (Phase 2).** When enabled, only aggregated daily summaries sent to Claude API. Never raw timestamps, never personal identifiers.
4. **No regulatory exposure.** We explicitly do NOT provide medical advice. Recovery score is framed as "personal heuristic" not "clinical assessment."

---

## 16. Implementation Phases

### Phase 1: MVP (Target: 10 working days with Claude Code)

**Mantra:** Ingest. Store. Show. Review.

**Phase 1 Evidence Scope (STRICT):** Only threshold checks (metric vs. goal/benchmark) and rolling delta/trend (this week vs. last week, direction arrow). NO anomaly detection (z-score). NO correlation engine (Pearson r). Those are Phase 2. If you're tempted to add them in Phase 1 — don't. Ship first.

**Phase 1 UX Standard:** Functional dark mode, not pixel-perfect. Onboarding is a static markdown/HTML guide, not a polished wizard. Weekly Review is a composition of widgets already built on other pages, not a bespoke layout.

| Day | Deliverable | Success Check |
|---|---|---|
| 1 | Project scaffold. SQLite schema. Config system. Sample JSON test fixtures in `/test/fixtures/`. | `npm start` serves blank page at localhost:3000. DB created at `~/.healthpulse/data.db`. |
| 2 | Ingester: chokidar + HAE JSON v2 parser + normalizer + dedup. Parser fallback rules implemented. | Feed sample JSON → records appear in SQLite. Feed malformed JSON → file skipped, no crash. |
| 3 | Aggregation pipeline: daily rollups + 7/14/30-day moving averages + std dev. Sleep derived fields. HR zone computation for workouts. | Query `daily_aggregates` and `moving_averages` tables, see computed values. |
| 4 | REST API: `/api/dashboard`, `/api/sleep`, `/api/workouts`, `/api/heart`, `/api/weekly-review`, `/api/sync-status` | curl all endpoints, get JSON responses with real data. |
| 5 | Dashboard page: 6 metric cards with sparklines, trend arrows (delta vs. previous period), sync indicator. | Visual: dashboard renders with real data. |
| 6 | Sleep page: nightly stage timeline, duration trend with 7d MA, efficiency, stage % breakdown with benchmarks. | Visual: sleep analytics render. |
| 7 | Workouts page: list with sort/filter, per-workout HR zone chart, running weekly km trend. | Visual: workouts render with zone distribution. |
| 8 | Heart page: HRV trend, resting HR trend, VO2 Max with classification bands. Recovery score gauge (with guardrails — hidden if < 10 days baseline). | Visual: heart page renders. Recovery score shows or shows "building baseline" message. |
| 9 | Weekly Review page: composed from existing components — recovery summary, sleep summary, training volume, threshold-based insight cards (Zone 2 vs target, sleep vs goal, volume change vs last week). | **PRIMARY ACCEPTANCE TEST: Can complete weekly review in < 5 minutes without opening any other tool.** |
| 10 | Onboarding guide (static HTML). Dark mode pass. Navigation sidebar. Bug fixes. README with setup instructions. | Full flow: clone repo → npm install → configure HAE → see dashboard with real data. |

### Phase 2: Intelligence (Days 11-20)

| Feature | Days | What It Adds |
|---|---|---|
| Anomaly detection (z-score engine) | 2 | "Your resting HR is 2σ above baseline" |
| Correlation engine (Pearson r, pre-built checks) | 3 | "Late workouts correlate with worse deep sleep (r=-0.58)" |
| Claude API daily brief | 2 | AI narrative layered ON TOP of evidence_insights |
| Claude API weekly report | 2 | Richer Sunday Review with narrative summary |
| MCP integration (see Appendix A) | 1 | Claude Desktop can query HealthPulse data |

### Phase 3: Polish & Distribution (Days 21-30)

| Feature | Days | What It Adds |
|---|---|---|
| Tauri wrapper (native Mac app) | 3 | Menu bar icon, native feel, no browser needed |
| PDF weekly report export | 2 | Share with trainer/doctor |
| Running shoe mileage widget | 1 | Track Saucony Triumph 23 km |
| Extended metrics (SpO2, weight, respiratory rate) | 2 | Broader health picture |
| Light mode | 1 | For the weirdos |
| Open-source release prep (GitHub, README, license) | 1 | Community distribution |

---

## 17. HAE Dependency Risk Assessment

### Honest Assessment

HealthPulse depends on Health Auto Export more than a typical project should depend on a single third-party tool. This section makes that dependency explicit and mitigates it.

### Dependency Map

```
Critical Path:
  Apple Health → HealthKit → [HAE iOS App] → [iCloud Drive] → HealthPulse

We control:     ──────────────────────────────────────────── HealthPulse only
Apple controls: Apple Health, HealthKit, iCloud Drive
HAE controls:   HAE iOS App, JSON format, background sync behavior
```

### Risk Scenarios

| Scenario | Probability | Impact | Mitigation |
|---|---|---|---|
| **HAE changes JSON format** | Low (versioned, breaking changes rare) | Medium (parser breaks) | Pin to Export Version 2. Add format auto-detection. Test against real exports regularly. |
| **HAE gets discontinued** | Very Low (active development, 70K+ users, revenue-generating) | High (no new data) | Historical JSON files on disk still work. Fallback: Apple Health manual XML export (ugly but functional). Long-term: build minimal iOS companion. |
| **HAE Premium price increases** | Low | Low (already paid lifetime) | Lifetime purchase locks in access. |
| **Apple blocks HAE from HealthKit** | Very Low | Critical | Nothing we can do. Entire ecosystem collapses. Same risk for every non-Apple health app. |
| **iCloud Drive sync breaks** | Low | Medium (stale data) | Detect staleness. Show warning. Manual export as fallback. |

### Mitigation Strategy

1. **Never depend on HAE at runtime.** HealthPulse only reads static JSON files from iCloud Drive. If HAE stops working, existing files still render.
2. **Store everything in SQLite.** Even if HAE disappears, historical data is preserved locally.
3. **Abstract the ingester.** The parser is a module. Can add Apple Health XML parser, Oura JSON parser, or Garmin CSV parser later without touching the rest of the app.
4. **Consider building minimal iOS companion in Phase 4** if HAE dependency becomes uncomfortable. This is a ~2-week project for basic HealthKit → JSON → iCloud Drive. Not needed now, but the escape hatch exists.

---

## 18. Open Questions & Risks

### Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Personal tool or open-source from day 1? | Start personal. Open-source after Phase 1 works. |
| 2 | AI insights in Phase 1 or Phase 2? | **Phase 2.** Stats first. LLM second. This is the right discipline. |
| 3 | Tauri or localhost for MVP? | **localhost:3000.** Wrap in Tauri in Phase 3. |
| 4 | Max HR: formula (220-age=179) or manually set? | Default to formula. Allow override in settings. |
| 5 | Should we backfill historical data on first run? | Yes, but cap at 6 months default. User can extend. |
| 6 | How to handle timezone for someone in Israel? | Parse HAE's `+0300` timezone offset. Store UTC internally. Display in local time. |

### Remaining Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iOS background sync produces gaps in data | Medium | Medium | Show gaps honestly in charts. Don't interpolate. |
| Dashboard doesn't feel meaningfully better than HAE Mac | Medium | High — project fails | Invest heavily in UX. This is the entire thesis. |
| Evidence engine produces too few correlations (sparse data) | Medium | Medium | Need ~30+ days of data before correlations are meaningful. Set expectations in UI. |
| 2-week timeline is aggressive | Medium | Low — just takes longer | Core 6 features (dashboard, sleep, workouts, heart, review, ingester) are the only must-haves. Everything else can slip. |

---

## Appendix A: TCP/MCP Server (Advanced Mode)

**Status:** Not in MVP. Optional power-user feature for Phase 2+.

HAE's TCP server exposes an MCP-compatible interface on port 9000 (local network only). Useful for:

1. **Claude Desktop integration:** Add HAE MCP server to Claude Desktop config → Claude can query your health data directly
2. **Live data fill:** When on same WiFi, query specific metrics to fill gaps between iCloud Drive syncs
3. **Debugging:** Verify what data HAE sees vs. what's in iCloud Drive

**Limitations:** Same WiFi only, HAE must be in foreground on iPhone, unencrypted, not suitable as production data path.

**Config (if user enables):**
```json
{
  "mcpServers": {
    "health_auto_export": {
      "command": "node",
      "args": ["/path/to/hae-mcp/dist/server.js"]
    }
  }
}
```

---

## Appendix B: Recovery Score Algorithm

```typescript
interface RecoveryInput {
  hrv: number | null;
  hrvBaseline14d: number | null;
  hrvStdDev14d: number | null;
  hrvSampleCount: number;
  restingHR: number | null;
  rhrBaseline14d: number | null;
  rhrStdDev14d: number | null;
  rhrSampleCount: number;
  sleepEfficiency: number | null;   // 0-100
  sleepDurationHours: number | null;
  sleepGoalHours: number;
}

interface RecoveryResult {
  score: number;         // 0-100, or -1 for insufficient data
  label: string;
  color: string;
  basis: string;         // Human-readable explanation of inputs used
  degraded: boolean;     // True if some inputs were missing
  degradedNote?: string; // What was missing
}

const MIN_BASELINE_DAYS = 10;
const HRV_STDDEV_FLOOR = 1.0;   // ms — prevent z-score explosion
const RHR_STDDEV_FLOOR = 0.5;   // bpm

function calculateRecoveryScore(data: RecoveryInput): RecoveryResult {
  
  // ===== GUARD: Minimum baseline requirement =====
  const hasHRVBaseline = data.hrvSampleCount >= MIN_BASELINE_DAYS 
    && data.hrv !== null && data.hrvBaseline14d !== null && data.hrvStdDev14d !== null;
  const hasRHRBaseline = data.rhrSampleCount >= MIN_BASELINE_DAYS 
    && data.restingHR !== null && data.rhrBaseline14d !== null && data.rhrStdDev14d !== null;
  const hasSleep = data.sleepEfficiency !== null && data.sleepDurationHours !== null;
  
  // If we have neither heart metric baseline, we can't compute anything
  if (!hasHRVBaseline && !hasRHRBaseline) {
    const needed = MIN_BASELINE_DAYS - Math.max(data.hrvSampleCount, data.rhrSampleCount);
    return { 
      score: -1, label: "Building Baseline", color: "#8E8E93", 
      basis: `Need ${needed} more days of heart data to compute recovery score.`,
      degraded: true, degradedNote: "Insufficient baseline data"
    };
  }
  
  // ===== COMPUTE AVAILABLE COMPONENTS =====
  let totalWeight = 0;
  let weightedSum = 0;
  const parts: string[] = [];
  
  if (hasHRVBaseline) {
    const stdDev = Math.max(data.hrvStdDev14d!, HRV_STDDEV_FLOOR);
    const hrvZ = (data.hrv! - data.hrvBaseline14d!) / stdDev;
    const hrvScore = clamp(50 + (hrvZ * 25), 0, 100);
    const weight = hasSleep ? 0.4 : (hasRHRBaseline ? 0.57 : 1.0);
    weightedSum += hrvScore * weight;
    totalWeight += weight;
    parts.push(`HRV: ${data.hrv}ms vs ${data.hrvBaseline14d}ms baseline (z=${hrvZ.toFixed(1)})`);
  }
  
  if (hasRHRBaseline) {
    const stdDev = Math.max(data.rhrStdDev14d!, RHR_STDDEV_FLOOR);
    const rhrZ = (data.restingHR! - data.rhrBaseline14d!) / stdDev;
    const rhrScore = clamp(50 - (rhrZ * 25), 0, 100);
    const weight = hasSleep ? 0.3 : (hasHRVBaseline ? 0.43 : 1.0);
    weightedSum += rhrScore * weight;
    totalWeight += weight;
    parts.push(`RHR: ${data.restingHR} vs ${data.rhrBaseline14d} baseline (z=${rhrZ.toFixed(1)})`);
  }
  
  if (hasSleep) {
    const sleepEffScore = clamp(data.sleepEfficiency!, 0, 100);
    const sleepDurScore = clamp((data.sleepDurationHours! / data.sleepGoalHours) * 100, 0, 100);
    weightedSum += sleepEffScore * 0.2;
    weightedSum += sleepDurScore * 0.1;
    totalWeight += 0.3;
    parts.push(`Sleep: ${data.sleepEfficiency}% eff, ${data.sleepDurationHours}h / ${data.sleepGoalHours}h goal`);
  }
  
  // Normalize in case weights don't sum to 1 (degraded mode)
  const score = Math.round(weightedSum / totalWeight);
  const basis = parts.join('. ') + '.';
  
  // ===== DEGRADATION NOTES =====
  const missing: string[] = [];
  if (!hasHRVBaseline) missing.push('HRV');
  if (!hasRHRBaseline) missing.push('Resting HR');
  if (!hasSleep) missing.push('Sleep');
  const degraded = missing.length > 0;
  const degradedNote = degraded 
    ? `Score based on available data only. Missing: ${missing.join(', ')}.` 
    : undefined;
  
  // ===== CLASSIFY =====
  if (score >= 80) return { score, label: "Recovered", color: "#30D158", basis, degraded, degradedNote };
  if (score >= 60) return { score, label: "Moderate", color: "#FF9F0A", basis, degraded, degradedNote };
  return { score, label: "Fatigued", color: "#FF453A", basis, degraded, degradedNote };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
```

---

## Appendix C: Claude API Insight Prompt (Phase 2 Only)

**Critical rule: Only call this AFTER evidence_insights have been computed. The AI narrates validated signals — it does not discover them.**

```
System: You are a personal health data analyst generating a weekly narrative summary.

RULES:
- Every claim must reference a specific evidence record (provided below)
- Never invent correlations or trends not in the evidence data
- Use specific numbers, not vague language
- Framing: "your data shows..." not "you should..."
- Never provide medical advice
- Keep to 150 words max

User: Generate a weekly narrative from these evidence records:

EVIDENCE RECORDS:
{evidence_insights as JSON array}

RAW WEEKLY STATS:
Sleep avg: {value}h | HRV avg: {value}ms | RHR avg: {value}bpm
Workouts: {count} sessions, {total_km}km | Zone 2: {pct}%
Steps avg: {value}/day | Recovery score: {value}/100

Generate a 3-4 sentence narrative summary followed by 2-3 bullet-point 
recommendations. Each recommendation must cite the evidence record ID it's based on.
```

---

*End of PRD v3.0 — Ready for Claude Code implementation.*

*North star: Own the analysis layer, not the plumbing. Own the evidence, not the vibe. Own one workflow, not every health use case.*
