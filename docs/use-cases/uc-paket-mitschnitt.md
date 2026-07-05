# UC: Paket-Mitschnitt durchführen

## Beschreibung

Der Gast führt einen Wireshark-artigen Paket-Mitschnitt durch: Er startet die
Aufzeichnung, woraufhin das System einen kontinuierlichen Strom realistischer
Pakete (16+ Protokolle) über Server-Sent Events an den Browser liefert. Der
Benutzer filtert die Anzeige nach Protokoll oder Freitext, wählt einzelne Pakete
aus und inspiziert sie über Detailbaum, Hex-Dump und Statistik. Der Mitschnitt
kann exportiert werden.

Der Hauptnutzen ist das Erlernen und Analysieren von Netzwerkverkehr auf
Paketebene ohne echten Sniffer und ohne administrative Rechte am Betriebssystem.

## Akteur(e)

* Primärer Akteur: Gast
* Weitere Akteure
  * System (erzeugt und streamt die Pakete)

## Vorbedingung(en)

* Die Anwendung ist im Browser geöffnet und die Seite _Packet Capture_ ist aufgerufen
* UND die Verbindung zum Backend besteht (SSE-Stream verfügbar)

## Nachbedingung(en)

* Die aufgezeichneten Pakete sind in der Tabelle dargestellt
* UND bei Export liegt eine Datei mit den Paketen vor
* Der Aufzeichnungszustand (läuft/gestoppt) ist konsistent dargestellt

## Trigger(s)

* User-Interaktion: Gast betätigt _Start_ in der Werkzeugleiste

## Normaler Ablauf

1. Gast öffnet die Seite _Packet Capture_.
2. Gast betätigt _Start_; das System öffnet den SSE-Stream und beginnt, Pakete zu liefern.
3. Das System stellt eintreffende Pakete laufend in der Tabelle dar (Nr., Zeit, Quelle, Ziel, Protokoll, Länge, Info).
4. Gast schränkt die Anzeige optional über Protokoll-Umschalter oder das Freitext-Filterfeld ein.
5. Gast wählt ein Paket aus; das System zeigt den Protokoll-Detailbaum an.
6. Gast wechselt optional in die Ansicht _Hex Dump_ oder _Statistics_.
7. Gast betätigt _Stop_; das System schließt den Stream, die aufgezeichneten Pakete bleiben erhalten.
8. Gast exportiert den Mitschnitt optional über _Export_ als Datei.

```plantuml
|Gast|
start
:Seite Packet Capture öffnen;
:Start betätigen;

|System|
:SSE-Stream öffnen;

|Gast|
repeat
  :Pakete beobachten;
  :Optional filtern;
  :Optional Paket inspizieren;
repeat while (Weiter aufzeichnen?) is (ja) not (nein)

:Stop betätigen;

|System|
:SSE-Stream schließen;

|Gast|
if (Exportieren?) then (ja)
  :Mitschnitt als Datei exportieren;
else (nein)
endif
stop
```

## Alternative Abläufe

### Verbindung unterbrochen

Bricht der SSE-Stream in Schritt 3 ab, meldet das System den Verbindungsverlust;
die bereits empfangenen Pakete bleiben sichtbar. Nach Wiederherstellung kann der
Gast die Aufzeichnung erneut starten.

### Mitschnitt leeren

Der Gast kann die Tabelle jederzeit über _Clear_ leeren, um mit einem frischen
Mitschnitt zu beginnen.

### Kein Treffer beim Filtern

Ergibt der Filter in Schritt 4 keine Treffer, zeigt das System eine leere Liste
mit entsprechendem Hinweis; die zugrunde liegenden Pakete bleiben erhalten und
werden nach Zurücksetzen des Filters wieder angezeigt.

## UML Diagramme

### Domain Modell

```plantuml
class CaptureSession {
  capturing: boolean
  startTime: long
}

class Packet {
  id: int
  timestamp: long
  protocol: String
  length: int
  info: String
}

class ProtocolLayer {
  name: String
  summary: String
}

class PacketStats {
  total: int
  byProtocol: Map
  packetsPerSecond: double
}

CaptureSession "1" *-down- "0..n" Packet
Packet "1" *-down- "0..n" ProtocolLayer
CaptureSession "1" -right-> "1" PacketStats
```

### Sequenzdiagramm

Das folgende Sequenzdiagramm zeigt den Live-Strom über Server-Sent Events.

```plantuml
actor Gast
participant "Capture-Ansicht" as UI
participant "Capture-Service" as Cap

Gast -> UI: Start
activate UI
UI -> Cap: SSE-Verbindung öffnen (GET /api/capture/stream)
activate Cap
loop laufend
  Cap --> UI: event: packet (Paketdaten)
  UI --> Gast: Zeile in Tabelle ergänzen
end
Gast -> UI: Stop
UI -> Cap: Verbindung schließen
deactivate Cap
deactivate UI
```

### Zustandsdiagramm

Das folgende Diagramm zeigt die Zustände einer Aufzeichnungssitzung.

```plantuml
[*] -down-> Bereit
Bereit -down-> Zeichnet_auf : Start
Zeichnet_auf -up-> Bereit : Stop
Zeichnet_auf -right-> Zeichnet_auf : Paket empfangen
Bereit -left-> Bereit : Leeren (Clear)
Bereit -down-> [*]
```

## Relevante Anforderungen

* REQ-PC-1
* REQ-PC-2
* REQ-PC-3
* REQ-PC-4
* REQ-PC-5
