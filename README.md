# LENDLING

**A scroll-driven, interactive concept site.** Follow Nib, a fuzzy yellow vault creature, through six worlds, from a pastel stage to deep space. Your scroll wheel drives the journey instead of moving the page. Each world stays alive while you watch and reacts to your mouse and clicks in its own way.

> LENDLING is a fictional brand made for this project. It is **not** a real protocol, token or product, and nothing here is financial advice.

---

## Contents

- [The idea](#the-idea)
- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Running it locally](#running-it-locally)
- [Deploying it](#deploying-it)
- [Project structure](#project-structure)
- [Editing the site](#editing-the-site)
- [How the assets were made](#how-the-assets-were-made)
- [Limitations](#limitations)
- [Browser support and accessibility](#browser-support-and-accessibility)
- [Credits and disclaimer](#credits-and-disclaimer)

---

## The idea

The project started from studying [loanmeme.io](https://loanmeme.io), a hand-built WebGL site. Its whole page is one Three.js canvas and the wheel moves a camera through six 3D scenes. It feels alive: the mascot sways on its own, the scene tilts toward your cursor, and every section has its own interaction.

The question was: **how close can you get to that feel without a 3D pipeline?** No Blender models, no shaders, no Three.js. Only AI-generated video, plain HTML/CSS/JS and some careful engineering.

The answer is a hybrid:

- The **big camera moves between worlds** are real video, generated with AI and scrubbed frame by frame by your scroll.
- The **"alive at rest" feeling** comes from short seamless idle loops, one per world, that play whenever you stop.
- The **interactions** (tilt, parallax, cursors, clicks, particles, the jumping mascot and fleeing crowd) are drawn live in the browser on top of the video.

**What's copied and what's original.** Only the *interaction model* comes from loanmeme.io: hijacked scroll, section-by-section travel, cursor-reactive scenes, a different interaction per world. The brand, mascot, worlds, copy and all artwork are original to this project.

---

## What it does

### The six worlds

| # | World | At rest | Scroll move | Mouse | Click / small scroll |
|---|---|---|---|---|---|
| 1 | **Pastel stage** | Nib bounces and blinks; puffy "LEND / LING" letters float, wobble and squash; shapes drift | Camera dollies in, letters burst outward | Whole scene tilts; a spinning gold coin chases the cursor | Coloured spikes burst from the click; a colour wave sweeps the scene |
| 2 | **Graphic poster** | Chrome Nib sways; slogan rows slide; glass shards tumble | Camera rolls, slogans race | Scene tilts; shards parallax | The whole world tumbles and springs back; shards spin up |
| 3 | **CRT studio** | TV static flickers, cables sway, glitch marquee scrolls, scanlines crawl | Glitch shake with hue and contrast surge | Marquee bends with the mouse | Pink laser sweep, static flash and ticker glitch (also fires on its own) |
| 4 | **Sketched map** | ~260 coin creatures march around Nib; pixel words scramble | Crane-style tilt | **Pencil cursor** that draws fading ink | **Nib jumps**; the crowd scatters from the landing and walks back |
| 5 | **Code void** | Lines of code fly through 3D depth; vertical manifesto columns | Fly-through: blur and code rush | The code field turns with the mouse | All code scrambles and resolves |
| 6 | **Deep space** | Starfield twinkles; shooting stars; "EARLY GETS REWARDED." | Star warp | A light beam and lens dirt follow the cursor | Shooting star from the click |

### Controls

| Input | Action |
|---|---|
| Mouse wheel / trackpad | Small flick nudges and springs back; a bigger scroll moves exactly one world |
| Touch swipe | Same as the wheel |
| `↓` `PageDown` `Space` | Next world |
| `↑` `PageUp` | Previous world |
| `Home` / `End` | First / last world |
| Dots (bottom-left) | Jump to any world |
| SCROLL button | Next world |
| Logo (top-left) | Back to the start |

---

## How it works

### The timeline

The page never scrolls. `main.js` keeps two numbers:

- `target`: where input wants to go. Wheel, touch and keys change it.
- `cur`: where the site is. Every frame it eases toward `target`.

The six worlds sit at `cur = 0, 1, 2, 3, 4, 5`. Between two worlds, `cur` scrubs a **transition video**. A gesture can only reach the neighbouring world. When the wheel goes quiet for 160 ms, the site either commits to the next world (if you went more than 18% of the way) or springs back.

### Two kinds of video

| Kind | Files | Encoding | Purpose |
|---|---|---|---|
| Transition legs | `assets/t1–t5.mp4` | 1280 px, **every frame a keyframe** (`-g 1`) | Scrubbed by scroll, both directions, with instant seeking |
| Idle loops | `assets/i1–i6.mp4` | 1280 px, normal GOP | Play and loop while you rest in a world |

Every idle loop was generated to **start and end on the exact frame where its world sits**. That frame is also the last frame of the leg arriving there. So arriving is seamless: the loop starts from frame 0, which matches the leg's final frame. Leaving cross-fades the loop out over the scrubbing leg (380 ms).

All clips are downloaded into memory (as `Blob`s) during the loading screen, so scrubbing never waits on the network.

### The live map (world 4)

In a video the coin creatures are baked in, so they can't react. When you stop at world 4, the site fades in a **live diorama** instead:

- `assets/map-plate.png`: an empty version of the map
- `assets/nib-top.png`: a cutout of Nib that can jump, squash and stretch
- `assets/walker.png`: one coin creature, drawn ~260 times on a `<canvas>`

Each walker has a home point that wanders, so the crowd keeps marching. It springs back to its home after being pushed. When Nib lands from a jump, a radial impulse throws nearby walkers outward and loosens their springs for a moment, which opens a clearing. Then they walk back.

### Other layers

- **Mouse tilt.** The whole stage gets a perspective rotation plus a small idle sway, like a hand-held camera.
- **Overlays.** HTML/CSS layers per world: puffy letters, slogan rows, glitch marquee, pixel words, code field, manifesto, call to action.
- **Starfield.** A `<canvas>` for worlds 5 and 6. It twinkles at rest and warps with scroll speed.
- **Per-scene interactions.** These live in `interact.js`, one handler per world (`click`, `nudge`, `frame`, `leave`).

---

## Running it locally

You need **Node.js** (any recent version). There are no dependencies to install.

```bash
git clone https://github.com/<your-username>/lendling.git
cd lendling
node server.mjs
```

Open **http://localhost:5173** in a normal, visible browser tab.

To use another port:

```bash
PORT=8080 node server.mjs
```

On Windows PowerShell:

```powershell
$env:PORT=8080; node server.mjs
```

**Why a server?** The films are fetched with `fetch()`, which browsers block for pages opened straight from disk (`file://`). Any static server works (`npx serve`, VS Code Live Server and so on). `server.mjs` is a 20-line dependency-free option.

---

## Deploying it

It's a fully static site, so any static host works. No build step.

### GitHub Pages (free)

1. Push the repo to GitHub. It must be public for free Pages.
2. On github.com open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**, then choose **main** and **/ (root)**, and save.
4. After a minute or two it's live at `https://<your-username>.github.io/lendling/`.

All paths in the site are relative, so it works from a sub-path like `/lendling/`.

### Other hosts

Netlify, Vercel, Cloudflare Pages and similar hosts: deploy the folder as-is, with no build command and the output directory set to the root.

---

## Project structure

```
lendling/
├── index.html        Page markup: loader, stage, per-world overlays, chrome
├── style.css         All styling: loader, overlays, cursors, effects
├── main.js           Engine: loading, timeline, snapping, video scrub/idle, scroll moves
├── interact.js       Per-world interactions: cursors, clicks, nudges, live map
├── server.mjs        Tiny local static server (optional)
├── README.md
└── assets/
    ├── t1.mp4 … t5.mp4   Transition legs between worlds (scrubbed)
    ├── i1.mp4 … i6.mp4   Idle loops, one per world
    ├── map-plate.png     Empty map for the live diorama (world 4)
    ├── nib-top.png       Nib cutout for the live diorama
    ├── walker.png        Coin creature cutout for the crowd
    ├── nib.png           Nib cutout for logo and loader
    └── favicon.png
```

Total size is about **41 MB**, mostly the five transition legs at about 32 MB.

---

## Editing the site

| To change… | Edit |
|---|---|
| Caption text per world | `CAPTIONS` in `main.js` |
| Code lines in world 5 | `CODE` in `main.js` |
| Scroll move and overlay motion per world | the `SCENE` table in `main.js` |
| Click / nudge / cursor behaviour per world | the `SCENE` table in `interact.js` |
| How far a scroll must go to change world | `COMMIT` in `main.js` (0.18 = 18%) |
| Scroll sensitivity | the `/ 1500` divisor in the wheel handler in `main.js` |
| Transition speed | `2.8` in `1 - Math.exp(-dt * 2.8)` in `main.js` |
| Crowd size in world 4 | `260` in the walker loop in `interact.js` |
| Headlines, slogans, manifesto, pixel words | `index.html` |
| Colours and fonts | `:root` tokens and font stacks in `style.css` |

---

## How the assets were made

Everything visual was generated with AI on [Higgsfield](https://higgsfield.ai), then encoded with `ffmpeg`.

1. **Mascot.** An original character sheet for Nib: butter-yellow plush fur, curly antenna with a gold coin, tomato-red arms and feet.
2. **World keyframes.** One still per world, all using the Nib sheet as a reference so he stays consistent.
3. **Transition legs.** Image-to-video (Kling 3.0), about 8 s each. Each leg starts from the **real last frame of the previous leg** and is steered toward the next world's keyframe. That's why the journey has no cuts.
4. **Idle loops.** About 5 s each, generated with the world's rest frame as **both the start and the end frame**, so they loop cleanly and join the legs seamlessly.
5. **Live map sprites.** An empty map plate, a top-down Nib and one coin creature, with backgrounds removed.

Encoding commands:

```bash
# Transition legs: every frame a keyframe, so reverse scrubbing is instant
ffmpeg -i leg.mp4 -an -vf "scale=1280:-2" -c:v libx264 -preset fast -crf 24 \
  -pix_fmt yuv420p -g 1 -keyint_min 1 -movflags +faststart t1.mp4

# Idle loops: normal GOP, smaller files
ffmpeg -i idle.mp4 -an -vf "scale=1280:-2" -c:v libx264 -preset fast -crf 23 \
  -pix_fmt yuv420p -g 24 -movflags +faststart i1.mp4

# Exact last frame of a leg (used as the next leg's first frame)
ffmpeg -i leg.mp4 -vf reverse -frames:v 1 leg-last.png
```

---

## Limitations

This is honest about where the approach falls short of a real-time 3D site.

**It's video, not 3D.**
- Nib can't really turn toward the mouse or react physically. The mouse tilts the whole frame instead. On the original site the mascot is a 3D model and follows the cursor.
- Every transition follows one fixed camera path. You can scrub it forwards and backwards, but you can't look around.
- Changing a world's look means generating new video, not tweaking a model or a light.

**Seams are good, not perfect.**
- AI video models only approximate the start and end frames you give them. Joins are close but can shift slightly.
- Leaving a world cross-fades the idle loop into the transition, and you may notice a brief blend.
- In world 4 the live diorama is drawn to match the video, but the crowd and Nib's exact position differ slightly from the video frame. You can see it at the moment it fades in.

**Weight and performance.**
- About 41 MB downloads before the site starts, and the loader waits for all of it. That's fine on broadband and slow on mobile data.
- There are no separate mobile encodes or lazy loading yet. All clips stay in memory.
- Browsers throttle hidden or background tabs. Animations and idle loops slow down or pause there and resume when the tab is visible.

**Interaction model.**
- Scroll-hijacking is a deliberate style choice, but it goes against normal page behaviour. There's no scrollbar and no text selection flow.
- Cursor effects (coin, pencil, light beam, tilt) are built for desktop. On touch screens you get swipes and taps, but the hover effects don't apply.
- Automatic effects (colour waves, lasers, shooting stars) run on timers and may feel busy to some visitors.

**Dependencies.**
- Fonts come from Google Fonts. If they fail to load, heavy system fallbacks (Arial Black, Impact) keep the look chunky, but it won't match exactly.
- The live map sprites are trimmed in the browser on load, which costs a moment of CPU.

**Not a product.** There's no backend, wallet, token or lending logic. The buttons link out; everything is presentation.

---

## Browser support and accessibility

- Tested in current Chromium browsers (Chrome, Edge). Firefox and Safari should work since the site uses standard APIs (`<video>`, `fetch` streams, Canvas 2D, Web Animations, CSS 3D transforms), but they haven't been tested as thoroughly.
- **Keyboard:** arrow keys, Page Up/Down, Space, Home and End move between worlds. The dots and buttons are focusable.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, transitions jump instantly, idle loops don't play, tilt and ambient animations switch off, and typing effects show text at once.
- Decorative layers are hidden from screen readers (`aria-hidden`). Captions update in a polite live region.

---

## Credits and disclaimer

- **Interaction inspiration:** [loanmeme.io](https://loanmeme.io), for the scroll-driven, cursor-reactive, one-world-per-section style. This project isn't affiliated with or endorsed by Loan Meme. No code, models, textures or copy from that site are used.
- **Brand, mascot, worlds, copy and all artwork:** original to this project.
- **Generated with:** [Higgsfield](https://higgsfield.ai) (Kling 3.0 video, GPT Image stills, background removal). Video encoding with [FFmpeg](https://ffmpeg.org).
- **Fonts:** [Lilita One](https://fonts.google.com/specimen/Lilita+One), [Anton](https://fonts.google.com/specimen/Anton), [Outfit](https://fonts.google.com/specimen/Outfit), [Silkscreen](https://fonts.google.com/specimen/Silkscreen), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), all under the SIL Open Font License.

LENDLING is fictional. **Not financial advice.**

## License

No license has been chosen yet. Until one is added, all rights are reserved by default. If you want others to reuse the code, add a `LICENSE` file (MIT is a common choice for code). The AI-generated assets may be subject to the generation platform's terms.
