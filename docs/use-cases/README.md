# Use Cases — NetViz

Diese Dokumentation beschreibt die zentralen Anwendungsfälle (Use Cases) von
**NetViz**, einem Werkzeug zum Entwerfen, Visualisieren und Simulieren von
Netzwerken im Browser. Sie ergänzt die technische [API-Referenz](../api.md) um
eine fachliche Sicht: *wer* nutzt das System *wofür* und *wie* läuft das ab.

Die einzelnen Use Cases sind nach der vorgegebenen Vorlage strukturiert
(Beschreibung, Akteure, Vor-/Nachbedingungen, Trigger, normaler Ablauf,
alternative Abläufe, UML-Diagramme, relevante Anforderungen).

## Akteure

| Akteur | Beschreibung |
| --- | --- |
| **Gast** | Nicht angemeldeter Benutzer. Arbeitet im gemeinsamen lokalen Arbeitsbereich und kann Netzwerk-Builder, Paket-Mitschnitt und CIDR-Rechner ohne Konto nutzen. |
| **Bearbeiter** | Angemeldeter Benutzer mit der Rolle `editor`. Erstellt und bearbeitet seine eigenen, isolierten Netzwerke. |
| **Betrachter** | Angemeldeter Benutzer mit der Rolle `viewer`. Nur-Lese-Zugriff auf Daten. |
| **Administrator** | Angemeldeter Benutzer mit der Rolle `admin`. Verwaltet Benutzer und Rollen, liest Audit-Log und Systemmetriken. Der erste angemeldete Benutzer wird automatisch Administrator. |
| **System** | Sekundärer Akteur. Führt automatisierte Abläufe aus (DHCP-Vergabe beim Einschalten, kontinuierliche Verkehrssimulation, Paket-Trace-Auswertung). |

Die Rollen sind hierarchisch: `admin` schließt die Rechte von `editor` ein,
`editor` die von `viewer`. Details in
[organizational/roles-and-permissions.md](../../organizational/roles-and-permissions.md).

## Use-Case-Diagramme

### Netzwerk-Design

```plantuml
:Bearbeiter: --> (Topologie erstellen)
:Gast: --> (Topologie erstellen)
:Bearbeiter: --> (Gerät hinzufügen)
(Gerät hinzufügen) <|-- (Router hinzufügen)
(Gerät hinzufügen) <|-- (Switch hinzufügen)
(Gerät hinzufügen) <|-- (Firewall hinzufügen)
:Bearbeiter: --> (Geräte verbinden)
:Bearbeiter: --> (Gerät konfigurieren)
(Routing konfigurieren) .> (Gerät konfigurieren) :extends
(Firewall-Regeln pflegen) .> (Gerät konfigurieren) :extends
(VLAN konfigurieren) .> (Gerät konfigurieren) :extends
(DHCP konfigurieren) .> (Gerät konfigurieren) :extends
:Bearbeiter: --> (Gerät ein-/ausschalten)
:Bearbeiter: --> (Topologie speichern)
:Bearbeiter: --> (Änderung rückgängig machen)
:Gast: --> (Geführtes Tutorial starten)
```

### Simulation und Analyse

```plantuml
:Bearbeiter: --> (Paket senden)
:Gast: --> (Paket senden)
(Routing auswerten) .> (Paket senden) :extends
(Firewall-Regeln prüfen) .> (Paket senden) :extends
(NAT anwenden) .> (Paket senden) :extends
(VLAN-Isolation prüfen) .> (Paket senden) :extends
:System: --> (Live-Verkehr simulieren)
:Bearbeiter: --> (Topologie analysieren)
```

### Paket-Mitschnitt

```plantuml
:Gast: --> (Mitschnitt starten)
:Gast: --> (Mitschnitt stoppen)
:Gast: --> (Protokolle filtern)
:Gast: --> (Paket inspizieren)
(Detailansicht anzeigen) .> (Paket inspizieren) :extends
(Hex-Dump anzeigen) .> (Paket inspizieren) :extends
(Statistik anzeigen) .> (Paket inspizieren) :extends
:Gast: --> (Mitschnitt exportieren)
```

### Subnetz-Berechnung

```plantuml
:Gast: --> (Subnetz berechnen)
(Binärdarstellung anzeigen) .> (Subnetz berechnen) :extends
:Gast: --> (Subnetze aufteilen)
:Gast: --> (Supernetz bilden)
```

### Konten und Administration

```plantuml
:Gast: --> (Anmelden)
(Mit Google anmelden) .> (Anmelden) :extends
(Mit Microsoft anmelden) .> (Anmelden) :extends
(Dev-Login verwenden) .> (Anmelden) :extends
:Administrator: --> (Benutzerrollen verwalten)
:Administrator: --> (Audit-Log einsehen)
:Administrator: --> (Systemmetriken abrufen)
:Gast: --> (Status-Seite aufrufen)
```

## Detaillierte Use Cases

| Use Case | Bereich | Primärer Akteur |
| --- | --- | --- |
| [UC: Netzwerktopologie erstellen](uc-topologie-erstellen.md) | Netzwerk-Design | Bearbeiter |
| [UC: Paket senden und Pfad verfolgen](uc-paket-senden.md) | Simulation & Analyse | Bearbeiter |
| [UC: Paket-Mitschnitt durchführen](uc-paket-mitschnitt.md) | Paket-Mitschnitt | Gast |
| [UC: Subnetz berechnen](uc-subnetz-berechnen.md) | Subnetz-Berechnung | Gast |
| [UC: Benutzerrollen verwalten](uc-benutzerrollen-verwalten.md) | Administration | Administrator |

Die referenzierten Anforderungen sind im
[Anforderungskatalog](requirements.md) gesammelt.
