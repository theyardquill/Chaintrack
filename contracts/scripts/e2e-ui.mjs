/**
 * End-to-end browser test for the ChainTrack UI against a locally seeded node.
 *
 * Prerequisites (see contracts/scripts/e2e-local.sh):
 *   - a running Hardhat node on :8545 already seeded via `pnpm --filter contracts seed`
 *   - the web app built with the seeded address and served on :3000
 *   - a CORS proxy on :8546 (contracts/scripts/cors-proxy.mjs)
 *   - a headless Chrome exposing the CDP port in CDP_PORT (default 9224)
 *
 * A window.ethereum stub forwards JSON-RPC to the RPC port so the app can
 * sign/read against the real seeded contract without MetaMask.
 *
 *   CDP_PORT=9224 node contracts/scripts/e2e-ui.mjs
 */
import http from "node:http";

const CDP_PORT = Number(process.env.CDP_PORT ?? 9224);
const RPC = process.env.RPC ?? "http://127.0.0.1:8546";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Hardhat default accounts (m/44'/60'/0'/0/0..2) — the same wallets seed.ts
// registers as Alice, Bob and Courier.
const ACCT = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Alice Sender (SENDER)
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Bob Receiver (RECEIVER)
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Courier Corp (AGENT)
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) =>
  new Promise((res, rej) => {
    http.get({ host: "127.0.0.1", port: CDP_PORT, path: p }, (r) => {
      let b = "";
      r.on("data", (c) => (b += c));
      r.on("end", () => {
        try {
          res(JSON.parse(b));
        } catch (e) {
          rej(e);
        }
      });
    }).on("error", rej);
  });

const STUB = `(() => {
  if (window.__stubInjected) return; window.__stubInjected = true;
  window.__acc = ${JSON.stringify(ACCT[0])};
  class Prov {
    async request(a) {
      if (a.method === "eth_requestAccounts" || a.method === "eth_accounts") return [window.__acc];
      const res = await fetch(${JSON.stringify(RPC)}, { method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: a.method, params: a.params || [] }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    }
  }
  Object.defineProperty(window, "ethereum", { value: new Prov(), configurable: true });
  window.__setAcc = (a) => { window.__acc = a; };
})();`;

async function main() {
  let tab;
  for (let i = 0; i < 10; i++) {
    try {
      tab = (await getJson("/json")).find((t) => t.type === "page");
      if (tab) break;
    } catch {}
    await sleep(500);
  }
  if (!tab) throw new Error(`No CDP tab on port ${CDP_PORT}`);
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result?.value;
  };
  send("Page.enable");
  send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: STUB });

  const has = async (txt) => {
    await sleep(350);
    return evalJS(`document.body.innerText.includes(${JSON.stringify(txt)})`);
  };
  const clickByText = async (txt) => {
    for (let i = 0; i < 15; i++) {
      const ok = await evalJS(`(()=>{const el=[...document.querySelectorAll("button")].find(b=>b.innerText.trim().includes(${JSON.stringify(txt)})); if(!el) return false; el.click(); return true;})()`);
      if (ok) return true;
      await sleep(500);
    }
    return false;
  };
  const setInput = async (placeholder, val) =>
    evalJS(`(()=>{const el=document.querySelector(${JSON.stringify(`input[placeholder='${placeholder}']`)}); if(!el) return false; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set; setter.call(el,${JSON.stringify(val)}); el.dispatchEvent(new Event("input",{bubbles:true})); return true;})()`);
  const goto = async (url) => {
    await send("Page.navigate", { url });
    await sleep(1500);
  };

  const results = [];
  const check = (name, ok, extra = "") => {
    results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
    if (!ok) throw new Error(`Assertion failed: ${name}`);
  };

  // ---- 1. Admin: connect as owner; bind demo users' wallets to the seeded
  //      on-chain identities (seed already registered them on the contract).
  await goto(`${BASE}/admin/login`);
  await evalJS(`localStorage.removeItem("chaintrack-demo-v1")`);
  await evalJS(`localStorage.setItem("chaintrack-session", JSON.stringify({type:"admin",id:"admin"}))`);
  await goto(`${BASE}/admin`);
  await sleep(1000);
  await clickByText("Connect wallet to unlock on-chain escrow");
  await sleep(2500);
  check("admin connects as registry owner", await has("registry owner"));
  const bound = await evalJS(`(()=>{const s=JSON.parse(localStorage.getItem("chaintrack-demo-v1")); if(!s) return "NO STORE"; s.users=s.users.map(u=>{ if(u.id===1) u.wallet=${JSON.stringify(ACCT[0])}; if(u.id===2) u.wallet=${JSON.stringify(ACCT[1])}; if(u.id===3) u.wallet=${JSON.stringify(ACCT[2])}; return u;}); localStorage.setItem("chaintrack-demo-v1", JSON.stringify(s)); return "OK";})()`);
  check("demo wallets bound to seeded identities", bound === "OK", bound);

  // ---- 2. Ship: book a fresh package on-chain (Alice = sender).
  await goto(`${BASE}/ship`);
  await evalJS(`localStorage.removeItem("chaintrack-session")`);
  await sleep(800);
  await clickByText("Connect wallet to unlock on-chain escrow");
  await sleep(2500);
  check("ship connects as Alice on-chain", await has("on-chain: Alice Sender"));
  await setInput("e.g. electronics, documents…", "server parts");
  await setInput("MFA code for confirmation", "DEL-4242");
  const checked = await evalJS(`(()=>{const cb=[...document.querySelectorAll("input[type=checkbox]")].find(c=>c.closest("label")?.innerText.includes("Also book this shipment")); if(!cb) return false; cb.click(); return true;})()`);
  check("record-on-chain enabled", !!checked);
  await clickByText("Book shipment & lock escrow");
  for (let i = 0; i < 30; i++) {
    if (await has("On-chain booking confirmed")) break;
    await sleep(700);
  }
  check("shipment booked on-chain", await has("On-chain booking confirmed"));

  const code = await evalJS(`(()=>{const m=document.body.innerText.match(/track\\?code=(CTK-\\d{4})/); return m?m[1]:null;})()`);
  check("got on-chain tracking code", !!code, code ?? "none");

  // ---- 3. Checkpoint: Courier advances the new package to Out For Delivery.
  await goto(`${BASE}/agent/login`);
  await evalJS(`localStorage.setItem("chaintrack-session", JSON.stringify({type:"user",user:{id:3,name:"Courier Corp",phone:"+254711000003",role:"AGENT"}}))`);
  await goto(`${BASE}/checkpoint`);
  await sleep(1200);
  await evalJS(`window.__setAcc(${JSON.stringify(ACCT[2])})`);
  await clickByText("Connect wallet to unlock on-chain escrow");
  await sleep(2500);
  check("agent connects as Courier on-chain", await has("Courier Corp"));
  const picked = await evalJS(`(async()=>{const trig=document.querySelector("button[aria-haspopup='listbox']"); if(!trig) return "NO TRIG"; trig.click(); await new Promise(r=>setTimeout(r,600)); const opt=[...document.querySelectorAll("[role=option]")].find(o=>o.textContent.includes(${JSON.stringify(code)})); if(!opt) return "NO OPT"; opt.click(); await new Promise(r=>setTimeout(r,400)); return "OK";})()`);
  check("selected booked package", picked === "OK", picked);
  await setInput("e.g. JKIA Cargo Terminal", "Nairobi Hub");
  await evalJS(`(()=>{const cb=[...document.querySelectorAll("input[type=checkbox]")].find(c=>c.closest("label")?.innerText.includes("Also write this checkpoint")); if(!cb) return false; cb.click(); return true;})()`);
  await clickByText("Log checkpoint event");
  for (let i = 0; i < 30; i++) {
    if (await has("On-chain checkpoint logged")) break;
    await sleep(700);
  }
  check("checkpoint logged on-chain", await has("On-chain checkpoint logged"));

  await setInput("e.g. JKIA Cargo Terminal", "Last-Mile Dispatch");
  const stOk = await evalJS(`(async()=>{const trigs=[...document.querySelectorAll("button[aria-haspopup='listbox']")]; const trig=trigs[1]; if(!trig) return "NO TRIG"; trig.click(); await new Promise(r=>setTimeout(r,600)); const opt=[...document.querySelectorAll("[role=option]")].find(o=>o.textContent.includes("Out for Delivery")); if(!opt) return "NO OPT"; opt.click(); await new Promise(r=>setTimeout(r,400)); return "OK";})()`);
  check("set status Out for Delivery", stOk === "OK", stOk);
  await clickByText("Log checkpoint event");
  for (let i = 0; i < 30; i++) {
    if (await has("On-chain checkpoint logged")) break;
    await sleep(700);
  }
  check("second checkpoint logged on-chain", await has("On-chain checkpoint logged"));

  // ---- 4. Track: Bob confirms delivery on-chain (escrow released).
  await goto(`${BASE}/admin/login`);
  await evalJS(`localStorage.removeItem("chaintrack-session")`);
  await goto(`${BASE}/track?code=${code}`);
  await sleep(1200);
  await evalJS(`window.__setAcc(${JSON.stringify(ACCT[1])})`);
  await clickByText("Connect wallet to unlock on-chain escrow");
  await sleep(2500);
  check("track shows on-chain record", await has("On-chain record"));
  check("track shows package on-chain", await has("package #"));
  await setInput("Delivery code", "DEL-4242");
  await clickByText("Confirm on-chain");
  for (let i = 0; i < 30; i++) {
    if (await has("Transaction confirmed")) break;
    await sleep(700);
  }
  check("delivery confirmed on-chain (escrow released)", await has("Transaction confirmed"));

  // ---- 5. Seed package sanity: CTK-9000 should already exist on-chain.
  await goto(`${BASE}/track?code=CTK-9000`);
  await sleep(1200);
  await evalJS(`window.__setAcc(${JSON.stringify(ACCT[1])})`);
  await clickByText("Connect wallet to unlock on-chain escrow");
  await sleep(2500);
  const seedOk = await has("On-chain record");
  if (!seedOk) {
    console.error("SEED-DEBUG:", JSON.stringify(await evalJS(`({alerts:[...document.querySelectorAll("[role=alert]")].map(e=>e.innerText), body: document.body.innerText.slice(0, 700), url: location.href})`), null, 1));
  }
  check("seed package has on-chain record", seedOk);
  check("seed package is package #1 (Registered)", await has("package #1"));
  const escrowOk = await has("InEscrow");
  if (!escrowOk) {
    console.error("ESC-DEBUG:", JSON.stringify(await evalJS(`(()=>{const c=[...document.querySelectorAll("div")].find(d=>d.innerText.includes("On-chain record")); return c?c.innerText.slice(0,400):"NO CARD"})()`), null, 1));
  }
  check("seed package escrow locked", escrowOk);

  console.log(results.join("\n"));
  ws.close();
  await sleep(300);
  process.exit(results.every((r) => r.startsWith("PASS")) ? 0 : 1);
}

main().catch(async (e) => {
  console.error("E2E ERROR:", e.message);
  process.exit(1);
});