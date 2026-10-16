// selftest.js — every judgement, against the real wording found in HubSpot.
const D = require("./1-detect");
const { build } = require("./watch");
const { buildEmail, buildCsv } = require("./2-report");

let pass = 0, fail = 0;
const check = (l, ok, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${l}${ok || !d ? "" : `\n        ${d}`}`); ok ? pass++ : fail++; };
console.log("ATTORNEY & USCIS CLAIMS — SELF-TEST\n");

// ---- the real messages ----
const BULK_SUBJ = "A U.S. Federal Immigration Attorney has joined our advisory panel";
const BULK = (name) => `Dear ${name}, \n\nI have some news I'm genuinely pleased to share. HOF Migration has welcomed Marilia Baltar, a U.S. Federal Immigration Attorney, to our Advisory Panel! \n\nMarilia is licensed in California and Brazil and holds an LL.M. from the USC Gould School of Law. She has represented hundreds of clients across the full range of U.S. pathways. \n\nWhy does this matter for you? With Marilia now part of our panel of seasoned immigration professionals and licensed attorneys, every case we handle benefits from closer legal scrutiny, sharper strategy, and a firmer route to approval. In a process where your petition is reviewed only once and every word carries weight, having true legal expertise behind your file is precisely what safeguards your investment.`;
const BRAY_SUBJ = "Ex-USCIS Officer Mr. Robert Bray on board";
const BRAY = "Dear Hibat, \n\nGreetings! We're pleased to share an exciting milestone at HOF Migration. Mr. Robert Bray, a retired USCIS officer, has joined our team. With 10+ years of experience with USCIS, Robert brings valuable insider perspective into how immigration cases are reviewed, assessed, and evaluated within the system.";
const OWN_SUBJ = "HOF Migration Attorney for US EB2NIW & Ex USCIS Officer";
const OWN = "Dear Atta, Our valued client has officially received USCIS approval for the EB2-NIW Visa. These are links to check the affiliation with HOF Migration for US Attorney & EX USCIS Officer.";

const b = D.scan(BULK_SUBJ, BULK("Ross"));
check("the advisory-panel email is an affiliation claim", b && b.claims.length > 0);
check("…with outcome wording ('firmer route to approval')", b.outcome.some((o) => /firmer route to approval/i.test(o)));
check("…so it is the highest level", b.level === "high");
const r = D.scan(BRAY_SUBJ, BRAY);
check("the Robert Bray email is an affiliation claim about an ex-USCIS officer", r.level !== "mention" && /Ex-USCIS/.test(r.about));
check("'insider perspective' is caught as outcome wording", r.outcome.some((o) => /insider/i.test(o)));
const o = D.scan(OWN_SUBJ, OWN);
check("'HOF Migration Attorney' in a subject is an affiliation claim", o.claims.length > 0 && /Attorney/.test(o.about) && /USCIS/.test(o.about));

// ---- what must NOT be flagged ----
check("'a USCIS officer will review your petition' claims nothing", D.scan("Update", "Dear Ali, a USCIS officer will review your petition once it is filed.").level === "neutral");
check("'we are not a law firm' claims nothing", D.scan("Note", "Please note we are not a law firm and do not provide legal advice.").level === "neutral");
check("'consult your own attorney' claims nothing", D.scan("Note", "You may wish to consult your own attorney before signing.").level === "neutral");
check("an email that never mentions attorneys or USCIS is skipped", D.scan("Hello", "Your ECA has been submitted.") === null);
check("a reply's quoted thread is not read as the sender's words", D.scan("Re: hi", "Thanks, received.\nOn Mon, 5 Oct 2026, HOF wrote:\n> Robert Bray, a retired USCIS officer, has joined our team.") === null);

// ---- grouping ----
const em = (id, subj, body, owner, t) => [String(id), { id, properties: { hs_email_subject: subj, hs_email_text: body, hubspot_owner_id: owner, hs_timestamp: t } }];
const emails = new Map([
  em(1, BULK_SUBJ, BULK("Ross Trajano"), "93601358", "2026-09-24T14:18:29Z"),
  em(2, BULK_SUBJ, BULK("Maria Janette Velasquez"), "93601358", "2026-09-24T14:18:31Z"),
  em(3, BULK_SUBJ, BULK("Jason Sheperd"), "85714760", "2026-10-15T14:43:36Z"),
  em(4, BRAY_SUBJ, BRAY, "93415418", "2026-10-07T07:26:18Z"),
  em(5, "Update", "Dear Ali, a USCIS officer will review your petition once it is filed.", "1", "2026-10-01T10:00:00Z"),
]);
const owners = { "93601358": "Anne Mariele De Guzman", "85714760": "Staff B", "93415418": "Sneha Nair" };
const from = Date.parse("2026-07-15T00:00:00Z"), to = Date.parse("2026-10-15T23:00:00Z");
const R = build(emails, { ok: false, status: 403, list: [] }, owners, from, to);
const bulk = R.groups.find((g) => g.subject === BULK_SUBJ);
check("one bulk message sent to three clients is one group", bulk && bulk.count === 3);
check("the group knows when it was first and last sent", bulk.first === Date.parse("2026-09-24T14:18:29Z") && bulk.last === Date.parse("2026-10-15T14:43:36Z"));
check("the group counts each sender", bulk.byOwner["Anne Mariele De Guzman"] === 2 && bulk.byOwner["Staff B"] === 1);
check("a neutral email is left out", !R.groups.some((g) => g.subject === "Update"));
check("the highest-risk messages come first", R.groups[0].level === "high");
check("senders are ranked by emails with a claim", R.byConsultant[0].name === "Anne Mariele De Guzman" && R.byConsultant[0].emails === 2);

// ---- templates ----
const T = build(new Map(), { ok: true, list: [{ id: "77", name: "Attorney announcement", subject: BULK_SUBJ, body: BULK("{{contact.firstname}}"), ownerId: "93601358", createdAt: Date.parse("2026-09-20T00:00:00Z"), updatedAt: Date.parse("2026-09-21T00:00:00Z") }] }, owners, from, to);
check("a template with the claim is caught", T.groups.length === 1 && T.groups[0].source === "template" && T.groups[0].level === "high");
check("a template knows who owns it", T.groups[0].ownerName === "Anne Mariele De Guzman");

// ---- the email ----
const html = buildEmail(R);
check("the email leads with how many messages and sends", /claim HOF has or works with an attorney/.test(html) && /<b>4<\/b>/.test(html));
check("the email quotes the claim, with the risky words in bold", /<b>firmer<\/b>|<b>route to approval<\/b>/.test(html));
check("the email says templates couldn't be read, and how to fix it", /Templates could not be read/.test(html) && /automation\.email_templates\.read/.test(html));
check("the email names the senders", /Anne Mariele De Guzman/.test(html) && /Sneha Nair/.test(html));
check("the email says it doesn't decide whether an affiliation is real", /doesn't decide whether an affiliation is real/.test(html));
check("the email stays far under Gmail's clipping limit", Buffer.byteLength(html) < 95 * 1024);
check("the email escapes text", !/<script/i.test(html));
const csv = buildCsv(R);
check("the CSV lists every group", csv.split("\r\n").length === R.groups.length + 1);
check("a clean result says so plainly", /No claims found/.test(buildEmail(build(new Map(), { ok: true, list: [] }, {}, from, to))));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
