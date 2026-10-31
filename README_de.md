# Search1API MCP Server

[![Smithery](https://img.shields.io/badge/Smithery-listed-6C5CE7)](https://smithery.ai/servers/superagents-lab/search1api-mcp)
[![Glama](https://img.shields.io/badge/Glama-listed-6C5CE7)](https://glama.ai/mcp/servers/superagents-lab/search1api-mcp)

[English](./README.md) | [中文文档](./README_zh.md) | Deutsch

Der offizielle MCP-Server für [Search1API](https://s1.dev/?utm_source=mcp) – Websuche, News, Seitenabruf, Sitemap-Erkennung und Trendthemen in einer einzigen API.

## Authentifizierung

- OAuth-fähige Clients können sich direkt mit der Remote-MCP-URL verbinden und sich anschließend im Browser anmelden und den Zugriff freigeben.
- Bestehende Integrationen können weiterhin einen API-Schlüssel aus dem [Search1API-Dashboard](https://dashboard.search1api.com) verwenden.
- Jede MCP-Anfrage – einschließlich der Tool-Erkennung (`initialize`, `tools/list`) – erfordert Zugangsdaten. Nicht authentifizierte Anfragen lösen die OAuth-Aufforderung aus, über die Clients die Anmeldung starten. Eine Vorabprüfung vor der Verbindung übernimmt stattdessen die statische [Server Card](https://mcp.search1api.com/.well-known/mcp/server-card.json).

## Schnellstart (Remote-MCP)

Keine Installation erforderlich. Konfigurieren Sie Ihren MCP-Client mit der Remote-URL. Verwenden Sie OAuth, wenn der Client es unterstützt, oder geben Sie einen API-Schlüssel an.

### Authentifizierung

Es werden drei Methoden unterstützt – verwenden Sie die, die Ihr Client unterstützt:

| Methode | Format |
|--------|--------|
| OAuth 2.1 | Mit `https://mcp.search1api.com/mcp` ohne Schlüssel verbinden und dem Anmeldeablauf des Clients folgen |
| Authorization-Header | `Authorization: Bearer YOUR_SEARCH1API_KEY` |
| URL-Abfrageparameter (veraltet) | `https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY` |

Bevorzugen Sie OAuth oder den Authorization-Header. Zugangsdaten in Abfrageparametern können in URLs, Logs und der Shell-Historie offengelegt werden.

### Optionale Such- und News-Oberfläche

Remote-MCP stellt `render_results` am oben genannten Standard-Endpunkt bereit. Datentools wie `search`, `news` und `ask` liefern Ergebnisse, ohne automatisch Karten anzuzeigen. Wenn eine Quellenliste hilfreich ist, kann das Modell vorhandene Ergebnisse auswählen oder kombinieren und an `render_results` übergeben. Das Tool liefert in MCP-Apps-Clients Quellenkarten und andernorts eine vollständige, gut lesbare Textliste. Das Rendern wiederholt keine Suche und verbraucht keine Such-Credits; ein UI-URL-Parameter ist nicht erforderlich.

HTTP und stdio melden beide das quadratische Search1API-Logo über die Standard-Metadaten `serverInfo.icons`. Das PNG mit 512×512 Pixeln wird öffentlich unter `https://mcp.search1api.com/assets/icon-square.png` ausgeliefert, ohne Authentifizierung und ohne Weiterleitungen. Die Server Card und das Registry-Manifest verwenden dasselbe Symbol. Die Clients entscheiden, ob sie es anzeigen; es ersetzt kein Symbol, das ein Plugin-Verzeichnis separat speichert.

Argumente, Limits und Fallback-Verhalten beschreibt der [Rendering-Vertrag](docs/render-results.md). Das npm-Paket enthält diesen Renderer ab Version 0.8.0. Aktualisieren Sie bestehende Installationen und starten Sie die MCP-Verbindung neu; `npx -y search1api-mcp@latest` startet das zuletzt veröffentlichte Paket.

Verbinden Sie sich nach einer Änderung der URL neu oder aktualisieren Sie die Tool-Definitionen des Connectors, da Clients diese zwischenspeichern können. Diese URL-Einstellung gilt nur für Remote-MCP; das Verhalten des lokalen stdio-Modus bleibt unverändert. Details und den Veröffentlichungsstatus finden Sie unter [MCP Apps UI](docs/mcp-ui.md).

### Claude Desktop

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude.ai (Web)

Installieren Sie Search1API aus dem [Claude-Verzeichnis](https://claude.ai/directory/search1api), klicken Sie auf **Connect** und melden Sie sich mit Ihrem Search1API-Konto an.

Fügen Sie `https://mcp.search1api.com/mcp` nicht über **Add custom connector** hinzu: Das erzeugt einen separaten benutzerdefinierten Connector, den Claude nach dem Host der URL (`mcp.search1api.com`) benennt, sofern Sie keinen Namen eingeben.

### Cursor

Installieren Sie das Cursor-Plugin (empfohlen): Dieses Repository enthält Agent-Plugins-Dateien `plugin.json` + `mcp.json` (portabel) sowie `.cursor-plugin/plugin.json` (Cursor-Marketplace-Metadaten / Logo) für Remote-MCP mit OAuth. Reichen Sie es über [cursor.directory](https://cursor.directory) / den Cursor Marketplace ein oder installieren Sie es dort, und melden Sie sich an, wenn Sie dazu aufgefordert werden.

Kopieren Sie die Plugin-Dateien für lokale Tests nach `~/.cursor/plugins/local/search1api` (`plugin.json`, `.cursor-plugin/`, `mcp.json`, `assets/`). Legen Sie keine symbolischen Links von außerhalb dieses Verzeichnisses an – Cursor lehnt externe Symlink-Ziele ab.

Oder konfigurieren Sie manuell:

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Antigravity

Installieren Sie das Antigravity-Plugin: `antigravity-plugin/` enthält das Manifest, `mcp_config.json` (Remote-MCP mit OAuth), den Search1API-Skill und eine README für den Marketplace. Installieren Sie es direkt von GitHub und melden Sie sich an, sobald sich der Browser öffnet:

```bash
agy plugin install https://github.com/superagents-lab/search1api-mcp/tree/main/antigravity-plugin
```

Führen Sie für lokale Tests aus einem Checkout `agy plugin validate --strict ./antigravity-plugin` und `agy plugin install ./antigravity-plugin` aus.

### VS Code

```json
{
  "servers": {
    "search1api": {
      "type": "http",
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http search1api https://mcp.search1api.com/mcp \
  --header "Authorization: Bearer YOUR_SEARCH1API_KEY"
```

### Windsurf

```json
{
  "mcpServers": {
    "search1api": {
      "serverUrl": "https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY"
    }
  }
}
```

## Agent Skill

Der Agent Skill ist zu [search1api-cli](https://github.com/superagents-lab/search1api-cli) umgezogen. Installation:

```bash
npm install -g search1api-cli
npx skills add superagents-lab/search1api-cli
```

## Lokaler Modus (stdio)

Wenn Sie den Server lieber lokal betreiben möchten, verwenden Sie Node.js 20 oder neuer mit npx – ein Klonen ist nicht nötig:

```json
{
  "mcpServers": {
    "search1api": {
      "command": "npx",
      "args": ["-y", "search1api-mcp"],
      "env": {
        "SEARCH1API_KEY": "YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

Bei selbst gehosteten HTTP-Deployments hinter einem Proxy tragen Sie alle internen Hostnamen,
die den Node.js-Prozess erreichen, in die kommagetrennte Umgebungsvariable `MCP_ALLOWED_HOSTS` ein.
`mcp.search1api.com` und localhost-Adressen sind standardmäßig erlaubt.
Browserbasierte Clients, die einen `Origin`-Header senden, müssen zusätzlich mit den Hostnamen
ihrer vertrauenswürdigen Origins in der kommagetrennten Variable
`MCP_ALLOWED_ORIGINS` eingetragen werden. Anfragen von serverseitigen MCP-Clients
enthalten normalerweise keinen `Origin` und benötigen keinen Eintrag.

## Tools

### search
Durchsucht das Web mit Search1API. Die Ergebnisse haben eine zitierfähige Struktur aus `id`/`title`/`url`. Übergeben Sie die URL eines Ergebnisses an `crawl`, wenn Sie die vollständige Seite benötigen.

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|----------|---------|-------------|
| `query` | Ja | - | Suchanfrage |
| `max_results` | Nein | 10 | Anzahl der Ergebnisse |
| `search_service` | Nein | google | google, bing, bingcn, duckduckgo, yahoo, yandex, x, reddit, github, youtube, arxiv, wechat, bilibili, imdb, wikipedia, grokipedia |
| `page` | Nein | 1 | Ergebnisseite (1–100); nur bing, bingcn, baidu und grokipedia unterstützen Paginierung |
| `crawl_results` | Nein | 0 | Anzahl der Top-Ergebnisse, deren vollständiger Inhalt abgerufen wird; jeder erfolgreiche Abruf kostet 1 Credit zusätzlich zur Suchanfrage (Grundpreis 1 Credit) |
| `include_sites` | Nein | [] | Einzuschließende Websites |
| `exclude_sites` | Nein | [] | Auszuschließende Websites |
| `time_range` | Nein | - | day, week, month, year |

Die Ergebnisse enthalten `published_date` in `metadata`, sofern die Suchmaschine es liefert; `github`-Ergebnisse ergänzen `kind`, `stars`, `language` und `num_comments`.

### news
Sucht nach Nachrichtenartikeln. `hackernews`-Ergebnisse verlinken auf den Diskussions-Thread und ergänzen `story_url`, `points` und `num_comments` in `metadata`.

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|----------|---------|-------------|
| `query` | Ja | - | Suchanfrage |
| `max_results` | Nein | 10 | Anzahl der Ergebnisse |
| `search_service` | Nein | bing | google, bing, duckduckgo, yahoo, hackernews |
| `crawl_results` | Nein | 0 | Anzahl der Top-Ergebnisse, deren vollständiger Inhalt abgerufen wird; jeder erfolgreiche Abruf kostet 1 Credit zusätzlich zur News-Anfrage (Grundpreis 1 Credit) |
| `include_sites` | Nein | [] | Einzuschließende Websites |
| `exclude_sites` | Nein | [] | Auszuschließende Websites |
| `time_range` | Nein | - | day, week, month, year |

### crawl
Extrahiert den Inhalt einer URL.

| Parameter | Erforderlich | Beschreibung |
|-----------|----------|-------------|
| `url` | Ja | Abzurufende URL |

### sitemap
Ruft alle zugehörigen Links einer URL ab.

| Parameter | Erforderlich | Beschreibung |
|-----------|----------|-------------|
| `url` | Ja | URL, deren Sitemap abgerufen werden soll |

### trending
Ruft Trendthemen beliebter Plattformen ab.

| Parameter | Erforderlich | Standard | Beschreibung |
|-----------|----------|---------|-------------|
| `search_service` | Ja | - | github, hackernews |
| `max_results` | Nein | 10 | Anzahl der Einträge |

### ask
Agentische Suche: Beschreiben Sie Ihren Bedarf in natürlicher Sprache, und Search1API wählt bis zu fünf Suchmaschinen und einen Zeitraum aus, verwirft themenfremde Ergebnisse und liefert höchstens 10 zitierfähige Ergebnisse, nach Relevanz sortiert. Das Ergebnis enthält außerdem `intent` (verwendete Stichwörter, Suchmaschinen und Zeitfenster) und `errors` (Suchmaschinen, die ausgefallen sind, während andere abgeschlossen wurden). Kostet 5 Credits pro abgeschlossener Anfrage; verwenden Sie `search`, wenn Sie die Suchmaschine bereits kennen.

| Parameter | Erforderlich | Beschreibung |
|-----------|----------|-------------|
| `query` | Ja | Die Anfrage in natürlicher Sprache, bis zu 500 Zeichen |

### send_feedback
Meldet dem Search1API-Team ein falsches, leeres oder unvollständiges Ergebnis, einen Fehler, den Sie nicht beheben konnten, eine Dokumentation, die nicht zum Verhalten passte, oder eine fehlende Funktion. Kostenlos; es werden keine Credits verbraucht. Verfügt der Server über Search1API-Zugangsdaten, wird die Meldung mit diesem Konto verknüpft, damit das Team nachfassen kann. Geben Sie keine Zugangsdaten oder privaten Daten an.

| Parameter | Erforderlich | Beschreibung |
|-----------|----------|-------------|
| `message` | Ja | Was schiefgelaufen ist oder gefehlt hat, bis zu 4000 Zeichen |
| `intent` | Nein | Was Sie erreichen wollten |
| `category` | Nein | bug, feature_request, docs, other |
| `request_id` | Nein | Request-ID des Aufrufs, bei dem das Problem auftrat |
| `model` | Nein | Name Ihres Modells |

## Versionsverlauf

- v0.7.0: Neues Tool `ask` für agentische Suche. `search` ergänzt die Suchmaschinen `bingcn`, `yandex` und `grokipedia` sowie einen Parameter `page`; `search` und `news` akzeptieren `time_range: "week"` und reichen `published_date` sowie GitHub- und Hacker-News-Felder in den Ergebnis-`metadata` durch

- v0.6.1: Fehlerbehebung – Die MCP-Erkennung (`initialize`, `tools/list`, `resources/*`, `prompts/list`, `server/discover`) erfordert wieder Zugangsdaten. Wurde sie anonym ausgeliefert, zeigten Clients, die „Tools aufgelistet“ mit „angemeldet“ gleichsetzen, einen verbundenen Zustand an, ohne dass sich der OAuth-Ablauf auslösen ließ; die 401-Aufforderung beantwortet nun jede nicht authentifizierte Anfrage und stellt so die OAuth-Anmeldung beim Verbindungsaufbau wieder her. Die Sichtbarkeit in Verzeichnissen bleibt über die statische Server Card und die Registry-Metadaten unverändert
- v0.6.0: Die MCP-Erkennung (`initialize`, `tools/list`, `resources/*`, `prompts/list`, `server/discover`) wird ohne Zugangsdaten ausgeliefert, damit Clients und Verzeichnisse Tools vor der Anmeldung auflisten können; Tool-Aufrufe erfordern weiterhin OAuth oder einen API-Schlüssel. Der stdio-Modus startet ohne `SEARCH1API_KEY` und liefert Tool-Metadaten, lehnt erst beim Aufruf ab. Fehlerhafte Anfragen werden als JSON-RPC statt als HTML-Fehlerseite beantwortet
- v0.5.4: OAuth-Issuer nach `clerk.s1.dev` verlegt und über `OAUTH_AUTHORIZATION_SERVER` konfigurierbar; MCP-Server-Card unter `/.well-known/mcp/server-card.json` veröffentlicht; OAuth-Discovery-Dokumente senden nun Cache-Header
- v0.5.3: OAuth-Ressourcen- und Tool-Metadaten erfordern keine OIDC-Sitzungs-Scopes mehr; Registry-Badges für Smithery und Glama hinzugefügt
- v0.5.2: Die MCP-`Origin`-Validierung läuft nun vor dem Parsen der Anfrage und der Authentifizierung; selbst gehostete HTTP-Deployments können vertrauenswürdige Browser-Origins über `MCP_ALLOWED_ORIGINS` konfigurieren
- v0.5.1: Dokumentation, LobeHub-Manifest und MCP-Registry-Metadaten synchronisiert; `robots.txt` wird auf dem Transport-Host ausgeliefert
- v0.5.0: Unterstützung für MCP 2026-07-28 mit automatischer Protokollaushandlung; zustandslose Kompatibilität für HTTP-Clients aus der Zeit von 2025; Authentifizierung auf Anfrageebene
- v0.4.0: Strukturierte Ausgabeschemata, OAuth-Sicherheitsschemata, Sicherheitsannotationen und Metadaten für die offizielle MCP-Registry
- v0.3.1: OAuth-2.1-Unterstützung für Remote-MCP; veraltetes Reasoning-Tool entfernt
- v0.3.0: Remote-MCP-Unterstützung über Streamable HTTP; API-Schlüssel-Authentifizierung pro Sitzung
- v0.2.0: Fallback-Unterstützung für `.env` zur LibreChat-Integration
- v0.1.8: Suchdienste für X (Twitter) und Reddit
- v0.1.7: Trending-Tool für GitHub und Hacker News
- v0.1.6: Wikipedia-Suchdienst
- v0.1.5: Neue Suchparameter und Dienste (arxiv, wechat, bilibili, imdb)
- v0.1.3: News-Suche
- v0.1.2: Sitemap
- v0.1.1: Web-Crawling
- v0.1.0: Erstveröffentlichung

## Lizenz

MIT

## UI und Drittanbieter-Quellenangaben

Die MCP-Apps-Ansicht `render_results` zeigt vorhandene Quellen als Karten mit Titeln und Domains. Jeder Client erhält zusätzlich die vollständige Text- und strukturierte Ergebnisliste. Die Komponente ist von [Rare UI](https://rareui.com) von Swami Malode übernommen und angepasst. Die zugehörigen Bedingungen (MIT + Commons Clause + Attribution) sind in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) wiedergegeben.

Einrichtung der UI, Sandbox-Origin und Release-Prüfungen: [MCP Apps UI](docs/mcp-ui.md).
