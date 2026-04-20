import path from "node:path";
import { openDatabase, loadConfig } from "../src/db/client.js";
import { ingestDirectory, ingestFile } from "../src/ingester/service.js";

async function main() {
  const target = process.argv[2];
  const typeArg = process.argv[3] === "workouts" ? "workouts" : process.argv[3] === "metrics" ? "metrics" : null;

  if (!target) {
    console.error("Usage: npm run backfill -- <path> [metrics|workouts]");
    process.exit(1);
  }

  const db = openDatabase();
  const config = loadConfig(db);
  const absolutePath = path.resolve(target);

  try {
    const stats = await importTarget(db, absolutePath, typeArg, config);
    console.log(`Imported ${stats.length} file(s).`);
  } finally {
    db.close();
  }
}

async function importTarget(
  db: ReturnType<typeof openDatabase>,
  target: string,
  explicitType: "metrics" | "workouts" | null,
  config: ReturnType<typeof loadConfig>
) {
  if (target.endsWith(".json")) {
    const type = explicitType ?? (target.toLowerCase().includes("workout") ? "workouts" : "metrics");
    return [await ingestFile(db, target, type, config)];
  }

  const metrics = await ingestDirectory(db, target, explicitType ?? "metrics", config);
  return metrics;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
