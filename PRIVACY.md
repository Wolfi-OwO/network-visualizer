# Datenschutzerklärung (Privacy Policy)

**NetViz — Network Visualizer & Simulator**  
**Gültig ab:** 2026-08-23  
**Zuletzt aktualisiert:** 2026-08-23

Verantwortlich: Phillip Kofler, Österreich  
Kontakt: [koflerphillip@outlook.com](mailto:koflerphillip@outlook.com)

---

## 1. Einleitung und Geltungsbereich

Diese Datenschutzerklärung erklärt, wie NetViz („die Anwendung") personenbezogene Daten verarbeitet. Die Anwendung wird betrieben durch Phillip Kofler (nachfolgend: „Betreiber", „wir" oder „uns").

**Rechtliche Grundlagen:**
- DSGVO (Datenschutz-Grundverordnung der EU)
- Österreichisches Datenschutzgesetz (DSG)
- E-Commerce-Gesetz (ECG)
- Telemediengesetz (TMG) — Cookie-Richtlinie

---

## 2. Verantwortlicher und Kontakt

**Datenverantwortlicher:**
- Name: Phillip Kofler
- Wohnort: Österreich (Villach, Kärnten)
- Email: [koflerphillip@outlook.com](mailto:koflerphillip@outlook.com)

---

## 3. Welche Daten wir verarbeiten

### 3.1 Automatisch erfasste Daten

#### Kontodaten
- **Google / Microsoft User ID** (OAuth)
- **Email-Adresse** (von OAuth-Anbieter)
- **Profilbild-URL** (falls vorhanden)
- **Anzeigename**

#### Verbindungsdaten
- **Login-Zeitpunkte** (Timestamps)
- **Letzte Aktivität** (Timestamp)
- **IP-Adressen** (gekürzt, letzte Oktette entfernt)
- **User Agent** (Browser-Kennung)
- **Session-Cookies** (JWT-Tokens in httpOnly)

#### Netzwerk-Topologien (Nutzer-erstellt)
- **Netzwerk-Designs** (nodes, edges, labels)
- **Gerätekonfigurationen** (routers, switches, firewalls, etc.)
- **Kanal-Parameter** (bandwidth, latency, VLAN-IDs)
- **Konfigurationen** (Namen, Beschreibungen)

#### Audit-Logs
- **Administrative Aktionen:** Wer änderte was und wann
- **Mutating Operations:** Network create/update/delete, user role changes

### 3.2 Optionale Daten (mit Zustimmung)

- **Google Analytics** (falls aktiviert)
- **Error Tracking** (Sentry, Rollbar — falls aktiviert)

---

## 4. Rechtsgrundlagen für die Datenverarbeitung

| Datenart | Rechtsgrundlage | Erklärung |
|----------|-----------------|-----------|
| Kontodaten (OAuth) | Art. 6 Abs. 1 lit. a | Einwilligung bei OAuth Sign-In |
| Verbindungsdaten | Art. 6 Abs. 1 lit. b | Erforderlich zur Service-Bereitstellung |
| Netzwerk-Topologien | Art. 6 Abs. 1 lit. b | Nutzerdaten für den Service |
| Audit-Logs | Art. 6 Abs. 1 lit. c | Rechtliche Compliance und Fraud-Detection |
| Google Analytics | Art. 6 Abs. 1 lit. a | Explizite Cookie-Zustimmung erforderlich |

---

## 5. Datenverarbeitungszwecke und Speicherdauer

| Zweck | Speicherdauer | Basis |
|-------|-----------------|------|
| Service-Bereitstellung | Solange Konto aktiv | Art. 6 lit. b |
| Audit-Logging | 90 Tage | Art. 6 lit. c |
| Backup & Disaster Recovery | 30 Tage nach Löschung | Art. 6 lit. b |
| Analytics (optional) | Bis Consent entzogen | Art. 6 lit. a |

---

## 6. Drittanbieter und Datenfreigaben

### 6.1 OAuth-Anbieter

- **Google & Microsoft** — User ID, Email, Profilbild
- Datenschutzerklärungen: Google Privacy Policy, Microsoft Privacy Statement

### 6.2 Cloud-Infrastruktur

- **Hosting-Provider:** [PLACEHOLDER — Azure, AWS, etc.]
- **Datenbank:** MongoDB (Cloud-gehostet)
- **Backups:** [PLACEHOLDER]
- Standard Contractual Clauses (SCCs) in place für EU-Transfers

### 6.3 Optional: Analytics & Monitoring

- **Google Analytics 4** (falls aktiviert, nur mit Consent)
- **Sentry/Error Tracking** (falls aktiviert)
- Link zu Privacy Policies bereitgestellt

---

## 7. Betroffenenrechte (Art. 12–22 DSGVO)

### Recht auf Auskunft (Art. 15)
- Anfrage an: [koflerphillip@outlook.com](mailto:koflerphillip@outlook.com)
- Antwortfrist: 30 Tage
- Format: JSON oder CSV

### Recht auf Löschung (Art. 17)
- Vollständige Löschung Ihres Kontos und der Daten
- Audit-Logs werden 90 Tage aufbewahrt, dann gelöscht
- Backups: Nach 30 Tagen entfernt

### Recht auf Datenportabilität (Art. 20)
- Export aller Daten als JSON
- Anfrage an obiger Email-Adresse

### Recht auf Beschwerde (Art. 77)
- **Österreichische Datenschutzbehörde (DSB):**
  - Wickenburggasse 8, 1080 Wien
  - Email: [dsb@dsb.gv.at](mailto:dsb@dsb.gv.at)
  - Web: www.dsb.gv.at

---

## 8. Datensicherheit

✅ **HTTPS/TLS 1.3** für alle Verbindungen  
✅ **JWT-Tokens** in httpOnly, Secure, SameSite=Strict Cookies  
✅ **Rate Limiting** auf allen API-Endpoints  
✅ **Input Validation** gegen XSS, SQL Injection  
✅ **Audit Logging** aller sensiblen Aktionen  

---

## 9. Cookies und Analytics

### Erforderliche Cookies
- `session` — JWT-Token (httpOnly, Secure, SameSite=Strict)
- `XSRF-TOKEN` — CSRF-Schutz

### Optional (mit Zustimmung)
- **Google Analytics 4** — Performance Tracking
- **Preferences** — Language, Dark Mode

Cookie-Banner zeigt Optionen zur Akzeptanz/Ablehnung.

---

## 10. Kontakt bei Datenschutzfragen

**Datenschutz-Kontakt:**  
Phillip Kofler  
Email: [koflerphillip@outlook.com](mailto:koflerphillip@outlook.com)

Antwortzeit: 5–10 Arbeitstage

---

Gültig ab: 2026-08-23
