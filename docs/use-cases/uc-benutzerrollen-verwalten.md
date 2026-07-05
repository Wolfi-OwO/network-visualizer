# UC: Benutzerrollen verwalten

## Beschreibung

Der Administrator verwaltet in der Admin-Konsole die Konten und deren Rollen —
vergleichbar mit einer Google-Workspace- oder Microsoft-365-Admin-Konsole. Er
sieht die Liste aller angemeldeten Benutzer, ändert deren Rolle
(`admin`/`editor`/`viewer`) und entfernt bei Bedarf Konten. Jede mutierende
Aktion wird im Audit-Log protokolliert.

Der Hauptnutzen ist eine nachvollziehbare, rollenbasierte Zugriffssteuerung:
Bearbeiter können nur ihre eigenen Netzwerke ändern, Betrachter erhalten
Nur-Lese-Zugriff, und administrative Funktionen bleiben Administratoren
vorbehalten. Zum Schutz vor Aussperrung kann der letzte Administrator nicht
herabgestuft oder entfernt werden.

## Akteur(e)

* Primärer Akteur: Administrator
* Weitere Akteure
  * System (setzt die Rollenprüfung durch und schreibt das Audit-Log)

## Vorbedingung(en)

* Der Administrator ist mit einem Konto der Rolle `admin` angemeldet
* UND die Seite _Administration_ ist aufgerufen

## Nachbedingung(en)

* Die geänderte Rolle bzw. die Entfernung des Kontos ist persistiert
* UND ein Audit-Eintrag über die Aktion wurde erstellt

## Trigger(s)

* User-Interaktion: Administrator ändert in der Benutzerliste eine Rolle oder entfernt ein Konto

## Normaler Ablauf

1. Administrator öffnet die Seite _Administration_.
2. Das System prüft die Rolle und lädt die Liste aller Benutzer (Name, E-Mail, Provider, Rolle).
3. Administrator wählt bei einem Benutzer eine neue Rolle aus.
4. Das System validiert die Änderung (u. a. Schutz des letzten Administrators).
5. Das System persistiert die neue Rolle und schreibt einen Audit-Eintrag.
6. Das System aktualisiert die Darstellung der Benutzerzeile.

```plantuml
|Administrator|
start
:Seite Administration öffnen;

|System|
if (Rolle = admin?) then (nein)
  :Zugriff verweigern\nHinweis anzeigen;
  stop
else (ja)
endif
:Benutzerliste laden;

|Administrator|
:Neue Rolle wählen;

|System|
if (Letzter Administrator?\n[Herabstufung/Entfernung]) then (ja)
  :Aktion ablehnen\nGrund anzeigen;
  stop
else (nein)
endif
:Rolle persistieren;
:Audit-Eintrag schreiben;
:Benutzerzeile aktualisieren;
stop
```

## Alternative Abläufe

### Konto entfernen

Statt die Rolle zu ändern, entfernt der Administrator in Schritt 3 ein Konto.
Nach Bestätigung entfernt das System das Konto und schreibt einen Audit-Eintrag.
Der letzte Administrator kann nicht entfernt werden.

### Kein Administrator

Ruft ein Benutzer ohne `admin`-Rolle die Seite auf, verweigert das System den
Zugriff auf Benutzerliste und Metriken und weist darauf hin, dass diese
Funktionen Administratoren vorbehalten sind.

### Aktion nicht erlaubt

Versucht der Administrator, den letzten verbleibenden Administrator
herabzustufen oder zu entfernen, lehnt das System die Aktion mit einer
Begründung ab und lässt den Zustand unverändert.

## UML Diagramme

### Domain Modell

```plantuml
class User {
  id: String
  name: String
  email: String
  provider: String
  role: Role
}

class AuditEntry {
  id: String
  timestamp: long
  actorId: String
  action: String
  targetId: String
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

User "1" -right-> "1" Role
User "1" -down-> "0..n" AuditEntry : verursacht
```

### Sequenzdiagramm

Das folgende Sequenzdiagramm zeigt die Rollenänderung über die REST-Schnittstelle.

```plantuml
actor Administrator
participant "Admin-Konsole" as UI
participant "Users-Service" as Users
participant "Audit-Log" as Audit

Administrator -> UI: Rolle ändern
activate UI
UI -> Users: PUT /api/users/{id}/role
activate Users
alt Änderung zulässig
  Users -> Audit: Eintrag schreiben
  Users --> UI: 200 OK (aktualisierter Benutzer)
else Letzter Administrator
  Users --> UI: 409 Conflict (abgelehnt)
end
deactivate Users
UI --> Administrator: Ergebnis anzeigen
deactivate UI
```

### Zustandsdiagramm

Das folgende Diagramm zeigt die möglichen Rollen eines Kontos und die erlaubten
Übergänge (durch einen Administrator ausgelöst).

```plantuml
[*] -down-> Viewer : Erste Anmeldung\n[nicht erster Benutzer]
[*] -down-> Admin : Erste Anmeldung\n[erster Benutzer]
Viewer -right-> Editor : Hochstufen
Editor -left-> Viewer : Herabstufen
Editor -up-> Admin : Hochstufen
Admin -down-> Editor : Herabstufen\n[nicht letzter Admin]
Viewer -down-> [*] : Konto entfernen
Editor -down-> [*] : Konto entfernen
Admin -down-> [*] : Konto entfernen\n[nicht letzter Admin]
```

## Relevante Anforderungen

* REQ-ADM-1
* REQ-ADM-2
* REQ-ADM-3
* REQ-ADM-4
* REQ-ADM-7
