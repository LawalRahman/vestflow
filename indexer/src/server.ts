/**
 * VestFlow Indexer — Query HTTP Server
 *
 * A minimal Node.js HTTP server exposing read-only access to the indexed
 * event database. Run alongside the poller for local development, or
 * deploy as a long-lived service in production.
 *
 * Endpoints:
 *   GET /health
 *   GET /events?address=G...&event_type=claimed&limit=50&offset=0
 */

import http from "http";
import { URL } from "url";
import { queryEvents, getCheckpoint, getTvlStats } from "./db";
import { parseNetwork, type NetworkName } from "./config";
import type { EventQueryParams } from "./types";

const PORT = Number(process.env.INDEXER_PORT ?? "3001");

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function numParam(q: URLSearchParams, key: string): number | undefined {
  const v = q.get(key);
  if (v == null) return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const base = `http://localhost:${PORT}`;
  let parsed: URL;
  try {
    parsed = new URL(req.url ?? "/", base);
  } catch {
    return json(res, 400, { error: "Invalid URL" });
  }

  const { pathname, searchParams } = parsed;
  let network: NetworkName;
  try {
    network = parseNetwork(searchParams.get("network"));
  } catch {
    return json(res, 400, {
      error: "network must be either mainnet or testnet",
    });
  }

  if (pathname === "/health") {
    return json(res, 200, { ok: true, network, checkpoint: getCheckpoint(network) });
  }

  if (pathname === "/events") {
    try {
      const params: EventQueryParams = {
        network,
        address: searchParams.get("address") ?? undefined,
        grantor: searchParams.get("grantor") ?? undefined,
        beneficiary: searchParams.get("beneficiary") ?? undefined,
        event_type: searchParams.get("event_type") ?? undefined,
        schedule_id: numParam(searchParams, "schedule_id"),
        from_ledger: numParam(searchParams, "from_ledger"),
        to_ledger: numParam(searchParams, "to_ledger"),
        limit: numParam(searchParams, "limit"),
        offset: numParam(searchParams, "offset"),
      };

      const events = queryEvents(params);
      return json(res, 200, { events, network, checkpoint: getCheckpoint(network) });
    } catch (err) {
      console.error("[server] Query error:", err);
      return json(res, 500, { error: "Query failed" });
    }
  }

  if (pathname === "/stats/tvl") {
    try {
      return json(res, 200, getTvlStats(network));
    } catch (err) {
      console.error("[server] TVL query error:", err);
      return json(res, 500, { error: "TVL query failed" });
    }
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[server] Indexer query API → http://localhost:${PORT}`);
  console.log(`[server]   GET /health`);
  console.log(
    `[server]   GET /events?network=testnet&address=G...&event_type=claimed&limit=50`
  );
  console.log(`[server]   GET /stats/tvl?network=testnet`);
});
