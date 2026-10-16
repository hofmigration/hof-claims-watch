// watch.js — the run. Read-only: nothing in HubSpot is changed.
const fs = require("fs");
const path = require("path");
const { SETTINGS } = require("./config");
const hub = require("./0-hubspot");
const D = require("./1-detect");
const { buildEmail, buildCsv, sendEmail } = require("./2-report");

const ORDER = { high: 0, claim: 1, mention: 2, neutral: 3 };

function build(emails, tmpl, owners, from, to) {
  const groups = new Map();
  const add = (key, base) => groups.get(key) || groups.set(key, base).get(key);

  for (const e of emails.values()) {
    const p = e.properties || {};
    const scan = D.scan(p.hs_email_subject, p.hs_email_text);
    if (!scan || scan.level === "neutral") continue;
    const t = Date.parse(p.hs_timestamp) || 0;
    const g = add(D.fingerprint(p.hs_email_subject, p.hs_email_text), { source: "email", subject: D.clean(p.hs_email_subject), scan, level: scan.level, count: 0, first: t, last: t, byOwner: {} });
    g.count++;
    g.first = Math.min(g.first, t); g.last = Math.max(g.last, t);
    const who = owners[p.hubspot_owner_id] || (p.hubspot_owner_id ? `Owner ${p.hubspot_owner_id}` : "Unknown");
    g.byOwner[who] = (g.byOwner[who] || 0) + 1;
  }

  for (const t of tmpl.list) {
    const scan = D.scan(t.subject, `${t.name || ""}. ${t.body || ""}`);
    if (!scan || scan.level === "neutral") continue;
    const created = Number(t.createdAt) || Date.parse(t.createdAt) || 0, updated = Number(t.updatedAt) || Date.parse(t.updatedAt) || 0;
    groups.set(`template:${t.id}`, { source: "template", subject: D.clean(t.subject || t.name), scan, level: scan.level, count: 0,
      first: created, last: updated, created, updated, recent: Math.max(created, updated) >= from,
      ownerName: owners[t.ownerId] || "", byOwner: {} });
  }

  const list = [...groups.values()].sort((a, b) => ORDER[a.level] - ORDER[b.level] || (a.source === "template") - (b.source === "template") || b.count - a.count);

  // by sender, over the claims only
  const cons = new Map();
  for (const g of list.filter((x) => x.level === "high" || x.level === "claim")) {
    for (const [n, c] of Object.entries(g.byOwner)) {
      const r = cons.get(n) || { name: n, emails: 0, messages: 0, lastT: 0 };
      r.emails += c; r.messages++; r.lastT = Math.max(r.lastT, g.last);
      cons.set(n, r);
    }
  }
  const off = SETTINGS.TZ_OFFSET_HOURS * 3600e3;
  const byConsultant = [...cons.values()].sort((a, b) => b.emails - a.emails)
    .map((c) => ({ ...c, last: new Date(c.lastT + off).toISOString().slice(0, 10) }));

  return { groups: list, byConsultant, templates: tmpl, from, to, searches: SETTINGS.SEARCHES, emailsChecked: emails.size };
}

async function main() {
  if (!process.env.HUBSPOT_TOKEN) { console.log("!! No HUBSPOT_TOKEN secret."); process.exit(1); }
  try {
    const to = Date.now();
    const d = new Date(to); d.setMonth(d.getMonth() - SETTINGS.MONTHS_BACK);
    const from = d.getTime();
    console.log(`=== Attorney & USCIS claims — last ${SETTINGS.MONTHS_BACK} months ===\n`);

    const owners = await hub.ownerNames();
    const tmpl = await hub.templates();
    console.log(tmpl.ok ? `Templates: ${tmpl.list.length} read.` : `Templates: could not be read (${tmpl.status || "error"}). Sent emails will still be checked.`);

    const emails = new Map();
    for (const q of SETTINGS.SEARCHES) {
      const before = emails.size;
      await hub.sentEmails(q, from, to, (rs) => rs.forEach((e) => emails.set(String(e.id), e)));
      console.log(`  "${q}": ${emails.size - before} new email(s)`);
    }
    console.log(`  ${emails.size} sent emails to check\n`);

    const R = build(emails, tmpl, owners, from, to);
    const flagged = R.groups.filter((g) => g.level === "high" || g.level === "claim");
    console.log(`===== ${flagged.length} message(s) making a claim =====`);
    for (const g of flagged) console.log(`  [${g.level.toUpperCase()}] ${g.source === "template" ? "TEMPLATE " : ""}${g.subject}${g.source === "email" ? ` — sent ${g.count}×` : ""}`);

    fs.mkdirSync(SETTINGS.OUT_DIR, { recursive: true });
    const html = buildEmail(R), csv = buildCsv(R);
    fs.writeFileSync(path.join(SETTINGS.OUT_DIR, "report.html"), html);
    fs.writeFileSync(path.join(SETTINGS.OUT_DIR, "claims.csv"), csv);
    console.log(`\nWrote report.html and claims.csv — both in this run's Artifacts.`);

    if (!SETTINGS.SEND_EMAIL) { console.log("Not emailed — send_email was false."); return; }
    const sent = flagged.filter((g) => g.source === "email").reduce((t, g) => t + g.count, 0);
    const ok = await sendEmail(flagged.length ? `Attorney & USCIS claims: ${flagged.length} message(s), sent ${sent} times` : "Attorney & USCIS claims: none found", html, "claims.csv", csv);
    if (ok) console.log(`Emailed to ${SETTINGS.REPORT_TO}.`); else { console.log("!! Not emailed. The report is still in Artifacts."); process.exitCode = 1; }
  } catch (e) {
    console.error(`\nFAILED: ${e.message}`);
    process.exit(1);
  }
}

// run only when started directly, so the self-test can borrow build() without a full run
if (require.main === module) main();
module.exports = { build };
