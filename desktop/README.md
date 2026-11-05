# Slow Tide on the desktop (for Steam)

The same game files as the web version, in a window of its own: an Electron app that serves the
game from a private `app://` address (nothing is fetched from the internet), keeps running at full
speed when it's behind another window, uses the real graphics card, and goes full screen with F11.
A controller works as soon as you press a button on it.

## Try it

```bash
cd desktop
npm install          # Electron, once
npm start            # runs the game straight from the repository
```

## Build what you'd ship

```bash
npm run pack         # copies the game's files (the list in sw.js) into desktop/game/
npx electron-builder # or electron-forge: a Windows installer, a macOS app, a Linux AppImage
```

`desktop/game/` and `desktop/node_modules/` are not kept in the repository.

## Steam (what's needed, and what isn't done yet)

- **A Steamworks partner account and an app id.** Steam Direct charges a fee per game, so this is
  your decision; nothing here has been signed up for.
- **Steamworks in the app**: [steamworks.js](https://github.com/ceifa/steamworks.js) (MIT) gives
  the overlay, achievements and Steam Cloud. With the app id, `main.cjs` would call
  `steamworks.init(APP_ID)` and enable the overlay. Don't put the app id or any keys in the web
  build.
- **Achievements**: the journal's goals (`src/goals.js`) map onto them directly (every kind of
  fish, a fish of a lifetime, boats of your own, every place, Las Brasas).
- **Steam Cloud**: the save is one JSON document (`src/save.js`), so it can go to Steam Cloud as a
  file next to the browser's local storage.
- **Steam Deck**: the Linux build runs on it; the game is already controller-first. Check the text
  size at 1280×800 and the frame rate on the Deck itself.
- **A free demo** on Steam, and the browser version, bring players in.
