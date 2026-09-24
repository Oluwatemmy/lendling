// LENDLING: scroll-hijacked, always-alive scene engine in the style of loanmeme.io.
//
// Six worlds sit at cur = 0..5. At rest, a world plays its idle loop (Nib and
// the background keep moving). Scrolling scrubs the transition leg between two
// worlds; the idle loop cross-fades out as you leave and restarts from its
// first frame (which is the leg's end frame) when you arrive, so it never pops.
// A small flick nudges and springs back; a bigger one commits one section.
// Each scene has its own scroll move (dolly, roll, glitch, crane, fly-through,
// warp), its own always-running background layer, and everything leans with
// the mouse.

const T_LEGS = [1, 2, 3, 4, 5].map((n) => `assets/t${n}.mp4`); // world n-1 -> world n
const IDLES = [1, 2, 3, 4, 5, 6].map((n) => `assets/i${n}.mp4`); // loop per world
const SCENES = 6;
const MAX = SCENES - 1;
const RESTS = [0, 1, 2, 3, 4, 5];
const COMMIT = 0.18; // fraction of the way to the next world that commits the move
const CAPTIONS = [
  "Meet Nib. The first meme that borrows.",
  "Hype, but collateralized.",
  "Fees refill the reserve, then buy back LEND.",
  "Every market is its own island.",
  "Written in code, not in promises.",
  "Early gets rewarded.",
];
const CODE = [
  "mapping(address => Vault) public vaults;",
  "uint256 borrowLimit = vault.heat * ltv / 1e18;",
  "function lend(address meme, uint256 amount) external",
  "reserve += fee * 60 / 100;",
  "buyback(fee - reserveCut);",
  "require(healthFactor(vault) > 1e18, \"rekt\");",
  "event Borrowed(address indexed who, uint256 amount);",
  "liquidate(vault); // one island, never the fleet",
  "uint256 rate = baseRate + utilization * slope;",
  "vault.heat = oracle.trend(meme);",
  "modifier onlyNib() { _; }",
  "return collateral * price / debt;",
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = $("#stage");
const film = $("#film");
const fx = $$(".fx");
const caption = $("#caption");
const hint = $("#scrollHint");
const dotsNav = $("#dots");
const follower = $("#follower");
const starsCanvas = $("#stars");

function makeVideo(cls, loop) {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.loop = loop;
  v.className = cls;
  film.append(v);
  return v;
}
const tv = T_LEGS.map(() => makeVideo("tv", false));
const iv = IDLES.map(() => makeVideo("iv", true));

let target = 0, cur = 0, active = -1, ready = false, restIdx = 0, idleIdx = -1;
let mx = 0, my = 0, smx = 0, smy = 0; // raw and smoothed mouse, -0.5..0.5
let px = innerWidth / 2, py = innerHeight / 2, fx_ = px, fy_ = py;
let speed = 0; // smoothed |target - cur|, drives warp / blur

// ---------- typing helper (captions + loader) ----------
const typers = new WeakMap();
function typeInto(el, text, rate = 28) {
  clearInterval(typers.get(el));
  el.textContent = "";
  if (reduce) { el.textContent = text; return; }
  let i = 0;
  typers.set(el, setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typers.get(el));
  }, rate));
}

// ---------- loader: fetch every clip into a Blob so seeking is instant ----------
async function fetchBlob(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = +res.headers.get("content-length") || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(total ? got / total : 0);
  }
  return URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
}

async function boot() {
  const bar = $("#loaderBar");
  typeInto($("#loaderTyped"), "is loading.", 90);
  typeInto(caption, "LENDLING is loading.", 40);

  const all = [...T_LEGS, ...IDLES];
  const vids = [...tv, ...iv];
  const parts = all.map(() => 0);
  const minTime = new Promise((r) => setTimeout(r, reduce ? 0 : 2200));
  const urls = await Promise.all(all.map((u, i) => fetchBlob(u, (p) => {
    parts[i] = p;
    bar.style.width = `${(parts.reduce((a, b) => a + b, 0) / all.length) * 100}%`;
  })));
  // Don't block on decode: browsers defer media in background tabs.
  const decoded = Promise.all(vids.map((v, i) => new Promise((r) => {
    v.addEventListener("loadeddata", r, { once: true });
    // If this host won't play blob: URLs, fall back to the file itself.
    v.addEventListener("error", () => { if (v.src.startsWith("blob:")) v.src = [...T_LEGS, ...IDLES][i]; }, { once: true });
    v.src = urls[i];
    v.load();
  })));
  await Promise.race([decoded, new Promise((r) => setTimeout(r, 1500))]);
  await minTime;
  $("#loader").classList.add("done");
  ready = true;
  setActive(0);
}

// ---------- navigation: one section per gesture, nudges spring back ----------
function goTo(k) {
  restIdx = clamp(k, 0, MAX);
  target = RESTS[restIdx];
}

let settleTimer = 0;
function push(delta) {
  if (!ready) return;
  const lo = RESTS[Math.max(0, restIdx - 1)];
  const hi = RESTS[Math.min(MAX, restIdx + 1)];
  target = clamp(target + delta, lo, hi);
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 160);
}

function settle() {
  const d = target - RESTS[restIdx];
  if (Math.abs(d) > COMMIT) restIdx = clamp(restIdx + Math.sign(d), 0, MAX);
  target = RESTS[restIdx];
}

for (let i = 0; i < SCENES; i++) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", `Scene ${i + 1}`);
  b.addEventListener("click", () => goTo(i));
  dotsNav.append(b);
}
const dots = $$("button", dotsNav);

function setActive(i) {
  active = i;
  dots.forEach((d, k) => d.classList.toggle("on", k === i));
  fx.forEach((el) => el.classList.toggle("on", +el.dataset.scene === i));
  starsCanvas.classList.toggle("on", i >= 4);
  hint.classList.toggle("hide", i === MAX);
  typeInto(caption, CAPTIONS[i]);
}

// ---------- starfield (code + space worlds): twinkles at rest, warps on scroll ----------
const sctx = starsCanvas.getContext("2d");
const STARS = Array.from({ length: 260 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
function drawStars(dt, warp) {
  const w = (starsCanvas.width = starsCanvas.clientWidth);
  const h = (starsCanvas.height = starsCanvas.clientHeight);
  const cx = w / 2 + smx * 60, cy = h / 2 + smy * 40;
  sctx.clearRect(0, 0, w, h);
  sctx.lineCap = "round";
  for (const s of STARS) {
    const oz = s.z;
    s.z -= dt * (0.04 + warp * 1.6);
    if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; continue; }
    const k = 0.5 / s.z, ko = 0.5 / oz;
    const x = cx + s.x * w * k, y = cy + s.y * h * k;
    const x0 = cx + s.x * w * ko, y0 = cy + s.y * h * ko;
    const a = clamp(1 - s.z) * 0.9;
    sctx.strokeStyle = `rgba(220,235,255,${a})`;
    sctx.lineWidth = clamp((1 - s.z) * 2.4, 0.4, 2.4);
    sctx.beginPath();
    sctx.moveTo(x0, y0);
    sctx.lineTo(x + 0.1, y + 0.1);
    sctx.stroke();
  }
}

// ---------- code world: lines flying through depth ----------
const codefield = $("#codefield");
const codeLines = CODE.map((text, i) => {
  const el = document.createElement("span");
  el.textContent = text;
  if (i % 3 === 0) el.className = "k";
  codefield.append(el);
  return { el, x: (Math.random() - 0.5) * 1400, y: (Math.random() - 0.5) * 700, z: -1800 + (i / CODE.length) * 2000, ry: (Math.random() - 0.5) * 40 };
});

// ---------- per-scene overlays: always-on idle motion + scene-specific scroll move ----------
const heroLetters = $$(".fx-hero .puffy span");
const decos = $$(".fx-hero .deco > *");
const posterRows = $$(".fx-poster .row");
const posterBig = $(".poster__big");
const shards = $$(".shard");
const glitch = $(".glitch");
const scan = $(".scanlines");
const routePath = $(".route path");
const routeLen = routePath.getTotalLength();
routePath.style.strokeDasharray = routeLen;
const pixels = $$(".px");
const stanza = $(".stanza");
const cta = $(".cta");

// Each entry: { stage(d, time) -> extra stage transform/filter, fx(t, d, time, dt) }
// t = 0..1 progress through the scene's half-leg window, d = offset from the world (-0.5..0.5).
const SCENE = [
  { // 1. hero: camera dollies in, letters burst outward
    stage: (d) => ({ tf: `scale(${1 + Math.max(0, d) * 0.5 + Math.max(0, -d) * 0.2})`, filter: "" }),
    fx: (t, d, time) => {
      const burst = Math.max(0, d) * 2;
      heroLetters.forEach((el, k) => {
        const side = k < 4 ? -1 : 1, ph = k * 0.9, depth = 18 + (k % 4) * 10;
        const x = side * burst * 420 - smx * depth * 2 + Math.sin(time * 0.7 + ph) * 12;
        const y = Math.sin(time * 1.3 + ph) * 24 - smy * depth - burst * 120 * Math.cos(k);
        const rz = Math.sin(time * 0.9 + ph) * 9 + side * burst * 40;
        const ry = Math.sin(time * 1.1 + ph * 1.3) * 9 + smx * 12;
        const rx = Math.cos(time * 0.8 + ph) * 7 - smy * 10;
        const sq = 1 + Math.sin(time * 2.6 + ph) * 0.06;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz}deg) scale(${(2 - sq) * (1 + burst * 0.5)}, ${sq * (1 + burst * 0.5)})`;
      });
      decos.forEach((el, k) => {
        const depth = +el.dataset.depth;
        el.style.transform = `translate3d(${-smx * depth + Math.sin(time * 0.5 + k) * 14}px, ${-smy * depth + Math.cos(time * 0.6 + k) * 12 - d * depth * 3}px, 0) rotate(${Math.sin(time * 0.4 + k) * 15 + d * 60}deg)`;
      });
    },
  },
  { // 2. poster: camera rolls, slogans race, shards scatter
    stage: (d) => ({ tf: `rotate(${d * 14}deg) scale(${1 + Math.abs(d) * 0.3})`, filter: `saturate(${1 + Math.abs(d) * 1.5})` }),
    fx: (t, d, time) => {
      posterRows.forEach((el, k) => {
        const dir = k % 2 ? 1 : -1;
        el.style.transform = `translate3d(${(dir * (time * 40 + d * 1800)) % 900 - 450 - smx * 40}px, ${-smy * 20}px, 0)`;
      });
      posterBig.style.transform = `translate(-50%, -50%) translate(${-smx * 60}px, ${-smy * 40}px) scale(${1 + Math.sin(time * 0.6) * 0.04 + d * 0.8})`;
      shards.forEach((el, k) => {
        const depth = 30 + k * 18;
        const spread = 1 + Math.abs(d) * 3;
        el.style.transform = `translate3d(${(-smx * depth + Math.sin(time * 0.6 + k) * 20) * spread}px, ${(-smy * depth + Math.cos(time * 0.5 + k * 1.7) * 26) * spread}px, 0) rotateX(${time * 30 + k * 40}deg) rotateY(${time * 45 + k * 60}deg) rotate(${Math.sin(time + k) * 20}deg)`;
      });
    },
  },
  { // 3. studio: glitch shake + scanline surge
    stage: (d, time) => {
      const g = Math.abs(d) * 30;
      return { tf: `translate(${(Math.random() - 0.5) * g}px, ${(Math.random() - 0.5) * g * 0.5}px)`, filter: `contrast(${1 + Math.abs(d) * 1.2}) hue-rotate(${d * 90}deg)` };
    },
    fx: (t, d, time) => {
      glitch.style.transform = `translate3d(${-(time * 4 + d * 60) % 50}%, ${-smy * 30 + Math.sin(time * 2) * 4}px, 0) rotate(${smx * -4 + d * 6}deg) skewX(${d * 30}deg)`;
      scan.style.opacity = 0.6 + Math.abs(d) * 2;
    },
  },
  { // 4. map: crane move (tilts back and pulls up), pixel words pop and scatter
    stage: (d) => ({ tf: `rotateX(${d * 28}deg) scale(${1 - Math.abs(d) * 0.18})`, filter: "" }),
    fx: (t, d, time) => {
      routePath.style.strokeDashoffset = routeLen * (1 - clamp(t * 1.4)) + ((time * 40) % 40);
      pixels.forEach((el, k) => {
        el.classList.toggle("pop", t >= +el.dataset.at);
        el.style.translate = `${-smx * (20 + k * 8) + d * (k % 2 ? 300 : -300)}px ${-smy * (14 + k * 6) + Math.sin(time * 1.4 + k) * 6 - Math.abs(d) * 200}px`;
      });
    },
  },
  { // 5. code: fly-through, code rushes past, manifesto rises
    stage: (d) => ({ tf: `scale(${1 + Math.abs(d) * 0.35})`, filter: `blur(${Math.abs(d) * 6}px)` }),
    fx: (t, d, time, dt) => {
      const rush = Math.abs(d) * 4200;
      for (const l of codeLines) {
        l.z += dt * (90 + rush);
        if (l.z > 500) { l.z = -1800; l.x = (Math.random() - 0.5) * 1400; l.y = (Math.random() - 0.5) * 700; }
        const a = clamp((l.z + 1800) / 900) * clamp((500 - l.z) / 300);
        l.el.style.opacity = a;
        l.el.style.transform = `translate(-50%, -50%) translate3d(${l.x - smx * 80}px, ${l.y - smy * 50}px, ${l.z}px) rotateY(${l.ry + smx * 20}deg)`;
      }
      const s = clamp(t * 2.2);
      stanza.style.opacity = s * (1 - Math.abs(d) * 1.4);
      stanza.style.transform = `translate3d(${-smx * 30}px, ${(1 - s) * 60 - smy * 20 + Math.sin(time * 0.8) * 6}px, 0)`;
    },
  },
  { // 6. space: warp zoom, CTA floats
    stage: (d) => ({ tf: `scale(${1 + Math.abs(d) * 0.4})`, filter: "" }),
    fx: (t, d, time) => {
      cta.style.translate = `${-smx * 16}px ${-smy * 12 + Math.sin(time * 1.1) * 8}px`;
      cta.classList.toggle("show", t > 0.6);
    },
  },
];

// ---------- input ----------
addEventListener("wheel", (e) => {
  e.preventDefault();
  push((e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) / 1500);
}, { passive: false });

let ty = null;
addEventListener("touchstart", (e) => (ty = e.touches[0].clientY), { passive: true });
addEventListener("touchmove", (e) => {
  if (ty === null) return;
  const y = e.touches[0].clientY;
  push(((ty - y) / innerHeight) * 1.6);
  ty = y;
}, { passive: true });
addEventListener("touchend", () => { ty = null; clearTimeout(settleTimer); settle(); });

addEventListener("keydown", (e) => {
  if (!ready) return;
  if (["ArrowDown", "PageDown", " "].includes(e.key)) goTo(restIdx + 1);
  else if (["ArrowUp", "PageUp"].includes(e.key)) goTo(restIdx - 1);
  else if (e.key === "Home") goTo(0);
  else if (e.key === "End") goTo(MAX);
  else return;
  e.preventDefault();
});

// Browsers pause muted autoplay video in hidden tabs; resume the idle loop on return.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && idleIdx >= 0) iv[idleIdx].play().catch(() => {});
});

hint.addEventListener("click", () => goTo(restIdx + 1));
$("#brand").addEventListener("click", (e) => { e.preventDefault(); goTo(0); });
addEventListener("pointermove", (e) => {
  px = e.clientX;
  py = e.clientY;
  mx = e.clientX / innerWidth - 0.5;
  my = e.clientY / innerHeight - 0.5;
});

// ---------- video: scrub the leg, loop the idle when settled ----------
function updateFilm() {
  const settled = target === RESTS[restIdx] && Math.abs(target - cur) < 0.003;
  if (settled) cur = target;

  // The leg under the idle loops always tracks cur, so a departing idle fades onto the right frame.
  const f = Math.min(cur, MAX - 1e-3);
  const leg = Math.floor(f);
  tv.forEach((v, n) => v.classList.toggle("on", n === leg));
  const v = tv[leg];
  if (v.duration) {
    const want = (f - leg) * (v.duration - 0.04);
    if (!v.seeking && Math.abs(v.currentTime - want) > 0.008) v.currentTime = want;
  }

  const want = settled && !reduce ? restIdx : -1;
  if (want === idleIdx) return;
  if (idleIdx >= 0) {
    const old = iv[idleIdx], was = idleIdx;
    old.classList.remove("on");
    setTimeout(() => { if (idleIdx !== was) old.pause(); }, 450);
  }
  if (want >= 0) {
    const nv = iv[want];
    nv.currentTime = 0; // first frame == the leg's end frame
    nv.play().catch(() => {});
    nv.classList.add("on");
  }
  idleIdx = want;
}

// ---------- frame loop ----------
let last = performance.now();
function frame(now) {
  // Generous cap so a throttled/background tab catches up instead of crawling.
  const dt = Math.min(0.25, (now - last) / 1000);
  const time = now / 1000;
  last = now;
  cur += (target - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 2.8));
  speed += (Math.abs(target - cur) - speed) * (1 - Math.exp(-dt * 6));

  const km = reduce ? 1 : 1 - Math.exp(-dt * 4);
  smx += (mx - smx) * km;
  smy += (my - smy) * km;
  const kf = 1 - Math.exp(-dt * 3);
  fx_ += (px - fx_) * kf;
  fy_ += (py - fy_) * kf;

  if (ready) {
    updateFilm();
    const i = Math.min(MAX, Math.round(cur));
    const d = cur - i;
    const t = i === 0 ? clamp(cur / 0.5) : clamp(cur - (i - 0.5));
    if (i !== active) setActive(i);

    const sc = SCENE[i];
    if (!reduce) {
      const { tf, filter } = sc.stage(d, time);
      const ry = smx * 7 + Math.sin(time * 0.35) * 1.2;
      const rx = -smy * 5 + Math.cos(time * 0.27) * 0.9;
      stage.style.transform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${-smx * 22}px, ${-smy * 14}px, 0) scale(1.1) ${tf}`;
      stage.style.filter = filter;
      follower.style.transform = `translate3d(${fx_}px, ${fy_}px, 0) rotate(${(fx_ - px) * 0.3}deg)`;
    }
    sc.fx(t, d, time, dt);
    if (i >= 4) drawStars(dt, reduce ? 0 : speed + Math.abs(d) * (i === 5 ? 2 : 0.6));
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  caption.textContent = "Could not load the film. Serve this folder over http (see README).";
});
requestAnimationFrame(frame);
