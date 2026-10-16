# Attorney & USCIS claims watch

Finds every **email template** and **sent email** that talks about attorneys, lawyers or
former USCIS officers, and shows which of them **claim HOF has or works with one** — what
was said, how many times it went out, who sent it, and since when.

Read-only. Nothing in HubSpot is changed.

---

## Why it checks sent emails, not only templates

A template is only a risk once someone sends it, and a consultant can write the same claim
by hand without one. So every sent email is checked as well. HubSpot's template API also
needs a permission your current token may not be allowed — see below — so sent emails are
the part that always works.

When it was built, on 15 October 2026, sent emails showed three messages:

| Message | Since | Sent |
|---|---|---|
| *A U.S. Federal Immigration Attorney has joined our advisory panel* | 24 Sep | about 4,000 |
| *HOF Migration Attorney for US EB2NIW & Ex USCIS Officer* | 26 Sep | written by hand |
| *Ex-USCIS Officer Mr. Robert Bray on board* | 7 Oct | written by hand |

## Three levels

| Level | Means |
|---|---|
| **Affiliation + outcome claim** | says HOF has or works with them, **and** implies better approval chances — "a firmer route to approval", "insider perspective", "every case we handle" |
| **Affiliation claim** | says HOF has or works with an attorney or former USCIS officer |
| **Mention only** | names one without claiming HOF has them — listed in the CSV, not the email |

Not flagged at all: "a USCIS officer will review your petition", "we are not a law firm",
"consult your own attorney".

**It doesn't decide whether an affiliation is real or approved.** That's for a person. What
it does make plain is wording that goes beyond the affiliation — outcome promises are a
problem whatever the affiliation.

---

## Setting it up

New private repo, e.g. `hof-claims-watch`. Files in the root, `claims-watch.yml` in
`.github/workflows/`. Secrets: `HUBSPOT_TOKEN` and `RESEND_KEY`. No packages to install.

It runs every **Monday at 9 AM**, looking back 3 months, so a new claim is caught within a
week. Run it any time from **Actions → Attorney and USCIS claims → Run workflow**.

## Templates

To include templates, add the scope **`automation.email_templates.read`** to the HOF
private app (Settings → Integrations → Private Apps → Scopes).

HubSpot notes that this API needs *user-level* access and may refuse a private app even with
the scope added. If so, the email says so plainly at the top, and everything else still runs.
Templates are never quietly treated as clean.

## What the email shows

One card per distinct message — a bulk send to 4,000 clients is one card, not 4,000 — with
the most serious sentences quoted and the risky words in bold, how many times it was sent,
the first and last date, and who sent it. Then a table of senders. Everything, including
mentions, is in the attached CSV.

## Changing a rule

The patterns are in `config.js`, in plain words. `selftest.js` checks them against the real
wording found in HubSpot — `28 passed, 0 failed` — and runs before each check.
