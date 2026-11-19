# Slow Tide on the desktop

The same game files as the web version, in a window of its own: an Electron app that serves the
game from a private `app://` address (nothing is fetched from the internet), keeps running at full
speed when it's behind another window, uses the real graphics card, and goes full screen with F11.
A controller works as soon as you press a button on it. Players get it from the game's download
page (`download.html` on the site), which links to the newest GitHub release.

## Try it

```bash
cd desktop
npm install          # Electron and electron-builder, once
npm start            # runs the game straight from the repository
```

## Build an installer here

```bash
node tools/build-sw.mjs                                   # (from the repository root) the game's file list
cd desktop
npm run pack                                              # copies those files into desktop/game/
npx electron-builder --linux AppImage --publish never     # or --win nsis, or --mac dmg zip
```

The installers land in `desktop/dist/`, named as the download page links them:
`Slow-Tide-Setup-x64.exe` (Windows, NSIS), `Slow-Tide-arm64.dmg` and `Slow-Tide-x64.dmg` (Mac;
the `Slow-Tide-mac-*.zip` beside them are what a Mac updates from), `Slow-Tide-x86_64.AppImage`
(Linux), with `latest.yml`, `latest-mac.yml` and `latest-linux.yml`, the feed the installed apps
read. A Windows installer is best built on Windows and a Mac one on a Mac; the CI does each on its
own runner. `desktop/game/`, `desktop/dist/` and `desktop/node_modules/` are not kept in the
repository.

## Release a version

```bash
git tag v0.2.0
```

```bash
git push origin v0.2.0
```

The **Desktop** workflow (`.github/workflows/desktop.yml`) builds the three on Windows, macOS and
Ubuntu runners, sets the app's version from the tag, and creates the GitHub release with every
installer, its blockmap and the `latest*.yml` feed. The download page's links (`releases/latest/
download/…`) and the installed apps' updates both follow the newest release, so nothing else needs
changing. Run the workflow by hand (Actions → Desktop → Run workflow) to build without releasing:
the installers are kept as the run's artifacts for a week.

## Signing

Without signatures the installers work, but the first launch asks (the download page explains what
to click): Windows SmartScreen says "Windows protected your PC", macOS says it can't verify the
developer. With the repository's secrets set (Settings → Secrets and variables → Actions), the
workflow signs them:

| Secret | What it is |
|---|---|
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | A Windows code-signing certificate (.pfx, base64) and its password |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | An Apple **Developer ID Application** certificate (.p12, base64) and its password |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | For notarisation: the Apple ID, an app-specific password for it, and the team id |

Both cost money each year (an Apple Developer Program membership; a certificate from a Windows
code-signing authority), so they're your decision; nothing has been signed up for. Each release's
notes say whether its builds were signed. Without a Developer ID the Mac app is signed ad hoc (so
Apple silicon opens it at all) and is marked unsigned; such a copy can't install an update over
itself (macOS checks the new app's signature against the old), so it says a new version is out and
its Update button opens the download page instead.

## Updates (`updates.cjs`)

- When the installed app starts (twenty seconds in, once the game has loaded) it reads the newest
  release's feed. A newer version is downloaded in the background, checked against the size and
  SHA-512 in the feed, and offered: the title screen and the journal's Update button say
  "Restart into the new version". It never restarts on its own; a version downloaded and not taken
  is installed the next time the app is quit.
- Off with the journal's *Look for a new version when the game starts* (on a Mac, also in the Slow
  Tide menu); *Check for updates* still looks when asked. The switch is kept in `settings.json` in
  the app's data folder.
- Not from a copy run with `npm start`, and on Linux only for the AppImage (which replaces itself).
- What it found and did is written to `updates.log` beside the saves folder, afresh each run.
- **Trying it with a stand-in feed:** build a copy, then build a newer one into another folder
  (`npx electron-builder --linux AppImage --publish never -c.extraMetadata.version=0.1.1 -c.directories.output=dist-next`),
  serve that folder on this computer (`python3 -m http.server 8899 --bind 127.0.0.1` inside it), and
  start the older copy with `SLOW_TIDE_UPDATE_FEED=http://127.0.0.1:8899/` (and
  `SLOW_TIDE_UPDATE_DELAY=2` to look two seconds in). Only a feed on this computer is accepted.

## Saves

The app keeps the save in its own storage, like a browser, and mirrors it on every save to a file:
`saves/slow-tide-save.json` in its data folder (Windows `%APPDATA%\Slow Tide\saves`, macOS
`~/Library/Application Support/Slow Tide/saves`, Linux `~/.config/Slow Tide/saves`). The journal's
*Open the saves folder* (and the Mac menu) opens it. On a computer with no save of its own, the game
starts from that file (`src/desktop.js`); one that has a save keeps it. The file is written whole
and then put in place, and only text that reads as a save is ever written (`tests/desktop.test.mjs`).

## What the page may do

`preload.cjs` gives the sandboxed page exactly these: mirror the save, read the mirrored save,
report an achievement, open the saves folder, and the updates (what's so, look, take it, the
switch, word of changes). No Node, no file access. Links out of the game open in the browser, and
the window never navigates away from the game's own files. On Windows and Linux there's no menu
bar (so no key the game uses opens a menu or reloads the page); on a Mac, the app's own menu.

## Steam (optional, not set up)

Achievements are ready for Steamworks: twelve, in `src/achievements.js`, each with a stable API
name, counted from the save. The app hands them over only when `npm install steamworks.js` has been
run (MIT, [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js)) **and** an app id is
given (`STEAM_APP_ID`, or a `steam_appid.txt` beside the app); without both they're dropped. The
saves folder would suit Steam Auto-Cloud. Nothing has been signed up for, and the download from the
site doesn't need any of it.
