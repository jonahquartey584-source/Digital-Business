# Random Artist Generator

A simple client-side web app that picks a random artist from a curated pool
of 100 of the most popular music artists of all time — including Michael
Jackson.

## Features

- 🎲 One-click random artist generator with a genre tag for each pick
- 🔁 "Don't repeat until all 100 shown" mode, so you cycle through the whole
  list before anyone repeats (can be turned off for pure random draws)
- 🔗 Quick search link to look the artist up
- 📜 "View full list" modal to browse all 100 names

## Running it

This is a static site with no build step or dependencies. Just open
`index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — page markup
- `style.css` — styling
- `artists.js` — the data set of 100 artists (`name` + `genre`)
- `script.js` — generator logic (random pick, no-repeat pool, list modal)

## Customizing the artist list

Edit `artists.js` and add/remove `{ name: "...", genre: "..." }` entries.
The app automatically adapts to however many artists are in the array.
