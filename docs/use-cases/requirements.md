# Anforderungskatalog

Dieser Katalog sammelt die fachlichen Anforderungen (Requirements), auf die sich
die [Use Cases](README.md) im Abschnitt *Relevante Anforderungen* beziehen. Die
IDs sind stabil und bereichsweise gruppiert.

## Netzwerk-Builder (REQ-NB)

| ID | Anforderung |
| --- | --- |
| REQ-NB-1 | Der Benutzer kann Geräte per Drag-and-drop aus einer Palette auf die Zeichenfläche ziehen (25+ Gerätetypen). |
| REQ-NB-2 | Der Benutzer kann Geräte über frei wählbare Anschlüsse (Handles) verbinden und die Verbindung benennen und parametrieren (Bandbreite, Latenz, VLAN, Status). |
| REQ-NB-3 | Der Benutzer kann pro Gerät Routing-Tabelle, Firewall-Regeln, VLANs, DHCP und Dienste konfigurieren. |
| REQ-NB-4 | Beim Einschalten eines Geräts fordert dieses automatisch per DHCP (DORA) eine Adresse an; beim Ausschalten stoppt der Verkehr über das Gerät. |
| REQ-NB-5 | Änderungen werden automatisch im lokalen Speicher gesichert; angemeldete Benutzer können benannte Versionen anlegen. |
| REQ-NB-6 | Der Benutzer kann Änderungen rückgängig machen und wiederherstellen (Undo/Redo). |
| REQ-NB-7 | Ein geführtes Tutorial erklärt den gesamten Arbeitsablauf Schritt für Schritt. |

## Simulation und Analyse (REQ-SIM)

| ID | Anforderung |
| --- | --- |
| REQ-SIM-1 | Der Benutzer kann ein Paket von Quelle zu Ziel senden und erhält den Pfad Hop-für-Hop dargestellt. |
| REQ-SIM-2 | Die Weiterleitung erfolgt per Longest-Prefix-Match anhand der Routing-Tabellen. |
| REQ-SIM-3 | Firewall-ACLs werden ingress und egress geprüft; nicht erlaubter Verkehr wird mit implizitem Deny blockiert. |
| REQ-SIM-4 | Am Internet-Übergang wird NAT angewandt. |
| REQ-SIM-5 | Die TTL wird pro Hop dekrementiert; bei TTL 0 wird das Paket verworfen. |
| REQ-SIM-6 | VLAN-Isolation und Subnetz-Segmentierung werden durchgesetzt; Blockierungen werden mit klarem Grund gemeldet. |
| REQ-SIM-7 | Das System animiert kontinuierlich mehrere realistische Verkehrsflüsse parallel und in Echtzeit. |

## Paket-Mitschnitt (REQ-PC)

| ID | Anforderung |
| --- | --- |
| REQ-PC-1 | Pakete werden als Live-Strom über Server-Sent Events an den Client geliefert. |
| REQ-PC-2 | Es werden 16+ Protokolle realistisch erzeugt (u. a. HTTP, TLS, DNS, DHCP, ARP, ICMP, TCP, UDP). |
| REQ-PC-3 | Der Benutzer kann pro Protokoll die Anzeige ein-/ausschalten und per Freitext filtern. |
| REQ-PC-4 | Zu jedem Paket sind Detailbaum, Hex-Dump und Statistik einsehbar. |
| REQ-PC-5 | Der Mitschnitt kann als Datei exportiert werden. |

## CIDR-Rechner (REQ-CIDR)

| ID | Anforderung |
| --- | --- |
| REQ-CIDR-1 | Das System berechnet zu einer Eingabe Netz-, Broadcast-, erste/letzte Host-Adresse, Maske und Host-Anzahl. |
| REQ-CIDR-2 | Netz-, Masken- und Adressbits werden binär dargestellt. |
| REQ-CIDR-3 | Ein Netz kann in mehrere gleich große Subnetze aufgeteilt werden. |
| REQ-CIDR-4 | Aus mehreren Netzen kann das kleinste umschließende Supernetz (Route Summarization) gebildet werden. |
| REQ-CIDR-5 | Ungültige Eingaben werden strikt validiert und mit einer verständlichen Meldung abgewiesen. |

## Konten und Administration (REQ-ADM)

| ID | Anforderung |
| --- | --- |
| REQ-ADM-1 | Anmeldung ist per OAuth 2.0 (Google/Microsoft) mit CSRF-geschütztem State oder per passwortlosem Dev-Login möglich; die Sitzung ist ein signiertes JWT im httpOnly-Cookie. |
| REQ-ADM-2 | Der Zugriff ist rollenbasiert (`admin`/`editor`/`viewer`); der erste angemeldete Benutzer wird Administrator. |
| REQ-ADM-3 | Ein Administrator kann Rollen zuweisen und Benutzer entfernen; der letzte Administrator kann nicht herabgestuft oder entfernt werden. |
| REQ-ADM-4 | Mutierende Aktionen werden in einem Audit-Log mit TTL-Ablauf protokolliert. |
| REQ-ADM-5 | Systemmetriken (Laufzeit, Speicher, Datenbank, Mitschnitt) sind für Administratoren abrufbar. |
| REQ-ADM-6 | Eine öffentliche Status-Seite zeigt Verfügbarkeit und Uptime-Historie. |
| REQ-ADM-7 | Jeder angemeldete Benutzer erhält einen isolierten, privaten Arbeitsbereich. |
