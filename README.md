# HealthPulse

HealthPulse is a local-first Mac health workbench for Apple Health exports. It ingests Health Auto Export JSON files from iCloud Drive, stores normalized data in SQLite, and renders deterministic dashboards and weekly reviews at `http://localhost:3000`.

It now supports username/password accounts with one SQLite database per user, which lets you expose one running instance to friends without mixing their data with yours.

## Stack

- Express + Vite on one local server
- React 18 + TypeScript + Tailwind CSS
- SQLite via `better-sqlite3`
- File watching via `chokidar`
- Deterministic trend/threshold evidence only for Phase 1

## Commands

```bash
npm install
npm start
npm test
npm run build
npm run backfill -- /path/to/export.json metrics
```

To expose the app through Cloudflare while it runs on your machine:

```bash
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
```

## Local data paths

- Database: `~/.healthpulse/data.db`
- Auth store: `~/.healthpulse/auth.db`
- Per-user databases: `~/.healthpulse/users/<username>/data.db`
- Default metrics folder:
  `~/Library/Mobile Documents/com~apple~CloudDocs/Health Auto Export/HealthPulse Metrics`
- Default workouts folder:
  `~/Library/Mobile Documents/com~apple~CloudDocs/Health Auto Export/HealthPulse Workouts`

## MVP pages

- Dashboard
- Sleep
- Workouts
- Heart & Recovery
- Weekly Review
- Onboarding
- Settings

## Accounts

- Create a username and password on first launch.
- Each account gets its own database file.
- Friends can use the same Cloudflare URL and will only see their own imported data after signing in.

## Test fixtures

- PRD-derived fixtures live in [`test/fixtures/prd-metrics.json`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/prd-metrics.json) and [`test/fixtures/prd-workouts.json`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/prd-workouts.json).
- Add redacted real HAE exports to [`test/fixtures/README.md`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/README.md) locations to expand regression coverage.
