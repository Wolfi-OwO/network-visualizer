# UC: Subnetz berechnen

## Beschreibung

Der Gast berechnet mit dem CIDR-Rechner zu einer Netzangabe (z. B.
`192.168.1.0/24`) die vollständige Subnetz-Information: Netz- und
Broadcast-Adresse, erste und letzte Host-Adresse, Subnetz- und Wildcard-Maske,
Host-Anzahl, IP-Klasse und Private-Range-Erkennung. Ergänzend werden Netz-,
Masken- und Adressbits binär dargestellt. Auf Basis desselben Werkzeugs kann der
Benutzer ein Netz in mehrere gleich große Subnetze aufteilen oder aus mehreren
Netzen das kleinste umschließende Supernetz bilden.

Der Hauptnutzen ist eine schnelle, fehlerfreie Subnetz-Planung ohne manuelle
Bit-Rechnerei; ungültige Eingaben werden strikt abgewiesen.

## Akteur(e)

* Primärer Akteur: Gast
* Weitere Akteure
  * System (führt die Berechnung und die Validierung aus)

## Vorbedingung(en)

* Die Anwendung ist im Browser geöffnet und die Seite _CIDR Calculator_ ist aufgerufen

## Nachbedingung(en)

* Das Berechnungsergebnis ist dargestellt (lesender Vorgang, kein Zustand wird persistiert)

## Trigger(s)

* User-Interaktion: Gast betätigt _Calculate_ oder wählt ein Preset

## Normaler Ablauf

1. Gast gibt eine Netzangabe in CIDR- oder Masken-Notation ein oder wählt ein Preset.
2. Gast betätigt _Calculate_.
3. Das System validiert die Eingabe.
4. Das System berechnet Netz-, Broadcast-, erste/letzte Host-Adresse, Masken, Host-Anzahl, IP-Klasse und Private-Range.
5. Das System stellt das Ergebnis dar, inklusive Binärdarstellung von IP, Maske und Netzadresse sowie einer Adressraum-Visualisierung.
6. Gast teilt das Netz optional über den Subnetz-Splitter in mehrere gleich große Subnetze auf.
7. Gast bildet optional aus mehreren Netzangaben das kleinste umschließende Supernetz.

```plantuml
|Gast|
start
:Netzangabe eingeben oder Preset wählen;
:Calculate betätigen;

|System|
if (Eingabe gültig?) then (nein)
  :Fehlermeldung anzeigen;
  stop
else (ja)
endif
:Subnetz-Werte berechnen;
:Binärdarstellung erzeugen;
:Ergebnis darstellen;

|Gast|
if (Aufteilen?) then (ja)
  :Anzahl / Präfix wählen;
  |System|
  :Subnetze berechnen und auflisten;
else (nein)
endif

|Gast|
if (Supernetz bilden?) then (ja)
  :Mehrere Netze angeben;
  |System|
  :Kleinstes umschließendes Netz bilden;
else (nein)
endif
stop
```

## Alternative Abläufe

### Ungültige Eingabe

Erkennt das System in Schritt 3 eine ungültige Eingabe (fehlerhafte Oktette,
unzulässiges Präfix, unpassende Maske), so bricht es ab und zeigt eine
verständliche Fehlermeldung; es wird kein Ergebnis dargestellt.

### Supernetz nicht bildbar

Lassen sich die in Schritt 7 angegebenen Netze nicht zu einem sinnvollen
Supernetz zusammenfassen, meldet das System dies und bildet kein Ergebnis.

## UML Diagramme

### Domain Modell

```plantuml
class CidrRequest {
  input: String
}

class CidrResult {
  ipAddress: String
  cidrPrefix: int
  networkAddress: String
  broadcastAddress: String
  firstHost: String
  lastHost: String
  subnetMask: String
  wildcardMask: String
  usableHosts: long
  ipClass: String
  isPrivate: boolean
}

class Subnet {
  networkAddress: String
  cidrPrefix: int
}

CidrRequest -right-> "1" CidrResult
CidrResult "1" -down-> "0..n" Subnet : Aufteilung
```

### Sequenzdiagramm

Das folgende Sequenzdiagramm zeigt die Berechnung über die REST-Schnittstelle.

```plantuml
actor Gast
participant "CIDR-Ansicht" as UI
participant "CIDR-Service" as Cidr

Gast -> UI: Calculate (Eingabe)
activate UI
UI -> Cidr: GET /api/cidr?input=...
activate Cidr
alt Eingabe gültig
  Cidr --> UI: 200 OK (Ergebnis)
else Eingabe ungültig
  Cidr --> UI: 400 Bad Request (Fehler)
end
deactivate Cidr
UI --> Gast: Ergebnis oder Fehlermeldung anzeigen
deactivate UI
```

### Zustandsdiagramm

Das folgende Diagramm zeigt die Zustände der Rechner-Ansicht.

```plantuml
[*] -down-> Leer
Leer -down-> Berechnet : Calculate\n[Eingabe gültig]
Leer -right-> Fehler : Calculate\n[Eingabe ungültig]
Fehler -left-> Leer : Eingabe korrigieren
Berechnet -down-> Berechnet : Aufteilen / Supernetz bilden
Berechnet -up-> Leer : Zurücksetzen
Berechnet -down-> [*]
```

## Relevante Anforderungen

* REQ-CIDR-1
* REQ-CIDR-2
* REQ-CIDR-3
* REQ-CIDR-4
* REQ-CIDR-5
