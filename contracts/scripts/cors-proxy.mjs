/**
 * Minimal CORS forwarder for the local Hardhat node.
 *
 * A Headless-Chrome E2E injects a window.ethereum stub that speaks JSON-RPC
 * to the node, but postMessage/fetch from the app origin (localhost:3000)
 * hits Hardhat's missing CORS headers. This proxy adds the headers on :8546.
 *
 *   node contracts/scripts/cors-proxy.mjs
 */
import http from "node:http";

const port = Number(process.env.PROXY_PORT ?? 8546);
const target = process.env.RPC_URL ?? "http://127.0.0.1:8545";

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const t = new URL(target);
    const out = http.request(
      {
        hostname: t.hostname,
        port: t.port,
        path: t.pathname || "/",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (r) => {
        res.writeHead(r.statusCode ?? 200, { "Access-Control-Allow-Origin": "*" });
        r.pipe(res);
      }
    );
    out.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    out.end(body);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`cors-proxy: ${target} -> http://127.0.0.1:${port}`);
});