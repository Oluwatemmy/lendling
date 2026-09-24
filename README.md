# LENDLING

Six-scene scroll site in the style of loanmeme.io. The page never scrolls:
wheel, touch or arrow keys move between worlds one section at a time (a small
flick nudges and springs back). At rest each world plays its idle loop, so Nib
and the background never stop moving. Each scene has its own scroll move and
background layer, and everything leans with the mouse.

Run (needs Node, no install):

    node server.mjs

Then open http://localhost:5173 in a normal, visible browser tab. Opening
index.html directly from disk will not work, because the film is fetched over http.

- `main.js`: engine. `CAPTIONS`, `CODE` and the `SCENE` table (per-scene scroll move + overlay) are the parts to edit.
- `style.css`: loader, overlays, chrome.
- `assets/t1-t5.mp4`: transition legs between worlds (all-keyframe encodes, so scrubbing both ways is instant).
- `assets/i1-i6.mp4`: idle loops, one per world; each starts and ends on the frame where its world sits.
