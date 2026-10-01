/**
 * Minimal CORS forwarder for the local Hardhat node.
 *
 * A Headless-Chrome E2E injects a window.ethereum stub that speaks JSON-RPC
 * to the node, but postMessage/fetch from the app origin (localhost:3000)
 * hits Hardhat's missing CORS headers. This proxy adds the headers on :8546.
 *
 * The proxy binds to loopback and only answers browser requests whose Origin
 * is the dev app. Blank-preflight and non-browser (curl/Node) callers on the
 * loopback are still tolerated for local tooling; any other origin is refused
 * so a random web page cannot reach the unlocked local RPC node.
 *
 *   node contracts/scripts/cors-proxy.mjs
 */
import http from "node:http";

const port = Number(process.env.PROXY_PORT ?? 8546);
const target = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";

const allowOrigin = (origin) => !origin || origin === allowedOrigin;

function send(req, res, status, message) {
  res.writeHead(status, { "content-type": "text/plain" });
  res.end(message);
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (!allowOrigin(origin)) {
    send(req, res, 403, `origin ${origin} not allowed`);
    return;
  }
  const headers = {
    "Access-Control-Allow-Origin": origin || allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(200, headers);
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
        res.writeHead(r.statusCode ?? 200, {
          ...headers,
          "content-type": r.headers["content-type"] ?? "application/json",
        });
        r.pipe(res);
      }
    );
    out.on("error", () => {
      send(req, res, 502, "proxy upstream error");
    });
    out.end(body);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`cors-proxy: ${target} -> http://127.0.0.1:${port} (origin ${allowedOrigin})`);
});