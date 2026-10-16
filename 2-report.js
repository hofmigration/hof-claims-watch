// 2-report.js — the email, with everything in the body.
const { SETTINGS } = require("./config");
const { highlight, clean } = require("./1-detect");

const C = { navy: "#16205e", royal: "#1f2f8f", ink: "#1f2937", body: "#3f4a5a", soft: "#868e9b", line: "#e6e9f1", panel: "#f7f9fc",
  bad: "#b42318", badbg: "#fdecea", warn: "#9a5b0c", warnbg: "#fff5e8", good: "#1e7a4d", goodbg: "#e9f6ee" };
const FONT = "font-family:Arial,Helvetica,sans-serif";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x) => Number(x || 0).toLocaleString("en-US");
const day = (t) => (t ? new Date(t + SETTINGS.TZ_OFFSET_HOURS * 3600e3).toISOString().slice(0, 10) : "");
const LEVEL = { high: ["Affiliation + outcome claim", C.bad, C.badbg], claim: ["Affiliation claim", C.warn, C.warnbg], mention: ["Mention only", C.soft, C.panel] };
const TD = `style="padding:6px 8px;border-top:1px solid ${C.line};${FONT};font-size:12px;color:${C.ink};vertical-align:top"`;
const TH = `style="padding:7px 8px;${FONT};font-size:10.5px;font-weight:bold;color:${C.navy};background:${C.panel};text-transform:uppercase"`;

function card(g) {
  const [label, fg, bg] = LEVEL[g.level];
  // the most serious sentences first: a claim that also promises a better result, then
  // outcome wording, then the plain claim. The subject is already the card's title.
  const subj = clean(g.subject).toLowerCase();
  const score = (q) => (g.scan.claims.includes(q) ? 1 : 0) + (g.scan.outcome.includes(q) ? 2 : 0);
  const quotes = [...new Set([...g.scan.claims, ...g.scan.outcome])]
    .filter((q) => clean(q).toLowerCase() !== subj)
    .sort((a, b) => score(b) - score(a))
    .slice(0, SETTINGS.MAX_QUOTES_PER_MESSAGE);
  const staff = Object.entries(g.byOwner).sort((a, b) => b[1] - a[1]);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid ${bg};border-left:4px solid ${fg};border-radius:6px"><tr><td style="padding:13px 15px">
  <div style="${FONT};font-size:10.5px;font-weight:bold;color:${fg};text-transform:uppercase;letter-spacing:.04em">${label} · ${esc(g.scan.about)}${g.source === "template" ? " · TEMPLATE" : ""}</div>
  <div style="${FONT};font-size:15px;font-weight:bold;color:${C.ink};margin-top:4px">${esc(g.subject || "(no subject)")}</div>
  <div style="${FONT};font-size:12px;color:${C.soft};margin-top:3px">${g.source === "template"
    ? `Template · created ${day(g.created)}${g.updated && g.updated !== g.created ? ` · updated ${day(g.updated)}` : ""} · owner ${esc(g.ownerName || "unknown")}`
    : `<b style="color:${C.ink}">${num(g.count)}</b> email${g.count === 1 ? "" : "s"} sent · ${day(g.first)}${g.last !== g.first ? ` to ${day(g.last)}` : ""}`}</div>
  ${quotes.map((q) => `<div style="${FONT};font-size:12.5px;line-height:1.6;color:${C.body};margin-top:8px;padding:8px 11px;background:${C.panel};border-radius:5px">“${highlight(q, esc)}”</div>`).join("")}
  ${g.scan.outcome.length ? `<div style="${FONT};font-size:12px;color:${C.bad};margin-top:8px"><b>Implies a better result.</b> Consultants should never promise better approval chances, whatever the affiliation.</div>` : ""}
  ${staff.length ? `<div style="${FONT};font-size:12px;color:${C.soft};margin-top:8px">Sent by: ${staff.slice(0, 8).map(([n, c]) => `${esc(n)} (${num(c)})`).join(", ")}${staff.length > 8 ? ` and ${staff.length - 8} more` : ""}</div>` : ""}
  </td></tr></table>`;
}

function buildEmail(R) {
  const flagged = R.groups.filter((g) => g.level === "high" || g.level === "claim");
  const sent = flagged.filter((g) => g.source === "email").reduce((t, g) => t + g.count, 0);
  const people = new Set(flagged.flatMap((g) => Object.keys(g.byOwner)));
  const mentions = R.groups.filter((g) => g.level === "mention");
  const banner = flagged.length
    ? { bg: C.badbg, fg: C.bad, t: `<b>${num(flagged.length)} message${flagged.length === 1 ? "" : "s"}</b> claim HOF has or works with an attorney or a former USCIS officer — sent <b>${num(sent)}</b> times by <b>${num(people.size)}</b> staff since ${day(R.from)}.` }
    : { bg: C.goodbg, fg: C.good, t: `<b>No claims found.</b> No template or sent email since ${day(R.from)} says HOF has or works with an attorney or a former USCIS officer.` };

  const cons = R.byConsultant.slice(0, 15).map((c) => `<tr><td ${TD}>${esc(c.name)}</td><td align="right" ${TD}><b>${num(c.emails)}</b></td><td align="right" ${TD}>${num(c.messages)}</td><td ${TD}>${esc(c.last)}</td></tr>`).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 8px"><tr><td align="center">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:680px;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background-color:${C.navy};background-image:linear-gradient(120deg,${C.navy},${C.royal});padding:22px 24px">
<div style="${FONT};font-size:20px;font-weight:bold;color:#fff">Attorney & USCIS claims</div>
<div style="${FONT};font-size:12.5px;color:#aab0d4;margin-top:5px">Templates and sent emails, ${day(R.from)} to ${day(R.to)}</div></td></tr>
<tr><td style="padding:20px 24px">
<table role="presentation" width="100%" style="margin:0 0 14px"><tr><td style="background:${banner.bg};border-left:4px solid ${banner.fg};padding:12px 15px;${FONT};font-size:14px;line-height:1.6;color:${banner.fg}">${banner.t}</td></tr></table>

${!R.templates.ok ? `<table role="presentation" width="100%" style="margin:0 0 14px"><tr><td style="background:${C.warnbg};border-left:4px solid ${C.warn};padding:11px 14px;${FONT};font-size:12.5px;line-height:1.6;color:${C.warn}"><b>Templates could not be read</b>${R.templates.status ? ` (HubSpot said ${R.templates.status})` : ""}. Sent emails were still checked in full. To include templates, add the <b>automation.email_templates.read</b> scope to the private app. HubSpot notes this API may need a user-level app rather than a private app, so it may stay closed — the sent emails are what reached clients either way.</td></tr></table>` : ""}

${flagged.length ? `<div style="${FONT};font-size:15px;font-weight:bold;color:${C.navy};margin:18px 0 10px">What was claimed, most sent first</div>${flagged.map(card).join("")}` : ""}

${cons ? `<div style="${FONT};font-size:15px;font-weight:bold;color:${C.navy};margin:22px 0 8px">By sender</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-collapse:collapse"><tr><td ${TH}>Staff</td><td align="right" ${TH}>Emails with a claim</td><td align="right" ${TH}>Different messages</td><td ${TH}>Last sent</td></tr>${cons}</table>` : ""}

${mentions.length ? `<div style="${FONT};font-size:12.5px;color:${C.soft};margin-top:18px">${num(mentions.length)} other message${mentions.length === 1 ? "" : "s"} mention attorneys or USCIS officers without claiming HOF has them — listed in the CSV attached.</div>` : ""}

<div style="${FONT};font-size:12px;color:${C.body};margin-top:20px;padding-top:14px;border-top:1px solid ${C.line};line-height:1.65">
<b>What this does and doesn't decide.</b> It shows what was said, how often and by whom. It doesn't decide whether an affiliation is real or approved — that's for a person to check.
An <b>affiliation claim</b> says HOF has, or works with, an attorney or a former USCIS officer. <b>Outcome wording</b> — "firmer route to approval", "insider perspective", "every case" — implies better approval chances, which consultants should never promise, whatever the affiliation.
Searched: ${R.searches.map(esc).join(", ")}. Templates: ${R.templates.ok ? `${num(R.templates.list.length)} read` : "not readable"}. Sent emails checked: ${num(R.emailsChecked)}.
</div></td></tr>
<tr><td style="background:${C.panel};border-top:1px solid ${C.line};padding:14px 24px;${FONT};font-size:11.5px;color:${C.soft}"><b style="color:${C.body}">Ali Raza</b> · Compliance · HOF Migration<br>Read-only. Nothing in HubSpot was changed.</td></tr>
</table></td></tr></table>`;
}

function buildCsv(R) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Level", "About", "Source", "Subject", "Emails sent", "First", "Last", "Sent by", "Claim", "Outcome wording"];
  return "\uFEFF" + [head.map(q).join(",")].concat(R.groups.map((g) => [
    g.level, g.scan.about, g.source, g.subject, g.count, day(g.first), day(g.last),
    Object.entries(g.byOwner).map(([n, c]) => `${n} (${c})`).join("; "), g.scan.claims[0] || "", g.scan.outcome[0] || "",
  ].map(q).join(","))).join("\r\n");
}

async function sendEmail(subject, html, csvName, csv) {
  if (!process.env.RESEND_KEY) { console.log("!! No RESEND_KEY — not emailed."); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SETTINGS.FROM_EMAIL, to: [SETTINGS.REPORT_TO], subject, html,
      attachments: [{ filename: csvName, content: Buffer.from(csv, "utf8").toString("base64") }] }),
  });
  if (!res.ok) { console.log(`Email failed: ${res.status} ${(await res.text()).slice(0, 200)}`); return false; }
  return true;
}

module.exports = { buildEmail, buildCsv, sendEmail };
