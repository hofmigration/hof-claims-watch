// 0-hubspot.js — reading HubSpot. Nothing is ever written.
const { SETTINGS } = require("./config");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

async function hs(method, path, body, attempt = 0) {
  const wait = last + 1000 / SETTINGS.HUBSPOT_RPS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  let res;
  try {
    res = await fetch(`https://api.hubapi.com${path}`, {
      method, headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (attempt < 5) { await sleep(2000 * (attempt + 1)); return hs(method, path, body, attempt + 1); }
    throw new Error(`Could not reach HubSpot: ${e.message}`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 7) { await sleep(2500 * (attempt + 1)); return hs(method, path, body, attempt + 1); }
  const text = await res.text();
  if (!res.ok) { const e = new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`); e.status = res.status; throw e; }
  return text ? JSON.parse(text) : null;
}

const PROPS = ["hs_timestamp", "hs_email_subject", "hs_email_text", "hubspot_owner_id", "hs_email_direction"];

// Every sent email matching one full-text search since `from`. HubSpot will not page past
// 10,000 results in one search, so a window that is too big is halved until each part fits.
async function sentEmails(query, from, to, onPage, depth = 0) {
  const body = (f, t) => ({ query, filterGroups: [{ filters: [
    { propertyName: "hs_email_direction", operator: "EQ", value: "EMAIL" },
    { propertyName: "hs_timestamp", operator: "GTE", value: String(f) },
    { propertyName: "hs_timestamp", operator: "LT", value: String(t) }] }] });
  const probe = await hs("POST", "/crm/v3/objects/emails/search", { ...body(from, to), properties: ["hs_timestamp"], limit: 1 });
  const total = probe.total || 0;
  if (!total) return 0;
  if (total > 9800 && depth < 14 && to - from > 3600e3) {
    const mid = Math.floor((from + to) / 2);
    return (await sentEmails(query, from, mid, onPage, depth + 1)) + (await sentEmails(query, mid, to, onPage, depth + 1));
  }
  let after, got = 0;
  for (let i = 0; i < 120; i++) {
    const r = await hs("POST", "/crm/v3/objects/emails/search", { ...body(from, to), properties: PROPS,
      sorts: [{ propertyName: "hs_timestamp", direction: "ASCENDING" }], limit: 100, after });
    got += (r.results || []).length;
    onPage(r.results || []);
    after = r.paging && r.paging.next && r.paging.next.after;
    if (!after) break;
  }
  return got;
}

// Sales email templates. HubSpot says this API needs user-level access, which a private
// app token may not have — so a refusal is reported, never treated as "no templates".
async function templates() {
  const out = []; let after;
  try {
    for (let i = 0; i < 200; i++) {
      const r = await hs("GET", `/automation/email-templates/2026-09?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`);
      out.push(...(r.results || []));
      after = r.paging && r.paging.next && r.paging.next.after;
      if (!after) break;
    }
    return { ok: true, list: out };
  } catch (e) {
    return { ok: false, status: e.status, error: e.message, list: out };
  }
}

async function ownerNames() {
  const map = {}; let after;
  try {
    for (let i = 0; i < 20; i++) {
      const r = await hs("GET", `/crm/v3/owners?limit=500${after ? `&after=${after}` : ""}`);
      (r.results || []).forEach((o) => { map[o.id] = `${o.firstName || ""} ${o.lastName || ""}`.trim() || o.email || o.id; });
      after = r.paging && r.paging.next && r.paging.next.after;
      if (!after) break;
    }
  } catch { /* names are a nicety */ }
  return map;
}

module.exports = { hs, sentEmails, templates, ownerNames };
