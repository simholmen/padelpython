# Padel Turnering i Python!

## Overview
Dette prosjektet implementerer logikken for en padel-turnering i Python. Prosjektet er en del av et større prosjekt, hvor dette inneholder bare logikken for turneringen programert i Python.

## Project Structure
```
tournament-app
├── src
│   ├── main.py          # Main python fil
│   ├── player.py        # Player klasse logikk
│   ├── tournament.py     # Turnerings klasse og logikk
└── README.md            # Prosjektets dokumentasjon
```

## Usage
For å starte prosjektet bruk denne kommandoen:
```
python src/main.py
```

## Tournament Format
- Spillere blir lagt til i turneringen
- Spiller nummer 1 og 3 spiller sammen mot spiller 2 og 4
- Etter hver runde blir listen sortert på ny, basert på resultat og poeng
- Den nye listen lager de nye lagene
- Resultater kan bli vist etter hver runde eller når turneringen er ferdig
- Walkover for ekstra personer

## Live Display (JavaScript / GitHub Pages)
`docs/` inneholder en frittstående JavaScript-versjon med et nytt, tastatur-styrt "big screen"-design (oppsett → live kamper/tabell/spotlight → finale med podium og "Lucky Loser"-hjul). Den er statisk (ingen backend) og kjører helt i nettleseren med localStorage som mellomlagring, ment for å kjøres på GitHub Pages fra `main`/`docs`. Turneringslogikken (poeng/seier-beregning, sortering) er portert 1:1 fra `src/player.py`/`src/tournament.py`, men rundebygging er utvidet med banetak (maks kamper = antall baner) og rullerende walkover-prioritering i stedet for 1v1-ekstrakamper, siden banene her kun er dobbelbaner.

For å teste lokalt:
```
python -m http.server 8000 --directory docs
```
og åpne `http://localhost:8000`.

## Contributing
Laget av Simen