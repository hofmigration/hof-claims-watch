// config.js — Attorney & USCIS claims watch. SAFE TO EDIT.
//
// Finds every email template and sent email that talks about attorneys, lawyers or
// former USCIS officers, and separates three things:
//   AFFILIATION  HOF claims to have, or work with, an attorney or ex-USCIS officer
//   OUTCOME      wording that implies better approval chances because of it
//   NEUTRAL      a mention that claims nothing — "a USCIS officer will review your file"
//
// It does not decide whether an affiliation is real or approved. It shows exactly what
// was said, how often, by whom, and since when — so that a person can decide.

const SETTINGS = {
  MONTHS_BACK: Number(process.env.MONTHS_BACK || 3),

  // what to search HubSpot for. Each runs as a full-text search over sent emails.
  SEARCHES: ["attorney", "attorneys", "lawyer", "lawyers", "law firm", "USCIS officer", "ex USCIS", "former USCIS",
             "retired USCIS", "immigration officer", "advisory panel", "legal team", "legal scrutiny", "licensed attorney"],

  // ---- how a sentence is judged ----
  // who: an attorney, a lawyer, or an (ex-)USCIS / immigration officer
  WHO: /\b(attorneys?|lawyers?|law firm|legal (?:counsel|team|expert(?:ise)?|scrutiny)|esq\.?|ll\.?m|(?:ex|former|retired)[\s-]*uscis|uscis officers?|immigration officers?|consular officers?|visa officers?)\b/i,
  // the claim that HOF has or works with them
  AFFILIATION: /\b(join(?:ed|s)?|on ?board|welcom(?:e|ed)|our (?:team|panel|attorneys?|lawyers?|legal)|advisory panel|panel of|in[\s-]?house|affiliat(?:ion|ed)|partner(?:ed|ship)?|hof(?: migration)?(?:'s)? (?:attorney|lawyer|legal)|with hof|has (?:an? )?(?:attorney|lawyer))\b/i,
  // wording that implies a better result because of them
  OUTCOME: /\b(route to approval|firmer|higher (?:chance|success|approval)|increas\w* (?:your )?chances?|approval rate|guarantee\w*|insider|every case|safeguard\w* your|assured|certain(?:ty)? of|success rate|strengthen\w* (?:your|the) (?:case|petition|chances?))\b/i,
  // a mention that clearly claims nothing
  NEUTRAL: /\b(not a law firm|not lawyers?|do(?:es)? not (?:provide|offer|give) legal|consult (?:your own |an? )?(?:attorney|lawyer)|independent (?:attorney|lawyer)|uscis officer (?:will|may|can) (?:review|assess|ask))\b/i,

  // ---- the report ----
  REPORT_TO: process.env.REPORT_TO || "razaali@hofmigration.com",
  FROM_EMAIL: process.env.FROM_EMAIL || "onboarding@resend.dev",
  SEND_EMAIL: String(process.env.SEND_EMAIL || "true").toLowerCase() !== "false",
  OUT_DIR: "out",
  PORTAL_ID: "23735726",
  HUBSPOT_RPS: 4,
  MAX_QUOTES_PER_MESSAGE: 3,
  TZ_OFFSET_HOURS: 5,
};

module.exports = { SETTINGS };
