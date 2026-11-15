// Գիտելիքի կենտրոն — static site + AI proxy (no dependencies, Node >= 18)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "2000", 10);
const RATE_PER_HOUR = parseInt(process.env.RATE_PER_HOUR || "60", 10);
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};

// --- simple in-memory rate limit per IP ---
const hits = new Map();
function limited(ip) {
  const now = Date.now(), hour = 3600e3;
  const arr = (hits.get(ip) || []).filter(t => now - t < hour);
  if (arr.length >= RATE_PER_HOUR) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req, max = 200e3) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > max) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function normalizeMessages(input) {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return null;
  const msgs = input.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 20000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs.slice(-30);
}

async function handleSample(req, res) {
  if (!API_KEY) return send(res, 503, { code: "not_granted", message: "ANTHROPIC_API_KEY is not set on the server" });
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (limited(ip)) return send(res, 429, { code: "rate_limited", message: "Too many requests, try again later" });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { code: "bad_request", message: "Invalid JSON" }); }
  const messages = normalizeMessages(body.input);
  if (!messages) return send(res, 400, { code: "bad_request", message: "input must be a string or messages ending with user" });
  const stream = body.stream !== false;
  const payload = {
    model: MODEL, max_tokens: MAX_TOKENS, messages, stream,
    system: body.json
      ? "Answer with valid JSON only, no prose and no code fences."
      : "You are a patient tutor on an Armenian-language learning site. Answer in the language the user writes in unless asked otherwise."
  };
  let upstream;
  try {
    upstream = await fetch(BASE_URL + "/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload)
    });
  } catch (e) { return send(res, 502, { code: "upstream_error", message: "Could not reach the AI service" }); }
  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    console.error("Anthropic error", upstream.status, t.slice(0, 500));
    return send(res, upstream.status === 429 ? 429 : 502, { code: upstream.status === 429 ? "rate_limited" : "upstream_error", message: "AI service error " + upstream.status });
  }
  if (!stream) {
    const j = await upstream.json();
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return send(res, 200, { text, truncated: j.stop_reason === "max_tokens" });
  }
  // stream: forward only text deltas as plain text
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const reader = upstream.body.getReader(); const dec = new TextDecoder(); let buf = "";
  req.on("close", () => { try { reader.cancel(); } catch (e) {} });
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5));
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") res.write(ev.delta.text);
        } catch (e) {}
      }
    }
  } catch (e) {}
  res.end();
}

function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" || p.startsWith("/data/") ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  if (req.url === "/healthz") return send(res, 200, { ok: true, ai: !!API_KEY });
  if (req.url === "/api/config" && req.method === "GET") return send(res, 200, { ai: !!API_KEY });
  if (req.url === "/api/sample" && req.method === "POST") return handleSample(req, res).catch(e => { console.error(e); if (!res.headersSent) send(res, 500, { code: "server_error", message: "Server error" }); else res.end(); });
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");
  serveStatic(req, res);
}).listen(PORT, () => console.log(`Server on :${PORT} · AI ${API_KEY ? "on (" + MODEL + ")" : "off (no ANTHROPIC_API_KEY)"}`));
