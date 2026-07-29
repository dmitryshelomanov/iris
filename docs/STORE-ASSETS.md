# Store assets map — Iris

What lives under `docs/` for App Store / Google Play listings, how to regenerate it, and what to upload where.

App icon and splash used **inside the binary** live in [`assets/images/`](../assets/images/) (wired via [`app.json`](../app.json)) — they are not listing uploads except where noted below.

## Layout

```
docs/
  STORE-ASSETS.md              ← this file
  privacy.md                   ← policy source note + live URL
  images/                      ← README only (not store listings)
  store-screenshots/
    src/                       ← raw captures for generators (keep)
    01-cover.png … 06-looks.png   ← iPhone marketing set (1290×2796)
    android/
      framed-*.png             ← Play phone screenshots (1080×1920)
  play-store/
    PLAY-CONSOLE.md            ← Android release / upload runbook
    LISTING.md                 ← Play short/full description
    DATA-SAFETY.md             ← Play Data safety answers
    feature-graphic.png        ← 1024×500
    icon-512.png               ← Play listing icon
```

iOS App Store Connect docs (`docs/app-store/`) are **not** written yet — only the iPhone screenshot set above is ready.

## What to upload

| File                                     | Size      | Destination                                                         |
| ---------------------------------------- | --------- | ------------------------------------------------------------------- |
| `store-screenshots/01–06.png`            | 1290×2796 | App Store Connect → iPhone 6.9" class                               |
| `store-screenshots/android/framed-*.png` | 1080×1920 | Play Console → Phone screenshots                                    |
| `play-store/feature-graphic.png`         | 1024×500  | Play Console → Feature graphic                                      |
| `play-store/icon-512.png`                | 512×512   | Play Console → Store listing icon                                   |
| `assets/images/icon.png`                 | 1024×1024 | App binary (Expo); not a separate Play upload if you use `icon-512` |
| `docs/images/screenshot-*.png`           | —         | README only                                                         |

Privacy policy URL (both stores): https://dmitryshelomanov.github.io/iris/privacy/

## Regenerate

```bash
npm run screenshots:store   # iPhone set → docs/store-screenshots/*.png
npm run screenshots:play    # feature graphic, icon-512, android/framed-*.png
```

Run `screenshots:store` before `screenshots:play` if you changed captions or iOS marketing frames — Play `framed-*` are resized from those PNGs.

## Do not commit

| Path                           | Why                                              |
| ------------------------------ | ------------------------------------------------ |
| `dist/android/*.apk` / `*.aab` | Local EAS build artifacts (gitignored)           |
| `build-*.apk` / `build-*.aab`  | EAS local output in repo root (gitignored)       |
| `*.jks` / keystore passwords   | Signing secrets — keep in EAS + password manager |

## Related docs

- Android release: [`play-store/PLAY-CONSOLE.md`](play-store/PLAY-CONSOLE.md)
- Play listing copy: [`play-store/LISTING.md`](play-store/LISTING.md)
- Play Data safety: [`play-store/DATA-SAFETY.md`](play-store/DATA-SAFETY.md)
- Privacy: [`privacy.md`](privacy.md)
