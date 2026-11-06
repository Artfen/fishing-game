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
- **Steam Cloud: ready, nothing to build.** The app mirrors the save to a file on every save:
  `saves/slow-tide-save.json` in its data folder (Windows `%APPDATA%/slow-tide-desktop/saves`,
  macOS `~/Library/Application Support/slow-tide-desktop/saves`, Linux
  `~/.config/slow-tide-desktop/saves`). Point Steam **Auto-Cloud** at that folder in Steamworks.
  On a computer with no save of its own, the game starts from that file (`src/desktop.js`); one
  that has a save keeps it. The file is written whole and then put in place, and only text that
  reads as a save is ever written (`tests/desktop.test.mjs`).
- **Achievements: ready to switch on.** Twelve, in `src/achievements.js` (first fish, ten kinds,
  every kind, a fish of a lifetime, every place, Las Brasas, a fleet, first job, Skipper, Master,
  the Kittiwake, The Fifth Name), each with a stable API name, title and line to enter in
  Steamworks as they are. They're counted from the save, so ones earned before the desktop build
  existed are reported the first time it's played. The app hands them to Steamworks only when
  `npm install steamworks.js` has been run (MIT, [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js))
  **and** the app id is given (`STEAM_APP_ID`, or the `steam_appid.txt` Steam puts beside the
  app). Without both they're dropped: nothing pretends to be connected. Don't put the app id or
  any keys in the web build.
- **The page stays sandboxed**: `preload.cjs` gives it exactly three calls (mirror the save, read
  the mirrored save, report an achievement) and nothing else; no Node, no file access.
- **Still to do with an app id**: the overlay (`steamworks.electronEnableSteamOverlay()`), and
  checking all of this inside a real Steam client.
- **Steam Deck**: the Linux build runs on it; the game is already controller-first. Check the text
  size at 1280×800 and the frame rate on the Deck itself.
- **A free demo** on Steam, and the browser version, bring players in.
