# UC: Paket senden und Pfad verfolgen

## Beschreibung

Der Bearbeiter sendet in einer aufgebauten Topologie ein Paket von einem
Quellgerät zu einem Zielgerät und beobachtet, wie es das Netzwerk Hop-für-Hop
durchläuft. Das System bestimmt den Pfad per Longest-Prefix-Match anhand der
Routing-Tabellen, prüft an jedem Übergang die Firewall-Regeln (ingress und
egress), wendet am Internet-Rand NAT an, dekrementiert die TTL und setzt
VLAN-Isolation sowie Subnetz-Segmentierung durch. Jeder Schritt wird animiert;
bei einer Blockierung nennt das System den konkreten Grund.

Der Hauptnutzen ist ein didaktisches, sofort sichtbares Verständnis dafür,
_warum_ Verkehr fließt oder blockiert wird — ein Lerneffekt, den reine
Tabellen nicht bieten. Der Use Case setzt eine bestehende Topologie voraus
(siehe [UC: Netzwerktopologie erstellen](uc-topologie-erstellen.md)).

## Akteur(e)

* Primärer Akteur: Bearbeiter
* Weitere Akteure
  * Gast (nutzt denselben Ablauf im gemeinsamen lokalen Arbeitsbereich)
  * System (wertet Routing, Firewall, NAT, TTL und VLAN aus)

## Vorbedingung(en)

* Eine Topologie mit mindestens zwei verbundenen Geräten ist vorhanden
* UND Quell- und Zielgerät sind eingeschaltet und besitzen eine IP-Adresse

## Nachbedingung(en)

* Der ermittelte Pfad ist Hop-für-Hop visualisiert
* UND das Ergebnis (zugestellt oder blockiert samt Grund) ist dargestellt
* Der Zustand der Topologie bleibt unverändert (lesender Vorgang)

## Trigger(s)

* User-Interaktion: Bearbeiter löst in der Sende-Leiste die Aktion _Send_ aus

## Normaler Ablauf

1. Bearbeiter wählt in der Sende-Leiste ein Quellgerät und ein Zielgerät aus.
2. Bearbeiter wählt den Pakettyp (z. B. ICMP/Ping) und optional die TTL sowie die Geschwindigkeit (Fast/Normal/Slow).
3. Bearbeiter löst die Aktion _Send_ aus.
4. Das System ermittelt am aktuellen Knoten per Longest-Prefix-Match den nächsten Hop.
5. Das System prüft die Firewall-Regeln des ausgehenden und des eingehenden Anschlusses sowie VLAN- und Subnetz-Zugehörigkeit.
6. Das System dekrementiert die TTL und wendet, sofern der Internet-Rand überschritten wird, NAT an.
7. Das System animiert den Sprung zum nächsten Hop.
8. Die Schritte 4 bis 7 werden wiederholt, bis das Zielgerät erreicht ist.
9. Das System markiert das Paket als zugestellt und zeigt den vollständigen Pfad an.

```plantuml
|Bearbeiter|
start
:Quelle und Ziel wählen;
:Pakettyp und TTL wählen;
:Senden auslösen;

|System|
repeat
  :Nächsten Hop per Longest-Prefix-Match bestimmen;
  :Firewall / VLAN / Subnetz prüfen;
  if (Erlaubt?) then (nein)
    :Paket blockieren\nGrund anzeigen;
    stop
  else (ja)
  endif
  :TTL dekrementieren;
  if (TTL = 0?) then (ja)
    :Paket verwerfen\n(TTL abgelaufen);
    stop
  else (nein)
  endif
  if (Internet-Rand?) then (ja)
    :NAT anwenden;
  else (nein)
  endif
  :Sprung zum nächsten Hop animieren;
repeat while (Ziel erreicht?) is (nein) not (ja)

:Paket als zugestellt markieren;
:Vollständigen Pfad anzeigen;
stop
```

## Alternative Abläufe

### Blockierung durch Firewall

Verweigert in Schritt 5 eine Firewall-Regel (oder das implizite Deny) den
Verkehr, so stoppt das System das Paket am betroffenen Hop und zeigt die Regel
bzw. den Grund an. Das Paket wird nicht zugestellt.

### TTL abgelaufen

Erreicht die TTL in Schritt 6 den Wert 0, bevor das Ziel erreicht ist, verwirft
das System das Paket und meldet _TTL abgelaufen_.

### VLAN-Isolation oder fehlende Route

Liegen Quelle und Ziel in isolierten VLANs bzw. getrennten Subnetzen ohne
gültige Route, meldet das System die fehlende Erreichbarkeit mit
entsprechendem Grund (keine Route / VLAN-Isolation).

### Gerät ausgeschaltet

Ist ein Gerät auf dem Pfad ausgeschaltet, kann das Paket es nicht passieren; das
System bricht am letzten erreichbaren Hop ab.

## UML Diagramme

### Domain Modell

```plantuml
class TraceRequest {
  sourceId: String
  targetId: String
  packetType: String
  ttl: int
}

class TraceResult {
  delivered: boolean
  blockReason: String
}

class Hop {
  order: int
  nodeId: String
  ttlRemaining: int
  natApplied: boolean
  allowed: boolean
}

class NetworkNode {
  id: String
  label: String
}

class RoutingTableEntry {
  destination: String
  mask: String
  gateway: String
}

class FirewallRule {
  action: String
  direction: String
  protocol: String
}

TraceRequest -down-> "1" TraceResult
TraceResult "1" *-down- "1..n" Hop
Hop "0..n" -right-> "1" NetworkNode
NetworkNode "1" *-- "0..n" RoutingTableEntry
NetworkNode "1" *-- "0..n" FirewallRule
```

### Sequenzdiagramm

Das folgende Sequenzdiagramm zeigt die Auswertung eines Hops zwischen den
beteiligten Diensten.

```plantuml
actor Bearbeiter
participant "Sende-Leiste" as UI
participant "Paket-Sender" as Sender
participant "Routing" as Route
participant "Firewall" as FW

Bearbeiter -> UI: Senden (Quelle, Ziel, TTL)
activate UI
UI -> Sender: Trace starten
activate Sender
loop pro Hop bis Ziel oder Abbruch
  Sender -> Route: Nächsten Hop bestimmen
  activate Route
  Route --> Sender: Nächster Hop
  deactivate Route
  Sender -> FW: Regeln prüfen (ingress/egress)
  activate FW
  FW --> Sender: erlaubt / blockiert (Grund)
  deactivate FW
end
Sender --> UI: Pfad + Ergebnis
deactivate Sender
UI --> Bearbeiter: Pfad animieren, Ergebnis anzeigen
deactivate UI
```

### Zustandsdiagramm

Das folgende Diagramm zeigt die Zustände eines gesendeten Pakets.

```plantuml
[*] -down-> Unterwegs : Senden ausgelöst
Unterwegs -down-> Unterwegs : Hop erlaubt\nTTL dekrementiert
Unterwegs -down-> Zugestellt : Ziel erreicht
Unterwegs -right-> Blockiert : Firewall / VLAN / keine Route
Unterwegs -left-> Verworfen : TTL = 0
Zugestellt -down-> [*]
Blockiert -down-> [*]
Verworfen -down-> [*]
```

## Relevante Anforderungen

* REQ-SIM-1
* REQ-SIM-2
* REQ-SIM-3
* REQ-SIM-4
* REQ-SIM-5
* REQ-SIM-6
* REQ-NB-4
