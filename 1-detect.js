// 1-detect.js — what each email or template actually claims. Plain code, no network,
// so every judgement can be tested against the real wording found in HubSpot.
const { SETTINGS } = require("./config");

const clean = (s) => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// sentences, from the new part of the message only — a quoted reply is someone else's words
function sentences(text) {
  const t = clean(String(text || "").split(/\n\s*On .{5,120}wrote:|\n-{2,}\s*Original Message/i)[0]);
  return t.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“])/).map((s) => s.trim()).filter((s) => s.length > 3);
}

// one sentence: does it name an attorney or USCIS officer, and if so what does it claim?
function judge(sentence, subject = "") {
  if (!SETTINGS.WHO.test(sentence)) return null;
  if (SETTINGS.NEUTRAL.test(sentence)) return { kind: "neutral", sentence };
  const affiliation = SETTINGS.AFFILIATION.test(sentence) || (SETTINGS.AFFILIATION.test(subject) && SETTINGS.WHO.test(subject));
  return { kind: affiliation ? "affiliation" : "mention", sentence };
}

// a whole message: its claims, and any outcome wording anywhere in it
function scan(subject, body) {
  const sents = sentences(body);
  const subj = clean(subject);
  const found = [];
  const subjJ = judge(subj, subj);
  if (subjJ) found.push({ ...subjJ, inSubject: true });
  for (const s of sents) { const j = judge(s, subj); if (j) found.push(j); }
  if (!found.length) return null;

  const claims = found.filter((f) => f.kind === "affiliation");
  const mentionsOnly = !claims.length;
  // outcome wording only matters in a message that talks about these people
  const outcome = sents.filter((s) => SETTINGS.OUTCOME.test(s)).concat(SETTINGS.OUTCOME.test(subj) ? [subj] : []);
  const usciss = found.some((f) => /uscis|immigration officer|consular|visa officer/i.test(f.sentence));
  const attorneys = found.some((f) => /attorney|lawyer|law firm|legal|esq|ll\.?m/i.test(f.sentence));

  return {
    level: claims.length ? (outcome.length ? "high" : "claim") : found.every((f) => f.kind === "neutral") ? "neutral" : "mention",
    about: [attorneys && "Attorney", usciss && "Ex-USCIS officer"].filter(Boolean).join(" & ") || "Attorney",
    claims: claims.map((c) => c.sentence),
    outcome: [...new Set(outcome)],
    mentionsOnly,
  };
}

// The same message sent to many people should be read as one: names and greetings are
// stripped, so a bulk send groups together however many clients it went to.
function fingerprint(subject, body) {
  const subj = clean(subject).toLowerCase().replace(/^(re|fwd?|fw):\s*/g, "").replace(/\s+/g, " ").trim();
  const core = clean(body).toLowerCase()
    .replace(/^(dear|hi|hello|assalam[\w\s]*?)\s+[^,\n]{1,60},/i, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return `${subj}|${core}`;
}

// the risky words, highlighted, for the report
function highlight(sentence, esc) {
  let s = esc(sentence);
  for (const re of [SETTINGS.OUTCOME, SETTINGS.AFFILIATION, SETTINGS.WHO]) {
    s = s.replace(new RegExp(re.source, "gi"), (m) => `<b>${m}</b>`);
  }
  return s;
}

module.exports = { scan, judge, sentences, fingerprint, highlight, clean };
