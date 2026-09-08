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
