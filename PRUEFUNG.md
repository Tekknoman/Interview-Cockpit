# Prüfbericht

Stand: 16. November 2026.

## Automatisierte Prüfungen

16 Node-Tests bestanden (`node --test tests/*.test.mjs`).

Geprüft wurden insbesondere: 14 Leitfragen mit insgesamt 55 Minuten, Zeitberechnung nach langer Browser-Unterbrechung anhand absoluter Zeitanker, Pause und fortlaufende Aufnahmezeit, Fragenwechsel und Rücksprünge, Wechsel während Pause, mehrere Sync-Punkte, nachträgliche Videozeitkorrektur, Erkennung beschädigter Sicherungen, JSON-Validierung und reservierte IDs, CSV-Escaping, Wiederherstellung von Notizen und Markern, Abschluss während Pause sowie die benötigten Offline-Dateien.

JavaScript-Syntaxprüfung für `app.mjs` und `core.mjs` ohne Fehler. Beispielinterview validiert.

## Browserprüfung

In Chromium überprüft:

- Einverständnis- und Technikbestätigung aktivieren den Interviewstart.
- Einstieg und erste Frage, Vorwärtsnavigation sowie laufende Zeitübersicht.
- Notiz und Clip-Marker überstehen Neuladen. Pausierte Sitzung bleibt pausiert.
- Manueller Sync und Übernahme eines Videozeitcodes von 00:12.
- Sync-Ton wurde von der App erzeugt und als Referenz protokolliert. Die akustische Aufnahmequalität über externe Geräte wurde nicht gemessen.
- Sitzungs-Backup tatsächlich heruntergeladen; Inhalt enthält pausierten Stand, Notiz und Marker.
- Eigenes JSON-Beispiel über den Datei-Dialog importiert und nach Bestätigung übernommen.
- Exportiertes Sitzungs-Backup über den Datei-Dialog wiederhergestellt; ursprüngliche Fragen, Notiz und Marker vorhanden.
- Interview abgeschlossen und CSV tatsächlich heruntergeladen; Überschriften, Notiz und Sync-Bezug im Dateiinhalt geprüft.
- Offline-Neuladen: Vorschau-Webserver gestoppt und App erneut geladen. Oberfläche, Frage und Sitzungsstand erschienen weiterhin aus dem Offline-Cache. Zeit lief anhand der Zeitanker weiter. Server anschliessend wieder gestartet.
- Tablet-Hochformat mit 820 Pixel breitem Inhaltsfenster visuell geprüft; grosse Frage und Themenleiste lesbar. Zusätzlich Desktopansicht geprüft.

## Grenzen

Kein physisches iPad und kein tatsächlicher Safari-/iPadOS-Gerätesperrtest. Bildschirm-Wake-Lock, Safari-Systemteilen, Betriebssystem-Speicherbereinigung und Audio-/Video-Latenzen müssen auf dem Zielgerät geprüft werden. Zeitberechnung für Hintergrund-/Sperrphasen ist automatisiert abgedeckt; eine absolute Datenverlustgarantie ist damit nicht verbunden.

Dieser Bericht dokumentiert die lokale Prüfung vor dem ersten GitHub-Deployment. Im Repository wird `dist` über den GitHub-Pages-Workflow veröffentlicht. Den aktuellen Workflowstatus zeigt GitHub Actions.

## EDL und Leseschrift

- 24 Node-Tests und 16 Python-Tests erfolgreich, inklusive CSV-Roundtrip, Pausen, Sync-Segmente, kollidierende Marker und Drop-Frame-Grenzen.
- Schrift lokal mit Lizenz eingebunden und in Offline-Cache aufgenommen. Service Worker auf v7 aktualisiert.
- Resolve selbst ist in dieser Umgebung nicht installiert: tatsächlicher Markerimport dort noch zu prüfen.

## Haltenavigation (17.11.2026)

- 31 Node-Tests und 16 Python-Tests bestanden. Neue Tests prüfen das feste Abbruchfenster, vorzeitiges Loslassen, Wegziehen, Unterbrechung, Einzelauslösung und stockende Animation.
- Browserprüfung: rechts halten wechselt vorwärts, links zurück, 450 ms bei 600 ms Einstellung löst keinen Wechsel aus. Haltezeit und Fokus bleiben nach Neuladen erhalten. Normale Buttons bleiben bedienbar.
- Haptik ist hardwareabhängig und wurde in dieser Umgebung nicht physisch geprüft. Ein Test mit echtem iPad-Touch steht aus.
- Offline-Cache v8 enthält das neue Gestenmodul.

## Bereichsfarben im Vollbild (18.11.2026)

- 35 Node-Tests bestanden: darunter Bereichsgrenzen, übersprungene Fragen, Rücksprünge, Einstieg und Abschluss.
- Farben direkt aus den OOXML-Zellfüllungen der hochgeladenen Vorlage ausgelesen. D verwendet den Blauton der Gruppierungstabelle.
- Browserprüfung bei 1363 × 936: 14 Fragepunkte, genau ein aktueller Ring, 8-px-Leiste, farbiger Bereichstitel, Kernfrage und Moderationshinweis sichtbar. Navigation passt zusammen mit geöffneter Nachfrage in den Viewport.
- Übergabe vor B und vor C sichtbar, danach wieder ausgeblendet. Normalansicht zeigt weiterhin ihre bisherige 3-px-Leiste; neue Elemente dort ausgeblendet.
- Kein physischer iPad-Test. Offline-Cache v10 enthält das neue Darstellungsmodul.
