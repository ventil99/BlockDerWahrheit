# Wizard-Punktezähler

Dieser Kontext beschreibt die Begriffe für die App, mit der Punkte einer Wizard-Partie erfasst werden.

## Sprache

**Wizard-Partie**:
Eine vollständige Partie des Kartenspiels Wizard, in der über mehrere Runden Punkte gesammelt werden.
_Avoid_: Spielrunde (bezeichnet einen einzelnen Abschnitt innerhalb einer Partie)

**Punktezähler**:
Das Hilfsmittel, mit dem die Punkte einer Wizard-Partie erfasst werden.
_Avoid_: digitale Spielversion

**Partiensammlung**:
Die im Browser gespeicherten Wizard-Partien einer Person; mehrere Partien können gleichzeitig offen oder abgeschlossen sein.
_Avoid_: aktive Partie

**Partienvorlage**:
Eine neue Partie, die aus einer gespeicherten Partie erzeugt wird und deren Spielenden sowie Einstellungen übernimmt. Sie beginnt ohne Punkte und Ereignisse; Spielende und Einstellungen können vor dem Start bearbeitet werden.
_Avoid_: Spielstandkopie

**Partienimport**:
Das Einlesen einer JSON-Datei, die alle Partien einer Partiensammlung enthält; dabei wird die bisherige Sammlung im Browser vollständig ersetzt.
_Avoid_: Partien zusammenführen

**Stichrunde**:
Ein Abschnitt einer Partie, in dem alle Personen eine Vorhersage machen, Stiche spielen und Punkte erhalten.
_Avoid_: Partie

**Vorhersage**:
Die Anzahl der Stiche, die eine Person vor Beginn einer Stichrunde ansagt, dass sie gewinnen wird. Eine Wolke kann die Vorhersage während der Stichrunde verändern.
_Avoid_: Tipp

**Vorhersagesumme**:
Die Summe der vor Beginn abgegebenen Vorhersagen aller Personen für eine Stichrunde.
_Avoid_: Gesamtzahl der Stiche

**Stich**:
Die Karten, die alle Personen in einer Stichrunde reihum ausspielen; normalerweise gewinnt eine Person den Stich.
_Avoid_: Zug

**Sonderkarte**:
Eine Wizard-Karte mit einem besonderen Effekt, der über den normalen Kartenwert hinausgeht.
_Avoid_: Zusatzkarte

**Bombe**:
Eine Sonderkarte, durch die niemand den Stich gewinnt; dieser Stich zählt keiner Person als gewonnener Stich.
_Avoid_: Null-Stich

**Wolke**:
Eine Sonderkarte, durch die die Person, die den Stich gewinnt, ihre Vorhersage um eins erhöht oder verringert. Liegt auch eine Bombe im Stich, wird die Vorhersage nicht verändert.
_Avoid_: Wolkenkarte

**Hexe**:
Eine Sonderkarte, mit der eine Karte aus dem Stich gegen eine Handkarte getauscht werden kann. Eine so zurückgenommene Bombe oder Wolke kann später erneut ausgespielt werden.
_Avoid_: Hexenkarte

**Geber**:
Die Person, die zu Beginn einer Stichrunde die Karten austeilt.
_Avoid_: Austeiler
