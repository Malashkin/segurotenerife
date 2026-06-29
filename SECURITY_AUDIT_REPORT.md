# 🛡 Security Audit Report — Seguro Tenerife

**Auditor:** Black Ranger · **Date:** 2026-06-26 · **Scope:** full stack (Rust/axum backend, Astro/React frontend, Cloudflare Pages worker, Claude RAG agent, Telegram, PostHog) · **Confidential.**

## Severity summary

| Severity | Count | Items |
|---|---|---|
| 🔴 CRITICAL | 0 | — |
| 🟠 HIGH | 1 | H1 (live secrets exposed in chat → rotate) |
| 🟡 MEDIUM | 3 | M1 (rate-limit bypass via spoofed proxy IP / cost-DoS), M2 (no anti-automation on public writes), M3 (weak manager password + no login throttle) |
| 🔵 LOW | 4 | L1 (insecure-default env flags), L2 (chat prompt injection), L3 (esbuild dev advisory), L4 (IP stored without per-event consent) |
| ⚪ INFO | 3 | I1 (JSON-LD `</script>` escaping), I2 (in-memory limiter scaling), I3 (non-revocable refresh) |

**Security score: 7.5 / 10** — strong foundation (parameterized SQL throughout, argon2 + typ-separated HS256 JWT, httpOnly+Strict+Secure refresh cookie, spec-compliant CORS, body limit, error masking, Telegram HTML escaping, no committed secrets, no user-data XSS sink). Gaps are abuse-resistance and operational hygiene, not memory/injection/authz holes.

---

## ✅ Fixes applied 2026-06-26 (code) — verified: cargo build + 42 tests + clippy; FE typecheck + 19 tests + build + 3 e2e

| ID | Fix | Status |
|---|---|---|
| M1 | Origin-gate middleware (`origin.rs`): with `ORIGIN_SHARED_SECRET` set, all requests except `/health` must carry `X-Origin-Auth` (constant-time compared) → origin unreachable bypassing Cloudflare, killing `CF-Connecting-IP` spoofing. | ✅ code in place — **needs env + CF rule to activate (see below)** |
| M2 | Dedicated `write_limiter` (10/min) on `POST /api/handoff` (Telegram-flood path); `events.meta` capped at 4 KB. | ✅ done (Turnstile still recommended for full coverage) |
| M3 | Dedicated `login_limiter` (5/min) on `POST /api/auth/login`. | ✅ done (strong password = your action) |
| L1 | Fail-closed prod: `APP_ENV=production` now **rejects `ALLOWED_ORIGINS=*`** at boot, defaults `cookie_secure=true`, and warns if `ORIGIN_SHARED_SECRET` missing. | ✅ done |
| L2 | Prompt-injection guard already present in `SYSTEM_INSTRUCTIONS` (line 59). | ✅ already covered |
| L4 | `anonymize_ip()` (IPv4→/24, IPv6→/48) applied before storing IP in `leads` + `events`. | ✅ done |
| I1 | JSON-LD `set:html` now escapes `<` → `<` (no `</script>` breakout). | ✅ done |
| L3 | esbuild bump → **reverted**: 0.28.x errors on destructuring lowering to the legacy browser targets and breaks the prod build. Advisory is **dev-server-only, not in the shipped bundle**. Revisit on next Vite/Astro upgrade. | ⏸ deferred (non-breaking choice) |
| H1 | Secret rotation — **cannot be done in code**, see below. | ⛔ your action |

### ⚠️ Required ops actions to activate / finish
1. **Rotate (H1):** Telegram bot token (`@BotFather /revoke`), PostHog personal `phx_` key, Cloudflare token. Update Railway env.
2. **Activate M1:** set `ORIGIN_SHARED_SECRET=<random>` on Railway **and** add a Cloudflare Transform Rule (Modify Request Header → set `X-Origin-Auth: <same value>`). Until both are set, the gate is a no-op (dev-safe).
3. **Activate L1 hardening:** set `APP_ENV=production` **and** `ALLOWED_ORIGINS=https://segurotenerife.com,https://admin.segurotenerife.com` on Railway **together** — with `APP_ENV=production` the service now **refuses to boot** if `ALLOWED_ORIGINS` is still `*` (intended fail-closed). Also keep `COOKIE_SECURE=true`.
4. **M3:** replace the manager password with a long random passphrase (regen hash via `cargo run --bin hash_password`), update `MANAGER_PASSWORD_HASH`.
5. **M2 (optional, full):** add Cloudflare Turnstile to the chat handoff form (needs your Turnstile site/secret keys).

---

## 🟠 HIGH

### H1 — Live secrets exposed in plaintext outside the repo
**Where:** this engineering session (not the repo — repo verified clean: `git grep` for the Telegram token, JWT secret, `phx_…{20,}`, `cfat_`, `cfut_`, password all return nothing; `.env`/`.env.*` are gitignored).
**Exposed:** PostHog **personal** API key `phx_…` (full project read), Telegram **bot token** `8774403482:AAF…` (send-as-bot / intercept lead cards), Cloudflare API token `cfat_…` (DNS/zone read).
**Impact:** anyone with access to the transcript can read your PostHog project, hijack the lead-delivery bot, and enumerate DNS. Confidentiality + Integrity.
**Likelihood:** depends on transcript access — treat as compromised.
**Remediation (do now):**
1. Rotate the **Telegram bot token** (`@BotFather → /revoke`) → update `TELEGRAM_BOT_TOKEN` on Railway.
2. Rotate the **PostHog personal API key** (Settings → Personal API keys → delete + recreate). The public `phc_…` project key is fine (it's client-side by design).
3. Roll the **Cloudflare token** (My Profile → API Tokens → Roll).
4. Confirm the manager password hash / `JWT_SECRET` were never echoed; if unsure, rotate (`hash_password` bin + new `JWT_SECRET`) — this also invalidates any leaked tokens.

---

## 🟡 MEDIUM

### M1 — Rate-limit bypass via spoofable `CF-Connecting-IP` → cost-DoS on the paid LLM endpoint
**Where:** `backend/src/rate_limit.rs:90` (`client_ip`), `backend/src/config.rs:93` (`trust_proxy_headers`).
**Issue:** in prod `trust_proxy_headers=true`, and `client_ip` trusts the client-supplied `CF-Connecting-IP` (then leftmost `X-Forwarded-For`) **unconditionally**, without verifying the request actually arrived through Cloudflare. Railway exposes a default public origin (`*.up.railway.app`) that bypasses the Cloudflare proxy.
**PoC (non-destructive, illustrative):**
```
# Hitting the direct origin with a rotating spoofed IP → every request looks like a "new IP",
# so the per-IP bucket never fills and the 8/min chat limit is defeated:
for i in $(seq 1 100); do
  curl -s https://<railway-origin>/api/chat \
    -H "CF-Connecting-IP: 1.2.3.$((i%255))" \
    -H 'content-type: application/json' \
    -d '{"question":"hola"}' >/dev/null
done
```
**Impact:** each `/api/chat` is a paid Claude call — unbounded spoofing turns the 8/min cap into unlimited → **financial DoS** (Anthropic bill) + amplifies M2 (lead/event spam). Availability + cost. Per-request cost is bounded (question ≤1000 chars, history ≤12×2000), so the damage is volume-driven, not per-request.
**Compensating control:** attacker must discover the direct origin URL (cert-transparency / subdomain enum makes this easy).
**Remediation (defense in depth):**
1. Lock the origin to Cloudflare: verify a secret header injected by a CF Transform Rule (e.g. `X-Origin-Auth: <random>`), reject requests without it; or use Cloudflare Tunnel / Railway private networking so the origin isn't directly reachable.
2. Only trust `CF-Connecting-IP` when the socket peer is in [Cloudflare's published IP ranges](https://www.cloudflare.com/ips/).
3. Add a global cost ceiling for `/api/chat` (total calls/hour across all IPs) as a backstop.

### M2 — No bot/abuse protection on public write endpoints
**Where:** `POST /api/handoff` (`handoff.rs`), `POST /api/leads` (`leads.rs:38`), `POST /api/events` (`events.rs`).
**Issue:** all three are unauthenticated by design and protected only by the per-IP limiter (60/min). No CAPTCHA / proof-of-work / honeypot. Even without spoofing, one IP can create ~86k leads/day — each `handoff` also fires a Telegram card to the manager.
**Impact:** fake-lead flood pollutes the admin/DB and spams the manager's Telegram (risking Telegram bot throttling). Integrity + Availability of the lead pipeline.
**Remediation:** add Cloudflare Turnstile (invisible CAPTCHA) on the handoff/lead submit; debounce Telegram delivery; consider a short server-side cooldown per session_id; cap `events.meta` size.

### M3 — Weak manager password + no dedicated login throttle/lockout
**Where:** `backend/src/routes/auth.rs:147` (`login`); password `Seguro_first-try`.
**Issue:** single-factor, human-memorable password; login is covered only by the generic 60/min/IP limiter (no per-account lockout, no exponential backoff). argon2 slows guessing, but IP rotation (see M1) makes online guessing feasible. A single password = single point of full admin/PII access.
**Impact:** admin compromise → read all leads (names, messengers, languages, IP/UA). Confidentiality.
**Remediation:** replace with a long random passphrase (store only the argon2 hash, already done); add a dedicated login limiter (e.g. 5/min/IP + global) and temporary lockout; consider TOTP 2FA for the single manager.

---

## 🔵 LOW

### L1 — Insecure-by-default env flags
`config.rs`: `COOKIE_SECURE` defaults `false`, `ALLOWED_ORIGINS` defaults `*` (→ `AllowOrigin::any()`, no credentials). Safe **only if** prod sets `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://…`. Recommend fail-closed: assert these are set when a prod marker (e.g. `APP_ENV=production`) is present, or default `cookie_secure=true`. *(CORS itself is correctly spec-compliant — `main.rs:98` drops credentials for `*` and only enables them for an explicit whitelist.)*

### L2 — Prompt injection in the chat agent
`chat.rs`: user `question`/`history` are placed as user turns; a crafted message can attempt to override `SYSTEM_INSTRUCTIONS`. **Impact is bounded:** no tool/function calling, no secrets in the system prompt, `strip_brand` post-gate removes insurer-brand leaks (`chat.rs:228`), and `stop_reason=refusal` is handled. Worst case is off-topic/embarrassing output or disclosure of the (non-secret) instructions. Keep the brand gate; add a lightweight topical/output check and log `leaked=true` events for monitoring.

### L3 — esbuild dev-server advisory (GHSA-67mh-4wv8-2f99)
`pnpm audit` → 1 LOW: `esbuild >=0.27.3 <0.28.1` (dev server responds to any origin). **Dev-tooling only — not in the production bundle.** Bump Vite/Astro to pull esbuild ≥0.28.1.

### L4 — Client IP stored for funnel events without per-event consent
`events.rs:53` and `leads.rs:56` persist client IP (events also without a consent flag, unlike leads). Under GDPR, document the lawful basis + retention, or truncate/anonymize the IP (e.g. zero the last octet) for analytics rows.

---

## ⚪ INFO / Hardening

- **I1 — JSON-LD `set:html`** (`Layout.astro:157`): `JSON.stringify(jsonld)` is injected into a `<script>` from team-authored content (FAQ dict, article frontmatter — no user input), so not exploitable today, but a stray `</script>` in an article title would break out. Harden by escaping `<` → `<` before injection.
- **I2 — In-memory per-instance rate limiter** (`rate_limit.rs`): with >1 Railway instance the effective limit multiplies. Move to Redis when scaling horizontally (already noted in code).
- **I3 — Non-revocable refresh tokens** (`auth.rs:18`): a stolen refresh JWT is valid until `exp` (7d) — no server-side revocation. Acceptable for a single manager; revisit (refresh-token table) if roles/users grow.

---

## OWASP Top 10 (2021) coverage

| ID | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | ✅ | `GET /api/leads` gated by `verify_access`; refresh via httpOnly+Strict cookie; CSRF mitigated by SameSite=Strict |
| A02 | Cryptographic Failures | 🟡 | argon2 + HS256 good; `cookie_secure` default-off (L1); ensure strong `JWT_SECRET` (≥32 random bytes) |
| A03 | Injection | ✅ | All SQL parameterized (`bind`); Telegram HTML-escaped; no user-data XSS sink; LLM injection bounded (L2) |
| A04 | Insecure Design | 🟡 | No anti-automation on public writes (M2); weak single password (M3) |
| A05 | Security Misconfiguration | 🟡 | Insecure-default env flags (L1); body limit + error masking in place |
| A06 | Vulnerable Components | 🔵 | 1 LOW dev-only (esbuild, L3); Rust crates current (`rsa` Marvin advisory transitive + unreachable on Postgres) |
| A07 | Auth Failures | 🟡 | No login lockout/throttle (M3); IP rate-limit spoofable (M1) |
| A08 | Integrity Failures | ✅ | Migrations from repo; no untrusted deserialization |
| A09 | Logging/Monitoring | ✅ | Structured JSON tracing; brand-leak warnings; Langfuse traces |
| A10 | SSRF | ✅ | CF worker proxies to **hardcoded** PostHog hosts only — no host injection; backend calls only `api.anthropic.com`/Telegram |

## LLM security assessment

| Check | Result |
|---|---|
| System prompt contains secrets | ✅ No |
| Tool / function calling exposed | ✅ None (no escalation surface) |
| Output gate (brand neutrality) | ✅ `strip_brand` post-filter |
| Refusal handling | ✅ `stop_reason=refusal` → soft handoff |
| Input bounded (cost) | ✅ question ≤1000, history ≤12×2000, body ≤1MB |
| Prompt injection possible | 🔵 Yes, but bounded impact (L2) |
| API key exposure | ✅ Server-side `x-api-key` only |

---

## Remediation priority

| # | Action | Severity | Effort |
|---|---|---|---|
| 1 | Rotate Telegram bot token, PostHog personal key, Cloudflare token | 🟠 HIGH | 15 min |
| 2 | Lock origin to Cloudflare (secret header) + IP-range-gate `CF-Connecting-IP` | 🟡 MED | 1–2 h |
| 3 | Turnstile on handoff/lead submit + Telegram debounce | 🟡 MED | 2–3 h |
| 4 | Strong random manager password + dedicated login throttle/lockout | 🟡 MED | 1 h |
| 5 | Fail-closed `COOKIE_SECURE`/`ALLOWED_ORIGINS` in prod | 🔵 LOW | 30 min |
| 6 | Bump esbuild ≥0.28.1; anonymize stored IPs; escape JSON-LD `<` | 🔵 LOW/INFO | 1 h |

**Re-audit after fixes 1–4.**
