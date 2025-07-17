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

## Contributing
Laget av Simen