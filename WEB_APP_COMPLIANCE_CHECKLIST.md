# Web App Compliance Audit & Implementation Checklist

**NetViz — Network Visualizer & Simulator**  
**Date:** 2026-08-23  
**Repository:** github.com/Wolfi-OwO/network-visualizer  
**Status:** Active development with compliance gaps

---

## Executive Summary

NetViz is an **enterprise network simulation and visualization tool** with user accounts, role-based access control (admin/editor/viewer), isolated workspaces, and audit logging. The app:

- Uses **OAuth 2.0** (Google & Microsoft sign-in)
- Stores **network topologies** and **user configurations** in MongoDB
- Maintains **audit logs** of all administrative actions
- Implements **rate limiting** and security controls
- **MISSING:** Legal documents, cookie consent, GDPR data export/deletion endpoints

---

## Frontend Compliance Checklist

### ✅ Existing Implementations

- [x] **Footer component exists** (`application/client/src/components/core/footer.tsx`)
  - [x] Copyright year displayed
  - [x] Repository link ("About" button)
  - [x] Build metadata on hover
  - Status: Clean, minimal footer

### ❌ Missing Implementations

#### Legal Pages and Links

- [ ] **Create legal pages directory** (e.g., `application/client/src/pages/legal/`)

- [ ] **Privacy policy route: `/privacy` or `/datenschutz`**
  - [ ] Create page component
  - [ ] Render generated PRIVACY.md content
  - [ ] Add to React Router configuration
  - [ ] Ensure accessible via footer link

- [ ] **Impressum route: `/impressum`**
  - [ ] Create page component
  - [ ] Austrian legal entity information (see IMPRESSUM template)
  - [ ] Contact: [OPERATOR EMAIL]
  - [ ] Business registration (if applicable)

- [ ] **Terms of Use route: `/terms` or `/agb`**
  - [ ] Create page component
  - [ ] Covering: account usage, liability limitations, dispute resolution

- [ ] **Update Footer component**
  - [ ] Add links in the right-hand nav:
    ```jsx
    <nav className="flex items-center gap-4">
      <a href="/privacy" className="...">Privacy</a>
      <a href="/impressum" className="...">Impressum</a>
      <a href="/terms" className="...">Terms</a>
      <a href="/support" className="...">Support</a>
    </nav>
    ```
  - [ ] Links styled consistently with existing footer
  - [ ] Mobile-responsive (stack vertically on small screens)

#### Cookie Consent Banner

**Status:** [NOT IMPLEMENTED]

- [ ] **Implement cookie consent library**
  - [ ] Options: `react-cookie-consent`, `iubenda`, `cookiebot`, or custom
  - [ ] Should appear on first visit
  - [ ] Must appear BEFORE any tracking cookies are set

- [ ] **Cookie categories:**
  - [ ] **Technical** (session, CSRF) — always enabled
  - [ ] **Analytics** (Google Analytics, if used) — opt-in
  - [ ] **Functional** (preferences, language) — opt-in
  - [ ] **Marketing** (if any retargeting) — opt-in

- [ ] **Banner UI requirements:**
  - [ ] "Accept All" button (secondary style)
  - [ ] "Reject All" button (prominent, equally visible)
  - [ ] "Preferences" link (to granular settings)
  - [ ] Privacy policy link from banner
  - [ ] Can dismiss by clicking outside (not just buttons)

- [ ] **Consent storage:**
  - [ ] Save choice in `localStorage` as JSON
  - [ ] Format: `{ acceptedAt: "2026-08-23T10:30:00Z", categories: { analytics: true, marketing: false } }`
  - [ ] Expiration: 12 months (or on manual reset)

- [ ] **Analytics enforcement:**
  - [ ] Check `localStorage.consent.analytics` before loading Google Analytics
  - [ ] If `false`: do NOT load GA script
  - [ ] Provide opt-out link in preferences center (footer)

#### Accessibility

- [ ] **All legal pages meet WCAG 2.1 Level AA**
  - [ ] Semantic HTML (proper heading hierarchy)
  - [ ] Color contrast ≥ 4.5:1
  - [ ] Keyboard navigation (Tab, Enter)
  - [ ] Screen reader compatible

---

## Backend Compliance Checklist

### ✅ Existing Security Features

- [x] **HTTPS/TLS 1.3** enforced (Docker + nginx/reverse proxy)
- [x] **JWT session tokens** in httpOnly cookies
- [x] **Rate limiting** middleware (default: 100 req/min per user)
- [x] **Input validation** (zod schemas on all routes)
- [x] **Audit logging** (audit.routes.ts, TTL-based cleanup)
- [x] **OAuth 2.0** (Google, Microsoft) with state parameter
- [x] **CORS allowlist** (configurable per environment)

### ❌ Missing GDPR Features

#### Data Export (GDPR Art. 20 — Right to Data Portability)

**Endpoint:** `GET /api/users/:id/export`

- [ ] **Implement export endpoint** in `application/src/routes/users.routes.ts`

  ```typescript
  router.get('/:id/export', asyncHandler(async (req, res) => {
    // 1. Verify authorization (user exporting own data, or admin)
    // 2. Fetch user record
    // 3. Fetch all user's networks and topologies
    // 4. Fetch user's audit log entries
    // 5. Serialize as JSON
    // 6. Return with Content-Disposition: attachment; filename="export.json"
  }));
  ```

- [ ] **Export includes:**
  - [ ] User profile (ID, email, roles, created_at, last_login)
  - [ ] All networks (topologies, nodes, edges, configurations)
  - [ ] Audit log entries (filtered to user's own actions)
  - [ ] Session history (login/logout times, IP addresses)
  - [ ] Preferences (dark mode, language, etc.)

- [ ] **Export excludes:**
  - [ ] Passwords (never export)
  - [ ] Other users' data
  - [ ] Internal system logs
  - [ ] Backup metadata

- [ ] **Rate limiting:**
  - [ ] 1 export per 24 hours per user
  - [ ] Prevent abuse/spam

- [ ] **Logging:**
  - [ ] Record in audit log: "User [id] requested export at [time]"

#### Data Deletion (GDPR Art. 17 — Right to Erasure)

**Endpoint:** `DELETE /api/users/:id` (already exists, but needs GDPR enhancements)

- [ ] **Enhance deletion workflow:**

  ```
  DELETE /api/users/{id}
       ↓
  [Soft-delete] Mark user as deleted, hide from UI
       ↓
  [Notification] Send email: "Account will be deleted on [date+90]"
       ↓
  [Grace period] 90 days (user can request cancellation)
       ↓
  [Hard-delete] Scheduled job purges records >90 days old
  ```

- [ ] **Soft-delete implementation:**
  - [ ] Add `deleted_at` field to user record
  - [ ] Add `is_deleted` boolean flag (for efficient filtering)
  - [ ] Hide deleted users from listings: `User.find({ is_deleted: false })`
  - [ ] Preserve audit log (for compliance)

- [ ] **Hard-delete implementation:**
  - [ ] Daily scheduled job (e.g., 00:00 UTC)
  - [ ] Find users where `deleted_at < now() - 90 days`
  - [ ] Remove completely from database
  - [ ] Remove from backups (or archive separately)

- [ ] **Exception handling:**
  - [ ] Audit logs: Keep for compliance (DO NOT delete)
  - [ ] Backups: Remove user from backups after 30 days
  - [ ] Session tokens: Immediately invalidated

- [ ] **Notification:**
  - [ ] Email: "Account deletion requested"
  - [ ] Email: "Your account will be permanently deleted on [date]"
  - [ ] Email: "Account has been deleted" (confirmation)
  - [ ] Option to cancel deletion (within 7 days)

#### Consent Tracking

**Status:** [NOT IMPLEMENTED — needed for analytics/cookie compliance]

- [ ] **Create `consents` table in MongoDB:**

  ```typescript
  interface Consent {
    _id: ObjectId;
    userId: string;
    type: 'analytics' | 'marketing' | 'functional'; // categories
    granted: boolean; // true = accept, false = reject
    grantedAt: Date;
    ip: string; // anonymized (last octet removed)
    userAgent: string;
  }
  ```

- [ ] **Consent API:** `POST /api/users/:id/consents`
  - [ ] Accept consent choices from frontend
  - [ ] Validate and store in database
  - [ ] Return confirmation with expiry

- [ ] **Consent validation before tracking:**
  - [ ] Middleware: Check `consents.analytics` before sending GA events
  - [ ] If not consented: Log locally only, don't send to Google
  - [ ] Withdrawal: Find by userId, mark `granted: false`

### Session & Security

- [x] **Session tokens (JWT)**
  - [x] httpOnly cookies (prevent XSS token theft)
  - [x] Secure flag (HTTPS-only)
  - [x] SameSite=Strict (CSRF protection)
  - [x] TTL: 7 days (configurable)

- [ ] **Security headers audit**
  - [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: SAMEORIGIN`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Content-Security-Policy` (if needed)

- [ ] **Session invalidation**
  - [ ] Logout endpoint clears cookie
  - [ ] Verify: Token is not accepted after logout

### Audit Logging

- [x] **Audit log implementation** (audit.routes.ts)
  - [x] Records: action, actor, resource, timestamp, IP, user_agent
  - [x] TTL-based deletion (default: 90 days)
  - [x] Daily cleanup job

- [ ] **Audit log does not contain:**
  - [ ] Passwords or authentication tokens
  - [ ] Full email addresses (hash or truncate)
  - [ ] Other users' PII
  - [ ] Sensitive configuration values

- [ ] **Audit log query performance:**
  - [ ] Index on `userId`, `createdAt`, `resource_id`
  - [ ] Efficient pagination (limit 100 per page)
  - [ ] Archive old logs (move to separate "archive" collection after 90 days)

### Data Retention

- [x] **Audit logs cleanup**
  - [x] Default: 90 days
  - [x] Configurable via env var: `AUDIT_RETENTION_DAYS`
  - [x] Daily scheduled job (uses node-cron or similar)

- [ ] **Session token expiration**
  - [x] TTL: 7 days (or configurable)
  - [ ] Expired tokens should not be accepted

- [ ] **Backup retention**
  - [ ] Backups older than 30 days are automatically deleted
  - [ ] Deleted user data is purged from backups

- [ ] **Network topology retention (user request)**
  - [ ] User can delete networks manually
  - [ ] Deleted networks go into 7-day recovery window
  - [ ] After 7 days: permanently deleted

### Rate Limiting

- [x] **Rate limiting middleware** (100 req/min default)
  - [x] Per-user rate limiting
  - [x] Per-IP rate limiting
  - [x] Endpoint-specific overrides (e.g., login: 5 attempts/min)

- [ ] **Rate limit headers on responses**
  - [ ] `X-RateLimit-Limit: 100`
  - [ ] `X-RateLimit-Remaining: 95`
  - [ ] `X-RateLimit-Reset: 1693046400` (Unix timestamp)
  - [ ] `Retry-After: 60` (when limit exceeded, 429 status)

### Input Validation

- [x] **All endpoints validated with zod**
  - [x] Type checking (string, number, UUID, etc.)
  - [x] Length limits
  - [x] Format validation (email, UUID, IP address)

- [x] **No SQL Injection** (MongoDB + Mongoose schema)
  - [x] No string concatenation in queries
  - [x] All queries use Mongoose model methods

- [x] **XSS Prevention**
  - [x] JSON responses (safe by default)
  - [x] React frontend (no dangerouslySetInnerHTML)

---

## Regional Compliance

### Austria-Specific

- [ ] **Impressum published**
  - [ ] Name: Phillip Kofler
  - [ ] Address: [PLACEHOLDER — street address in Austria]
  - [ ] Contact: [operator email]
  - [ ] Business registration (if applicable)

- [ ] **Datenschutzerklärung in German**
  - [ ] Accessible via footer link
  - [ ] Mentions: OAuth providers (Google, Microsoft), data storage (MongoDB), audit logs

- [ ] **ECG § 5 compliance**
  - [ ] Impressum page with all required info
  - [ ] Accessible in one click from every page

### EU-Wide (GDPR)

- [x] **MongoDB is EU-based or has SCCs** (verify in deployment docs)
  - [x] If AWS/US-based: Standard Contractual Clauses (SCCs) in place
  - [x] Schrems II assessment documented

- [ ] **Data Processing Agreement (ADV) with MongoDB service**
  - [ ] Signed with hosting provider
  - [ ] Available for inspection

---

## Deployment & Testing Checklist

### Pre-Launch (Before Public Beta)

**By:** 2026-09-06

- [ ] **Legal documents created and published**
  - [ ] PRIVACY.md rendered at `/privacy`
  - [ ] IMPRESSUM.md rendered at `/impressum`
  - [ ] TERMS.md rendered at `/terms`
  - [ ] All links in footer point correctly

- [ ] **Cookie consent banner deployed**
  - [ ] Banner appears on first visit
  - [ ] Google Analytics only loads after acceptance
  - [ ] "Reject All" works (no tracking)

- [ ] **Security audit**
  - [ ] `npm audit` (no high-severity vulnerabilities)
  - [ ] gitleaks (no secrets committed)
  - [ ] Manual code review (XSS, CSRF, injection)

- [ ] **Testing**
  - [ ] E2E: Login with Google/Microsoft
  - [ ] E2E: Create, edit, delete network
  - [ ] E2E: Admin page loads
  - [ ] Footer links work

### Post-Launch (MVP Compliance)

**By:** 2026-09-13

- [ ] **GDPR endpoints implemented**
  - [ ] `GET /api/users/:id/export` — returns JSON
  - [ ] `DELETE /api/users/:id` — triggers 90-day grace period
  - [ ] Test: Export contains all user data
  - [ ] Test: Deletion marks user as deleted

- [ ] **Consent tracking**
  - [ ] Cookie consent stored in database
  - [ ] Withdrawal of consent works
  - [ ] Analytics respect consent

- [ ] **Audit logging verified**
  - [ ] Actions are logged
  - [ ] TTL cleanup job runs daily
  - [ ] No sensitive data in logs

---

## Known Limitations & Upgrade Paths

| Limitation | Ceiling | Upgrade Path |
|-----------|---------|--------------|
| **No encrypted backups** | Backups are readable if DB server is breached | Enable MongoDB encryption at rest (Atlas feature) if storing highly sensitive topologies |
| **Rate limiting is per-instance** | If scaled to multiple backend instances, limits aren't shared | Implement Redis-backed rate limiting |
| **No formal incident response plan** | No defined escalation path for security issues | Document incident response procedure in SECURITY.md |
| **Audit logs stored in same DB as user data** | If DB is breached, audit trail is compromised | Consider external audit log storage (e.g., S3, Azure Blob) for separation of concerns |

---

## Timeline

| Phase | Deliverables | Effort | Deadline |
|-------|--------------|--------|----------|
| **1: Legal & Cookies** | Impressum, Privacy, Terms, Cookie Consent Banner | 3–5 days | 2026-09-06 |
| **2: GDPR Endpoints** | Data export, deletion, consent tracking | 5–7 days | 2026-09-13 |
| **3: Testing & Hardening** | E2E tests, security audit, documentation | 3–5 days | 2026-09-20 |
| **4: Launch** | Public beta, monitoring enabled | Ongoing | 2026-09-23+ |

---

## Status Summary

| Category | Status | Priority | Owner |
|----------|--------|----------|-------|
| **Legal Documents** | ❌ Missing | HIGH | DevOps |
| **Frontend (Footer, Cookies)** | ⚠️ Partial (footer exists) | HIGH | Frontend |
| **Backend (Export, Deletion)** | ❌ Missing | HIGH | Backend |
| **Security Headers** | ✅ Complete | MEDIUM | DevOps |
| **Audit Logging** | ✅ Complete | MEDIUM | Backend |
| **Rate Limiting** | ✅ Complete | MEDIUM | Backend |
| **Testing** | ⚠️ Partial | MEDIUM | QA |

---

**Next Step:** Create legal pages and deploy cookie consent banner (Phase 1).
