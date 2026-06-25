import fs from "fs";
import os from "os";
import path from "path";

// Simple integration test: insert created and revoked events and verify
// that querying event_type=schedule_created with LIMIT/OFFSET does not
// return revoked schedule_ids in the result set (no gaps).

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vestflow-indexer-test-"));
  const dbPath = path.join(tempDir, "testnet.db");
  const mainnetDbPath = path.join(tempDir, "mainnet.db");
  process.env.INDEXER_DB_PATH_TESTNET = dbPath;
  process.env.INDEXER_DB_PATH_MAINNET = mainnetDbPath;

  const { computeTvlStats, getDb, queryEvents } = await import("../src/db");

  const db = getDb("testnet");

  // Insert several created events for schedule_ids 1..6
  const now = Math.floor(Date.now() / 1000);
  const createdStmt = db.prepare(
    `INSERT INTO schedule_events (id,event_type,ledger,ledger_closed_at,schedule_id,grantor,beneficiary,amount,token,created_amount,raw_topics,raw_value,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  for (let i = 1; i <= 6; i++) {
    createdStmt.run(
      `t-${i}`,
      "schedule_created",
      100 + i,
      new Date(now * 1000).toISOString(),
      i,
      `GGRANTOR${i}`,
      `GBENEF${i}`,
      null,
      "CTOKEN",
      "1000",
      JSON.stringify(["created", i, `GGRANTOR${i}`, `GBENEF${i}`]),
      JSON.stringify([i, "1000"]),
      now
    );
  }

  // Revoke schedule 3 and 4 (simulating mid-page revocations)
  const revokeStmt = db.prepare(
    `INSERT INTO schedule_events (id,event_type,ledger,ledger_closed_at,schedule_id,grantor,beneficiary,amount,token,created_amount,raw_topics,raw_value,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  revokeStmt.run(
    `r-3`,
    "revoked",
    200,
    new Date(now * 1000).toISOString(),
    3,
    `GGRANTOR3`,
    null,
    null,
    "CTOKEN",
    null,
    JSON.stringify(["revoked", `GGRANTOR3`]),
    JSON.stringify([3, "400", "600"]),
    now + 1
  );

  revokeStmt.run(
    `r-4`,
    "revoked",
    201,
    new Date(now * 1000).toISOString(),
    4,
    `GGRANTOR4`,
    null,
    null,
    "CTOKEN",
    null,
    JSON.stringify(["revoked", `GGRANTOR4`]),
    JSON.stringify([4, "1000", "0"]),
    now + 1
  );

  db.prepare(
    `INSERT INTO schedule_events (id,event_type,ledger,ledger_closed_at,schedule_id,grantor,beneficiary,amount,token,created_amount,raw_topics,raw_value,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    "c-1",
    "claimed",
    202,
    new Date(now * 1000).toISOString(),
    1,
    null,
    "GBENEF1",
    "250",
    "CTOKEN",
    null,
    JSON.stringify(["claimed", "GBENEF1", "CTOKEN"]),
    JSON.stringify([1, "250", "250"]),
    now + 1
  );

  // Query via the public helper to simulate the API behavior
  const limit = 3;
  const offset = 0;
  const events = queryEvents({ network: "testnet", event_type: "schedule_created", limit, offset });

  console.log("Queried schedule_created (excluding revoked):", events.map((e: any) => e.schedule_id));

  // Expect returned schedule_ids to not include 3 or 4
  const ids = events.map((e: any) => e.schedule_id);
  if (ids.includes(3) || ids.includes(4)) {
    console.error('Test failed: revoked schedule ids present in results');
    process.exit(1);
  }

  // Also ensure we get up to `limit` rows (since revoked ones excluded)
  if (ids.length !== limit) {
    console.error(`Test failed: expected ${limit} rows, got ${ids.length}`);
    process.exit(1);
  }

  const tvl = computeTvlStats("testnet");
  if (
    tvl.total_value_locked !== "4350" ||
    tvl.assets[0]?.active_schedules !== 4
  ) {
    throw new Error(`Unexpected TVL aggregation: ${JSON.stringify(tvl)}`);
  }

  const mainnetTvl = computeTvlStats("mainnet");
  if (mainnetTvl.total_value_locked !== "0" || mainnetTvl.assets.length !== 0) {
    throw new Error("Mainnet and Testnet databases are not isolated");
  }

  db.close();
  getDb("mainnet").close();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Pagination, TVL, and network isolation tests passed');
  process.exit(0);
}

run().catch((e) => {
  console.error('Test error', e);
  process.exit(1);
});
