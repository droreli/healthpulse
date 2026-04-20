import path from "node:path";
import { openDatabase, loadConfig } from "../src/db/client.js";
import { importAppleHealthZip } from "../src/apple-import/service.js";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npm run import-apple-health -- /path/to/export.zip");
    process.exit(1);
  }

  const zipPath = path.resolve(input);
  const db = openDatabase();

  try {
    const result = await importAppleHealthZip(db, zipPath, loadConfig(db));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
