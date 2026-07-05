# UC: Netzwerktopologie erstellen

## Beschreibung

Der Bearbeiter entwirft im Netzwerk-Builder eine Netzwerktopologie so, wie
reale Netze aufgebaut sind: Er zieht Geräte (Router, Switches, Firewalls,
Server, Endgeräte …) auf die Zeichenfläche, verbindet sie über ihre Anschlüsse
zu Leitungen und konfiguriert je Gerät die relevanten Einstellungen wie
Routing-Tabelle, Firewall-Regeln, VLANs und DHCP. Anschließend kann er einzelne
Geräte einschalten, wodurch diese automatisch per DHCP eine Adresse beziehen.

Der Hauptnutzen ist ein schneller, anschaulicher Aufbau realistischer
Netzwerke ohne physische Hardware. Änderungen werden automatisch im lokalen
Speicher gesichert; angemeldete Bearbeiter können zusätzlich benannte Versionen
anlegen. Die fertige Topologie ist die Grundlage für Simulation und Analyse
(siehe [UC: Paket senden und Pfad verfolgen](uc-paket-senden.md)).

## Akteur(e)

* Primärer Akteur: Bearbeiter
* Weitere Akteure
  * Gast (nutzt denselben Ablauf im gemeinsamen lokalen Arbeitsbereich)
  * System (vergibt beim Einschalten automatisch DHCP-Adressen)

## Vorbedingung(en)

* Die Anwendung ist im Browser geöffnet und der Netzwerk-Builder ist aufgerufen
* UND für das Anlegen benannter Versionen ist der Bearbeiter angemeldet

## Nachbedingung(en)

* Die Topologie (Knoten, Kanten und Konfiguration) ist im lokalen Speicher persistiert
* UND eingeschaltete Geräte besitzen eine per DHCP zugewiesene IP-Adresse

## Trigger(s)

* User-Interaktion des Bearbeiters auf der Zeichenfläche des Netzwerk-Builders

## Normaler Ablauf

1. Bearbeiter öffnet den Netzwerk-Builder; eine leere oder zuletzt gespeicherte Zeichenfläche wird angezeigt.
2. Bearbeiter zieht ein Gerät aus der Palette auf die Zeichenfläche (Position wird übernommen).
3. Bearbeiter wählt ein Gerät aus und verbindet einen seiner Anschlüsse per Ziehen mit dem Anschluss eines anderen Geräts; das System legt eine Kante an.
4. Bearbeiter benennt und parametriert die Verbindung optional (Label, Bandbreite, Latenz, VLAN, Status).
5. Bearbeiter öffnet die Eigenschaften eines Geräts und konfiguriert die relevanten Einstellungen (Routing-Tabelle, Firewall-Regeln, VLANs, DHCP, Dienste).
6. Die Schritte 2 bis 5 werden wiederholt, bis die Topologie vollständig ist.
7. Bearbeiter schaltet ein Gerät ein; das System löst automatisch den DHCP-Ablauf (DORA) aus und weist eine Adresse zu.
8. Das System sichert die Änderungen laufend automatisch im lokalen Speicher.
9. Ein angemeldeter Bearbeiter legt optional eine benannte Version der Topologie an.

```plantuml
|Bearbeiter|
start
:Netzwerk-Builder öffnen;

repeat
  :Gerät aus Palette ziehen;
  :Geräte verbinden;
  :Verbindung parametrieren;
  :Gerät konfigurieren;
repeat while (Weiteres Gerät?) is (ja) not (nein)

:Gerät einschalten;

|System|
:DHCP (DORA) ausführen;
:Adresse zuweisen;

|Bearbeiter|
if (Angemeldet?) then (ja)
  :Benannte Version anlegen;
else (nein)
endif
:Automatische Sicherung im lokalen Speicher;
stop
```

## Alternative Abläufe

### Gerät wieder ausschalten

Schaltet der Bearbeiter ein Gerät in Schritt 7 wieder aus, so gibt das System
die zugewiesene Adresse frei und Verkehr kann dieses Gerät nicht mehr passieren.

### Änderung rückgängig machen

Nach jedem Schritt kann der Bearbeiter mit `Ctrl+Z` die letzte Änderung
rückgängig machen und mit `Ctrl+Shift+Z` wiederherstellen.

### Geführtes Tutorial

Ist der Bearbeiter mit dem Ablauf nicht vertraut, kann er in Schritt 1 das
geführte Tutorial starten, das den kompletten Arbeitsablauf Schritt für Schritt
erklärt.

## UML Diagramme

### Domain Modell

```plantuml
class NetworkTopology {
  id: String
  name: String
  description: String
  createdAt: long
  updatedAt: long
}

class NetworkNode {
  id: String
  type: NodeType
  label: String
  position: Point
}

class NetworkNodeConfig {
  hostname: String
  powered: boolean
  zone: String
  mgmtIp: String
}

class NetworkEdge {
  id: String
  label: String
  bandwidth: String
  latency: String
  status: String
}

class NetworkInterface {
  name: String
  ipAddress: String
  cidr: String
  vlan: int
  status: String
}

class RoutingTableEntry {
  destination: String
  mask: String
  gateway: String
  metric: int
}

class FirewallRule {
  priority: int
  action: String
  protocol: String
  direction: String
}

enum NodeType {
  ROUTER
  SWITCH
  FIREWALL
  SERVER
  PC
}

NetworkTopology "1" *-down- "0..n" NetworkNode
NetworkTopology "1" *-down- "0..n" NetworkEdge
NetworkNode "1" *-down- "1" NetworkNodeConfig
NetworkNodeConfig "1" *-- "0..n" NetworkInterface
NetworkNodeConfig "1" *-- "0..n" RoutingTableEntry
NetworkNodeConfig "1" *-- "0..n" FirewallRule
NetworkEdge "0..n" -right-> "2" NetworkNode
```

### Sequenzdiagramm

Das folgende Sequenzdiagramm zeigt vereinfacht das Einschalten eines Geräts und
die automatische Adressvergabe.

```plantuml
actor Bearbeiter
participant "Netzwerk-Builder" as UI
participant "Simulation" as Sim
participant "DHCP-Server" as Dhcp

Bearbeiter -> UI: Gerät einschalten
activate UI
UI -> Sim: Statuswechsel melden
activate Sim
Sim -> Dhcp: DHCP Discover / Request
activate Dhcp
Dhcp --> Sim: DHCP Offer / Ack (Adresse)
deactivate Dhcp
Sim --> UI: Gerät mit Adresse aktualisieren
deactivate Sim
UI --> Bearbeiter: Gerät als aktiv anzeigen
deactivate UI
```

### Zustandsdiagramm

Das folgende Diagramm zeigt die Zustände eines Geräts auf der Zeichenfläche.

```plantuml
[*] -down-> Platziert : Gerät auf Fläche gezogen
Platziert -down-> Verbunden : Verbindung erstellt
Verbunden -down-> Konfiguriert : Einstellungen gepflegt
Konfiguriert -down-> Eingeschaltet : Einschalten\nDHCP erhält Adresse
Eingeschaltet -up-> Konfiguriert : Ausschalten\nAdresse freigegeben
Eingeschaltet -down-> [*]
```

## Relevante Anforderungen

* REQ-NB-1
* REQ-NB-2
* REQ-NB-3
* REQ-NB-4
* REQ-NB-5
* REQ-NB-6
* REQ-NB-7
