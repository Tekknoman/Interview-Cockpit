# Interview Cockpit

Eine statische Web-App für ein Interview auf dem iPad. Kein Konto, keine API-Keys, keine Installation von Abhängigkeiten. Der vorbereitete Leitfaden enthält 14 Fragen in fünf Themenbereichen und 55 Minuten Zeitbudget mit Einstieg und Abschluss.

## Automatisches Deployment auf GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` prüft JavaScript und führt die Anwendungstests aus. Nach einem erfolgreichen Push auf **`prod`** wird der Inhalt von **`dist`** auf GitHub Pages veröffentlicht. Pull Requests nach `prod` führen nur Prüfungen aus. Über **Actions → Test and deploy Interview Cockpit → Run workflow** kann der Workflow zusätzlich manuell für `prod` gestartet werden.

GitHub Pages muss unter **Settings → Pages → Build and deployment → Source → GitHub Actions** ausgewählt sein. Für das Deployment sind keine eigenen Tokens oder API-Keys nötig; der Workflow nutzt den eingeschränkten `GITHUB_TOKEN` mit Pages- und OIDC-Berechtigungen. Die Site-URL steht im Deployment-Job und im `github-pages`-Environment.

### Repository-Aufbau

- `dist/`: unmittelbar veröffentlichbare statische App mit 14 vorbereiteten Leitfragen.
- `tests/`: automatisierte Tests für Zeitberechnung, Protokoll und Wiederherstellung.
- [`integrations/davinci-resolve/`](integrations/davinci-resolve/): Python-Script, das den CSV-Export als Fragenmarker in eine Resolve-Timeline importiert, mit Sync-Abgleich, Vorschau und Installationsanleitung.
- `.github/workflows/deploy-pages.yml`: Prüfung und Pages-Deployment.
- `PRUEFUNG.md`: dokumentierter Prüfstand der ersten App-Version.

Alle App-Pfade sind relativ; Projekt-Unterpfade auf GitHub Pages werden unterstützt. Es ist kein Build und kein Backend nötig. Nur `dist` wird veröffentlicht. Sitzungsdaten, Notizen und Backups werden nicht in das Repository übertragen.

Offizielle Anleitung: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Auf dem iPad vorbereiten

- Die veröffentlichte Seite einmal **online in Safari** öffnen und warten, bis «Offline bereit» angezeigt wird. Danach einen Offline-Neustart ausprobieren.
- Optional **Teilen → Zum Home-Bildschirm**. Für das echte Interview dieselbe Safari-Seite bzw. dieselbe installierte App verwenden; deren Speicher kann getrennt sein.
- Mit **Aa** Schriftgrösse und helles/dunkles Erscheinungsbild einstellen. Der Vollbild-/Fokusmodus zeigt Weiss auf Schwarz, nutzt den Bildschirm mit automatisch angepasster Schrift und kompakten Nachfragen und visualisiert Frage- sowie Interviewzeit mit Balken. Grün mit Minus bedeutet Zeitreserve bzw. Vorlauf, Rot mit Plus bedeutet Überziehung bzw. Verzögerung. Die weisse Markierung im Interviewzeitbalken zeigt den geplanten Zeitstand. Der ursprüngliche Übersichtsmodus behält sein bisheriges Design. Übergangshilfen lassen sich im Vollbild aufklappen. Auf Geräten ohne Fullscreen-API funktioniert dasselbe reduzierte Layout innerhalb des Browserfensters.
- Vor dem echten Interview Lautstärke, Sync-Ton, Kamera, externes Aufnahmegerät und automatische Sperre am tatsächlichen iPad testen. Die App nimmt selbst kein Audio oder Video auf.
- Die Bestätigungen im Startbildschirm setzen und **Interview starten**. Die ersten drei Minuten gehören zum Einstieg. Weiter zur ersten Leitfrage, sobald ihr bereit seid.

## Während des Gesprächs

- **Nächste Frage** schliesst den aktuellen Abschnitt und startet den nächsten mit einem genauen Gerätezeitstempel.
- **Zurück** startet einen neuen Besuch der vorigen Frage. Der frühere Besuch bleibt im Protokoll. Das ist kein nachträgliches Rückgängigmachen.
- Ein Themenbereich öffnet die Fragenübersicht für einen direkten Sprung. Nicht besuchte Fragen werden nicht automatisch als erledigt markiert. Sprünge behalten ihren tatsächlichen Verlauf.
- Die **Hauptfrage** enthält farbige, fette Betonungen. Darunter stehen ein Übergangsvorschlag, optionale Nachfragen und ein kurzer Hinweis. Übergänge sinngemäss verwenden, nicht ungeprüft Aussagen des Gegenübers unterstellen.
- **Clip markieren** setzt sofort einen Zeitmarker. Dessen Titel und Notiz lassen sich später im Protokoll ergänzen. Die Marke bezeichnet einen Moment, nicht automatisch einen ganzen 30–60-Sekunden-Clip.
- **Notiz** gehört zur aktuellen Frage und wird bei jeder Eingabe gespeichert.
- **Pause** hält nur die aktive Interviewuhr an. Auch bei Fragenwechsel während einer Pause wird keine Pausenzeit als aktive Fragezeit gezählt. Die Aufnahmezeit läuft weiter.
- **Interview beenden** schliesst die letzte Frage nach Rückfrage. Über das Protokoll lässt sich auch früher abschliessen. Die externe Aufnahme separat beenden.
- Tastatur: `→` weiter, `←` zurück, `Leertaste` Pause/Weiter, `M` Marker. In Notizfeldern bleiben Tastatureingaben normale Texteingaben.

## Zeitangaben richtig lesen

1. **Interviewzeit:** Summe aller laufenden Intervalle; explizite Pausen ausgenommen. Eine Bildschirmsperre oder ein Neuladen ist keine Pause.
2. **Fragenzeit:** Aktive Zeit aller Besuche derselben Frage. Wiederholte Besuche werden für das Budget addiert, im Protokoll separat aufgeführt.
3. **Zeitplan:** Abweichung vom kumulierten Budget vor der aktuellen Frage; nach Überschreiten ihres Budgets fliesst auch die aktuelle Überziehung ein. Frühere Zeitersparnis oder Überziehung bleibt sichtbar. Bei Sprüngen wird gegen die ursprüngliche Reihenfolge gerechnet.
4. **Aufnahmezeit:** Zeit seit dem zugeordneten Sync-Punkt plus eingestelltem Video-Versatz. Läuft auch in Interviewpausen weiter. Vor dem ersten Sync gibt es bewusst keine errechnete Aufnahmezeit.
5. **Uhrzeit:** Gerätezeit; JSON und CSV enthalten ISO-Zeitstempel mit UTC-Kennung. Die Ansicht zeigt die lokale Zeitzone des Geräts.

Gerätezeit während des Interviews nicht manuell umstellen. Die App verwendet absolute Zeitanker, damit sie nach Browser-Schlaf und Neuladen wieder korrekt weiterrechnet. Eine manuelle Änderung der Systemuhr verändert diese Grundlage.

## Video und Audio synchronisieren

1. Alle Aufnahmegeräte starten, Lautsprecher des iPads hörbar halten.
2. **Aufnahme synchronisieren → Sync-Ton auslösen** tippen. Es ertönen drei kurze Töne; zusätzlich blitzt der Bildschirm weiss auf. **Der Beginn des ersten Tons** ist die Referenz.
3. Der Punkt erhält zunächst Aufnahmezeit `00:00`. Für den Schnitt zur ersten Tonflanke springen.
4. Wenn die tatsächliche Videodatei an dieser Stelle beispielsweise schon `00:12` läuft, unter «Videozeit beim Sync» `00:12` eintragen. Aufnahmezeiten ab diesem Punkt werden neu berechnet.
5. Bei einer neuen Videodatei einen neuen Sync-Punkt setzen. Jede Referenz hat eine eigene ID. Die vollständige Sync-Liste ist im JSON enthalten. In der Oberfläche lässt sich der jeweils letzte Sync korrigieren; ältere Punkte können bei Bedarf nach dem Export über die JSON-Sync-Liste abgeglichen werden.

Ohne Ton alternativ beim Klatschen **Jetzt manuellen Sync setzen** tippen. Die manuelle Variante ist gröber. Töne sind bewusst nur manuell auslösbar. Es gibt keine störenden Zeitwarnungen während Antworten. Audioausgabe, Bluetooth und menschliche Reaktion verursachen Verzögerungen; dies ist keine framegenaue Timecode-Hardware.

## Sicherung und Wiederherstellung

Fragenwechsel, Marker, Notizen, Start/Pause und Bildschirmstatus werden sofort im lokalen Browser-Speicher abgelegt. Eine zweite Kopie und Prüfsummen helfen bei einem beschädigten Eintrag. Das ist eine lokale Redundanz, kein unabhängiges Cloud-Backup.

- Nach Neuladen bleibt eine laufende Sitzung laufend; die Zeit seit dem letzten Zeitanker zählt weiterhin. Eine pausierte Sitzung bleibt pausiert.
- Bildschirmsperre und Hintergrundwechsel ändern nicht eigenmächtig den Gesprächsstand. Wake Lock versucht bei laufendem Interview die automatische Sperre zu vermeiden und wird bei Rückkehr erneut angefordert. Betriebssystem und Energiesparen können dies verhindern.
- Bei Speicherfehlern erscheint eine deutliche Meldung. Dann sofort **Sitzungs-Backup** exportieren und die Seite nicht schliessen.
- Änderungen aus einem zweiten Tab sperren den älteren Tab, damit er den neueren Stand nicht überschreibt. Für das Interview nur einen Tab verwenden.
- **Sitzungs-Backup sichern** erstellt eine JSON-Datei mit Leitfaden, Verlauf, Notizen und Zeitankern. Die Kopie wird zum Exportzeitpunkt eingefroren und beim Import pausiert wiederhergestellt; die tatsächliche Sitzung läuft durch den Export weiter.
- **Interview laden → JSON-Datei auswählen** kann ein Backup auf diesem oder einem anderen Gerät wiederherstellen. Der bisherige Browserstand wird erst nach ausdrücklicher Bestätigung ersetzt.

Eine absolute Verlustgarantie ist in einer Browser-App nicht möglich: Browserdaten löschen, privates Surfen, Betriebssystem-Speicherbereinigung, ein anderes Browserprofil oder ein anderes Gerät können den lokalen Stand entfernen. Vor und nach dem Interview Backups in «Dateien» ablegen. Exportierte Dateien werden nicht selbstständig verschickt. Die App verwendet keine externen Schriften, Analysedienste oder Cloud-Datenbanken.

## Protokoll exportieren

Über **Protokoll** jederzeit, auch während des Gesprächs:

- **CSV:** Semikolongetrennt, UTF-8 mit BOM für Excel. Beginn und Ende, Bereich, Frage, aktive Dauer, Aufnahmezeit und Notizen. Potenzielle Excel-Formeln in Textfeldern werden entschärft.
- **Lesbares Protokoll:** Textdatei mit chronologischem Verlauf.
- **JSON:** Strukturierte Schnittdaten mit Millisekunden-Zeitstempeln und vollständigen Ereignissen.
- **Teilen / Dateien:** System-Teilen, wenn Dateifreigabe unterstützt wird; ansonsten normaler Download.
- **Sitzungs-Backup:** Wiederherstellbarer Stand, im Unterschied zum reinen Schnittprotokoll.

Noch laufende Fragen haben beim Zwischenexport ein offenes Ende. Die Datei zeigt den Stand beim Export. Das abschliessende Protokoll nach dem Beenden erneut exportieren.

## Eigene Interviews als JSON

Beispiel: `dist/beispiel-interview.json`. Schema: `dist/interview.schema.json`. Der aktuelle Leitfaden kann direkt aus der App als Vorlage exportiert werden. Importierte JSON-Daten werden validiert; unbekannte Zusatzfelder werden im Leitfaden verworfen. Inhalte werden nicht als HTML ausgeführt.

```json
{
  "version": 1,
  "title": "Mein Interview",
  "guest": "Gesprächspartner",
  "introSeconds": 180,
  "outroSeconds": 120,
  "sections": [{
    "id": "A",
    "title": "Einstieg ins Thema",
    "color": "mint",
    "questions": [{
      "id": "frage-1",
      "text": "Was bedeutet für Sie **erfolgreiche Kommunikation**?",
      "seconds": 180,
      "essential": true,
      "transition": "Beginnen wir mit Ihrer persönlichen Sicht.",
      "followUps": ["Haben Sie ein **konkretes Beispiel**?"],
      "hint": "Erst zuhören, dann vertiefen."
    }]
  }]
}
```

`seconds` ist das aktive Zeitbudget. Farben: `mint`, `blue`, `amber`, `violet`, `rose`. IDs müssen eindeutig sein; `__intro` und `__outro` sind reserviert. Haupttext mit `**Betonung**` formatieren. Den vollständigen Übergang zur Frage unter `transition` hinterlegen. Maximal 30 Bereiche, insgesamt 200 Fragen, pro Frage 12 Nachfragen. Zeitbudget je Abschnitt 10–7200 Sekunden.

## Entwicklung und Prüfung

Im Repository:

```sh
node --test tests/*.test.mjs
python3 -m http.server 8080 --directory dist
```

Dann `http://localhost:8080` öffnen. Doppelklick auf `index.html` per `file://` genügt nicht, da Leitfaden und ES-Module über HTTP(S) geladen werden.

Die Tests prüfen Zeitberechnung nach Browser-Schlaf, Pausen, Rücksprünge, mehrfache Syncs, Protokoll, beschädigte Sicherungen und JSON-Validierung. Browserprüfung ergänzt Start, Navigation, Notizen, Wiederherstellung, Sync-Korrektur und Abschluss. Tatsächliche iPad-Sperre, Safari-Dateifreigabe und Lautsprecher müssen auf dem Zielgerät geprüft werden.

Bei einer neuen App-Version `CACHE` in `sw.js` erhöhen. Ein neuer Service Worker wartet, bis alte App-Tabs geschlossen sind; so wird eine laufende Sitzung nicht durch ein Update unterbrochen. Danach neu öffnen. Der alte und neue Stand teilen die gleiche versionierte Sitzungsstruktur.

## Technische Referenzen

- Screen Wake Lock, W3C: https://www.w3.org/TR/screen-wake-lock/
- Service Worker, MDN: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- GitHub Pages: siehe Veröffentlichungsanleitung oben.

Leitfaden: Interviewvorbereitung Markus Graf Colombo, fünf Themenbereiche A–E, 14 Fragen; drei Minuten Einstieg und zwei Minuten Abschluss zusätzlich zu 50 Minuten Leitfragen.

### Resolve ohne Script: Marker-EDL

Unter **Protokoll → Resolve EDL** lässt sich die aktuelle Sitzung direkt exportieren. Dort kann auch ein älteres Cockpit-CSV geladen werden, ohne die laufende Sitzung zu ersetzen. Bildrate (inklusive Drop-Frame-Auswahl), Timeline-Start und den Timeline-Timecode beim **Beginn des ersten Sync-Tons** einstellen. Der vorausgefüllte Sync-Timecode setzt voraus, dass die Aufnahme am Timeline-Anfang liegt; bei versetzten Clips den tatsächlichen Timecode übernehmen.

Fragen werden als blaue Bereichsmarker, Clip-Markierungen als gelbe Punktmarker ausgegeben. Optional sind reine Punktmarker möglich. Pausen zählen zur Aufnahmezeit. Bei mehreren Sync-Punkten jedes Aufnahmesegment separat exportieren; ausgelassene Einträge werden angezeigt. Offene Fragen und Fragen, deren Ende in ein neues Segment fällt, erhalten einen Punktmarker. Einträge vor dem ersten Sync lassen sich nicht automatisch zuordnen. Gleiche Framepositionen werden in einem Marker zusammengefasst. Notizen werden dem Markertitel angehängt.

In Resolve: **Timeline im Media Pool rechts anklicken → Timelines → Import → Timeline Markers from EDL**. Die EDL nicht als neue Schnitt-Timeline importieren. Vorhandene Marker an denselben Stellen vorher prüfen. Die eigentliche Aufnahme muss weiterhin anhand des Sync-Tons ausgerichtet werden; das EDL synchronisiert keine Medien. Der Import ist anhand des Resolve-Marker-EDL-Formats umgesetzt und automatisiert geprüft; ein Test in einer installierten Resolve-Version steht aus. Das [Python-Script](integrations/davinci-resolve/README.md) bleibt als Alternative erhalten.

### Leseschrift

Die App verwendet lokal eingebundenes **Atkinson Hyperlegible Next** (variable Schrift, SIL Open Font License unter `dist/fonts/OFL.txt`). Quelle: [Braille Institute](https://www.brailleinstitute.org/freefont/) und [Google Fonts](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext). Die Schrift bleibt offline verfügbar. Im Fokusmodus: helle Schrift `#f5f5f5` auf Schwarz, weisse fett gesetzte Betonungen, normale Buchstabenabstände und Zeilenhöhe 1,32. Rot und Grün kennzeichnen weiterhin ausschliesslich die Zeitabweichung.

### Vollbild: links/rechts halten

In der laufenden Frage links auf einer freien Fläche gedrückt halten, um zurückzugehen, rechts für die nächste Frage. Buttons, Eingabefelder, Übergang und Dialoge bleiben normal bedienbar. Die Funktion lässt sich unter **Lesen & Einstellungen → Links / rechts halten** ausschalten. Die Gesamthaltezeit ist von 300 bis 2000 ms einstellbar, standardmässig 600 ms. Nach 350 ms ist der Kreis am Berührungspunkt voll; danach bleiben mindestens 250 ms zum Loslassen und Abbrechen. Dieses feste Abbruchfenster ist eine Bedienentscheidung, keine garantierte menschliche Reaktionszeit. Bei stockender Darstellung wird das Fenster verlängert, sodass es nicht unbemerkt verstreicht.

Loslassen, mehr als 18 CSS-Pixel Wegziehen, Scrollen, eine zweite Berührung, Fensterwechsel, Bildschirmsperre oder Öffnen eines Dialogs brechen die Geste ab. Pro Berührung erfolgt höchstens ein Fragenwechsel. Am Ende bleibt die Abschlussbestätigung erhalten. Der Fragenwechsel nutzt denselben protokollierten Ablauf wie die normalen Navigationsbuttons.

Optional kurzes Vibrationsfeedback bei vollem Kreis und bei Auslösung, sofern Browser und Hardware es unterstützen. Die Funktion verwendet die standardisierte Vibration API und bleibt auf nicht unterstützten Geräten rein visuell. Safari/iPad bietet diese API üblicherweise nicht an; es werden keine versteckten Schalter oder Audioeffekte als Haptik-Ersatz verwendet. Die Schrifteinstellungen und das Interview bleiben unverändert gespeichert.

### Persönliche Bezüge zu Markus Graf Colombo

Der Standardleitfaden enthält seit 18.11.2026 belegte Bezüge zu Unternehmertum, BWZ-Unterricht, OneNote / selbstorganisiertem Lernen und Innovationscoaching. [Recherche mit Quellen, Gesprächsanlässen und offenen Punkten](research/Markus-Graf-Colombo-Interviewbezug.md). [Separate Importdatei](dist/interview-markus-persoenlich.json).

Bestehende Sitzungen behalten ihren eingebetteten Leitfaden. Nach App-Aktualisierung unter **Interview laden → Standardinterview neu starten** übernehmen; zuerst die bisherige Sitzung als Backup sichern. Die Struktur bleibt bei 14 Hauptfragen und 55 Minuten. Zusatznachfragen sind Alternativen, keine zusätzliche Fragenliste zum vollständigen Abarbeiten.

### Vollbild mit Bereichsfarben und Fragepunkten

Die Vollbild-Fragenleiste ist 8 px hoch und in die Themenbereiche gegliedert. Jede Frage erhält einen gleichmässig verteilten Punkt; Bereichsbreiten folgen der Anzahl Fragen, nicht den Minutenbudgets. Abgeschlossene Fragen sind kräftig, kommende und übersprungene Fragen blass. Die aktuelle Frage hat einen grösseren offenen Ring. Die Zeitbalken bleiben eine separate Darstellung des Zeitbudgets.

Farben aus der Gruppierungstabelle der bereitgestellten Datei `Interview-Leitfaden.docx`: A Pfirsich `#FAE2D5`, B Grün `#C1F0C7`, C Rosa `#F2CEED`, D Hellblau `#CAEDFB`, E Gelb `#FFFFCC`. Für D enthält die Fragentabelle das leicht abweichende `#C1E4F5`; verwendet wird die Farbe der Bereichsübersicht.

Bereichstitel, Position im Bereich und Kernfrage sind im Vollbild sichtbar. Moderationshinweise und Wiederholungsbesuche werden ebenfalls eingeblendet und bei der automatischen Anpassung der Frage berücksichtigt. Auf der letzten Frage eines Bereichs kündigt rechts eine dezente Markierung in der Farbe des nächsten Bereichs die Übergabe an. Nach Bereich E erscheint keine weitere Bereichsübergabe. Normalansicht, Navigation und Protokollierung behalten ihr Verhalten.
