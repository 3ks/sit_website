# SIT website

The official site for [SIT](https://github.com/3ks/sit), a worktree-first, remote-native Git workstation.

It is a plain static site: no build step, no dependencies. GitHub Pages serves the repository as it is.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**, set **Source** to *Deploy from a branch*, and choose `main` and `/ (root)`.

Every later push to `main` updates the site. All paths are relative, so it works both at
`https://<user>.github.io/<repo>/` and on a custom domain (add a `CNAME` file for that).

## Preview locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Opening `index.html` directly from disk works too.

## Layout

| Path | What it holds |
|---|---|
| `index.html` | The page. All English text lives here. |
| `assets/site.css` | Styles. The colour tokens and style families mirror the app's themes. |
| `assets/site.js` | Language, light/dark and style pickers, scroll reveal, release links. |
| `assets/i18n/<lang>.js` | One dictionary per language, loaded when that language is chosen. |
| `assets/logo.svg`, `assets/icon.png` | Favicon and app icon. |
| `.nojekyll` | Tells GitHub Pages to serve the files without running Jekyll. |

## Languages

English is the default. The picker offers the app's six languages (English, 简体中文, 繁體中文, 日本語,
Français, Español) and remembers the choice; `?lang=zh-CN` (or `zh-TW`, `ja`, `fr`, `es`) links straight to one.

To change text, edit the English in `index.html` and the same `data-i18n` key in each file under `assets/i18n/`.
A key missing from a dictionary falls back to English.

## Download buttons

The buttons link to `https://github.com/3ks/sit/releases/latest`. When the page loads it asks the GitHub API
for the latest release and, if that works, points each button at its file and shows the version and size.
Both need the releases of `3ks/sit` to be publicly readable. To use another repository, change `REPO` in
`assets/site.js` and the release links in `index.html`.
