# ethanmixter.github.io

Static GitHub Pages landing page for Ethan Mixter.

## FPS Chess

Run `python3 -m http.server 8000` from this directory, then open
http://localhost:8000/fps-chess/ in a desktop browser.

You play White against the computer. Click a piece and a highlighted square to
move. Captures start a duel: click to enter, use WASD to move, aim with the mouse,
and left-click to shoot. Escape pauses combat.

This prototype uses simplified chess rules (no check, castling, en passant,
promotion, or match-ending king capture). Reload to start over. Internet access
is required for the Three.js, Tailwind CSS, and Font Awesome CDN assets.

The game is a static page at `fps-chess/index.html`, ready for GitHub Pages.

## Kepler Drift

A space colony tycoon at `kepler-drift/index.html`. It opens with an animated story
(Earth falls to pirates and Brian Wilson escapes in his homemade ship), then you mine,
build stations, balance power and fight pirate raids from a 3D turret. Serve it over
HTTP (GitHub Pages or `python3 -m http.server`); opening the file directly won't load
the 3D models. Internet access is required for the Three.js CDN and Google Fonts.
The models and art were made in Blender; `models/`, `tex/` and `sprites/` hold the exports.

### Kepler Drift cloud saves (optional)

Progress always saves in the browser, and save codes move it between devices.
To turn on "Sign in with Google" so saves follow a Google account:

1. At https://console.firebase.google.com create a project (Analytics can be off).
2. Project settings → Your apps → add a **Web** app. Copy `apiKey`, `authDomain`,
   `projectId` and `appId` into `kepler-drift/firebase-config.js`.
3. Build → Authentication → Get started → Sign-in method → enable **Google**.
4. Authentication → Settings → Authorized domains → add `ethanmixter.com`
   (and `ethanmixter.github.io`).
5. Build → Firestore Database → Create database (production mode), then set Rules to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Each player's save is stored at `saves/{their uid}` and only they can read or write it.
