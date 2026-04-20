# HealthPulse

HealthPulse is a local-first Mac health workbench for Apple Health exports. It ingests Health Auto Export JSON files from iCloud Drive, stores normalized data in SQLite, and renders deterministic dashboards and weekly reviews at `http://localhost:3000`.

It now supports username/password accounts with one SQLite database per user, which lets you expose one running instance to friends without mixing their data with yours.

## What The App Does

HealthPulse is built around a simple flow:

1. Export your Apple Health data from your iPhone.
2. Move that export archive to your Mac.
3. Run HealthPulse locally or deploy it to Cloudflare.
4. Upload the Apple Health archive in the app.
5. Let the importer normalize the data into SQLite and populate the dashboards.

The current workbench includes:

- Today / Dashboard
- Sleep
- Workouts
- Heart & Recovery
- Correlate
- Weekly Review
- Settings / import + annotations

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

## Running Locally

For personal use, the simplest setup is still local hosting on your Mac.

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open:

```text
http://localhost:3000
```

4. Create your account in the app and go to `Settings`.
5. Upload your Apple Health export archive there.

This is the easiest option if you only need the dashboard for yourself and want your data to stay on your own machine.

## Deploying To Cloudflare

HealthPulse can also be deployed to Cloudflare if you want a hosted URL instead of a purely local app.

This repo already includes Cloudflare Worker code and Wrangler config, so the hosted path is realistic for this project, not theoretical.

Typical reasons to deploy it:

- you want a stable URL
- you want to use the dashboard away from your Mac
- you want separate logins for a few trusted people

Cloudflare note:
- Cloudflare Workers gives accounts access to a Free plan by default.
- Cloudflare’s official Workers pricing docs also list a Paid plan starting at `$5/month` for higher limits.
- For a light personal dashboard or single-user setup, the Free plan may be enough, but you should verify current usage limits against your own import frequency and traffic before relying on it.

If you only need remote access while the app keeps running on your Mac, you can also expose the local server through a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
```

That tunnel approach is different from a real Cloudflare deployment:

- `local + tunnel`: app and database still run on your Mac
- `Cloudflare deployment`: app runs on Cloudflare infrastructure, using the Worker-based codepath in this repo

## Exporting Apple Health Data

On iPhone, Apple’s official export flow is:

1. Open the `Health` app.
2. Tap `Summary`.
3. Tap your profile picture or initials in the top-right.
4. Tap `Export All Health Data`.
5. Choose a share method that gets the export onto your Mac.

Practical ways to move it to the Mac:

- `AirDrop` the export from iPhone to Mac
- save it to `Files` / `iCloud Drive`, then open it on the Mac
- send it to yourself in a way that preserves the archive, then download it on the Mac

For HealthPulse, keep the export as the archive file and upload that `.zip` file in the app rather than manually unpacking and editing it first.

## Import Flow In HealthPulse

Once the archive is on the Mac:

1. Open HealthPulse.
2. Sign in or create your account.
3. Go to `Settings`.
4. Use the Apple Health import panel.
5. Choose the exported `.zip` file.
6. Wait for the import job to finish.

After import:

- sleep sessions populate the sleep views
- workouts populate training and heart-recovery views
- HRV / RHR / VO2 / steps refresh the dashboard and weekly review
- annotations you add in `Settings` become context markers in `Correlate`

## Choosing Between Local And Cloudflare

Use local hosting if:

- this is mainly for you
- you want the least operational complexity
- you prefer keeping the database on your own machine

Use Cloudflare if:

- you want a permanent public URL
- you want to access it remotely without keeping a tunnel open
- you want lightweight hosted access for a small number of users

## Data And Storage Model

HealthPulse is account-isolated:

- each username gets its own SQLite database
- the app keeps imports separated per user
- one deployment can serve multiple users without mixing their data

That said, if you publish a hosted instance, treat it like a real health-data app:

- use strong passwords
- do not publish raw Apple Health exports to GitHub
- review where databases and uploads are stored in your deployment environment

## Local data paths

- Database: `~/.healthpulse/data.db`
- Auth store: `~/.healthpulse/auth.db`
- Per-user databases: `~/.healthpulse/users/<username>/data.db`
- Default metrics folder:
  `~/Library/Mobile Documents/com~apple~CloudDocs/Health Auto Export/HealthPulse Metrics`
- Default workouts folder:
  `~/Library/Mobile Documents/com~apple~CloudDocs/Health Auto Export/HealthPulse Workouts`

## Accounts

- Create a username and password on first launch.
- Each account gets its own database file.
- Friends can use the same Cloudflare URL and will only see their own imported data after signing in.

## Test fixtures

- PRD-derived fixtures live in [`test/fixtures/prd-metrics.json`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/prd-metrics.json) and [`test/fixtures/prd-workouts.json`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/prd-workouts.json).
- Add redacted real HAE exports to [`test/fixtures/README.md`](/Volumes/WorkDrive/GitHub/Health app Codex/test/fixtures/README.md) locations to expand regression coverage.

## Reference Links

- Apple Support: [Share your data in Health on iPhone](https://support.apple.com/en-us/108323)
- Cloudflare Workers pricing: [Workers pricing docs](https://developers.cloudflare.com/workers/platform/pricing/)
