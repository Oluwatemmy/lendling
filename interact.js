// Per-scene interactions in the style of loanmeme.io. Each world reacts to the
// cursor, clicks and small scroll flicks in its own way:
//   1 hero   - gold coin follows the cursor; click bursts spikes; flick sends a colour wave
//   2 poster - click/flick makes the whole world tumble and spring back; shards spin up
//   3 studio - click/flick fires a laser sweep, TV-static flash and a ticker glitch
//   4 map    - pencil cursor draws fading ink; click/flick makes Nib jump, the crowd
//              scatters away from the landing and walks back; pixel words scramble
//   5 code   - the code field turns with the mouse; click scrambles the code
//   6 space  - a light beam and lens dirt follow the cursor; click/flick shoots a star
// Reads the engine's globals from main.js (ready, active, idleIdx, smx, smy, px, py).
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const filmEl = $("#film");

  // ---------- text scramble (pixel words, code lines) ----------
  const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*<>/=";
  function scramble(el, ms = 520) {
    const final = el.dataset.t || (el.dataset.t = el.textContent);
    clearInterval(el._s);
    const t0 = performance.now();
    el._s = setInterval(() => {
      const k = (performance.now() - t0) / ms;
      el.textContent = [...final].map((c, i) => (c === " " || i < k * final.length ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (k >= 1) { clearInterval(el._s); el.textContent = final; }
    }, 40);
  }

  // ---------- 1. hero ----------
  const burst = $("#burst");
  const ring = $("#ring");
  const SPIKES = ["#b36bff", "#ff5fa2", "#ffd36e", "#7fd6ff"];
  const WAVES = ["#9be7c8", "#a9d8ff", "#ffc4dc", "#ffe39b"];
  let waveN = 0, waveClock = 0;
  function spikes(x, y) {
    for (let k = 0; k < 11; k++) {
      const s = document.createElement("i");
      const a = Math.random() * 360, d = 90 + Math.random() * 130;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.background = SPIKES[k % SPIKES.length];
      burst.append(s);
      s.animate([
        { transform: `rotate(${a}deg) translateY(0) scale(.3)`, opacity: 1 },
        { transform: `rotate(${a}deg) translateY(${-d}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `rotate(${a}deg) translateY(${-d - 50}px) scale(.2)`, opacity: 0 },
      ], { duration: 780, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => s.remove();
    }
  }
  function wave() {
    ring.style.setProperty("--ring", WAVES[waveN++ % WAVES.length]);
    ring.classList.remove("go");
    void ring.offsetWidth;
    ring.classList.add("go");
    waveClock = 0;
  }

  // ---------- 2. poster ----------
  let tum = 0, tumV = 0, shardSpin = 0, shardAngle = 0;
  const shards = $$(".shard");
  const kick = (dir) => { tumV += 240 * dir; shardSpin = 720; };

  // ---------- 3. studio ----------
  const laser = $("#laser");
  const staticCv = $("#static");
  const stx = staticCv.getContext("2d");
  const glitchEl = $(".glitch");
  let staticT = 0, glitchKick = 0, laserClock = 0;
  function fire() {
    laser.animate([
      { transform: "rotate(-78deg)", opacity: 0 },
      { transform: "rotate(-62deg)", opacity: 1, offset: 0.12 },
      { transform: "rotate(6deg)", opacity: 1, offset: 0.85 },
      { transform: "rotate(12deg)", opacity: 0 },
    ], { duration: 700, easing: "cubic-bezier(.3,.1,.3,1)" });
    staticT = 0.4;
    glitchKick = 1;
    laserClock = 0;
  }

  // ---------- 4. map: live diorama ----------
  const live = $("#liveMap");
  const mc = $("#mapCanvas");
  const mctx = mc.getContext("2d");
  // Cut-outs arrive with transparent margins; trim to the alpha bounds so feet sit on the ground.
  function loadTrimmed(src) {
    const out = { img: null };
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        if (d[(y * c.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const t = document.createElement("canvas");
      t.width = x1 - x0 + 1;
      t.height = y1 - y0 + 1;
      t.getContext("2d").drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
      out.img = t;
    };
    im.src = src;
    return out;
  }
  const nibSprite = loadTrimmed("assets/nib-top.png");
  const walkerSprite = loadTrimmed("assets/walker.png");
  const NIB = { x: 0.5, y: 0.6 }; // Nib's feet, normalised to the stage
  const ASPECT = 1.7; // x distances count more than y (the map is seen at an angle)
  const walkers = [];
  for (let k = 0; k < 260; k++) {
    let x, y;
    do { x = Math.random(); y = 0.1 + Math.random() * 0.88; } while (Math.hypot((x - NIB.x) * ASPECT, y - NIB.y) < 0.2);
    walkers.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, ph: Math.random() * 6.28, dir: Math.random() * 6.28, flee: 0 });
  }
  let jumpT = -1, wob = 0, wordClock = 0;
  const pxWords = $$(".px");
  function scatter(power) {
    for (const w of walkers) {
      const dx = (w.x - NIB.x) * ASPECT, dy = w.y - NIB.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const r = 0.6;
      if (d > r) continue;
      const f = ((r - d) / r) * power;
      w.vx += (dx / d) * f / ASPECT;
      w.vy += (dy / d) * f;
      w.flee = 0.8;
    }
  }
  function jump() {
    if (jumpT >= 0) return;
    jumpT = 0;
    scatter(0.35); // they flinch at take-off...
    pxWords.forEach((el, i) => setTimeout(() => scramble(el), i * 60));
  }

  function drawMap(dt, time) {
    const w = mc.clientWidth, h = mc.clientHeight;
    if (mc.width !== w || mc.height !== h) { mc.width = w; mc.height = h; }
    mctx.clearRect(0, 0, w, h);

    // Nib's jump arc; landing squashes and blasts the crowd away
    let lift = 0;
    if (jumpT >= 0) {
      jumpT += dt / 0.95;
      if (jumpT >= 1) { jumpT = -1; wob = 1; scatter(1.1); } // ...and scatter on landing
      else lift = Math.sin(Math.PI * jumpT);
    }
    wob *= Math.exp(-dt * 4.5);

    for (const p of walkers) {
      // Homes wander so the crowd keeps marching around the map.
      p.dir += (Math.random() - 0.5) * dt * 2;
      p.hx += Math.cos(p.dir) * 0.018 * dt;
      p.hy += Math.sin(p.dir) * 0.011 * dt;
      if (p.hx < 0.02 || p.hx > 0.98) { p.dir = Math.PI - p.dir; p.hx = clamp(p.hx, 0.02, 0.98); }
      if (p.hy < 0.1 || p.hy > 0.98) { p.dir = -p.dir; p.hy = clamp(p.hy, 0.1, 0.98); }
      const hd = Math.hypot((p.hx - NIB.x) * ASPECT, p.hy - NIB.y);
      if (hd < 0.2) { p.dir = Math.atan2(p.hy - NIB.y, (p.hx - NIB.x) * ASPECT); p.hx += Math.cos(p.dir) * 0.01; p.hy += Math.sin(p.dir) * 0.01; }
      // Spring back home, but loosely while fleeing so the clearing stays open a moment.
      p.flee -= dt;
      const k = p.flee > 0 ? 0.5 : 4;
      p.vx += ((p.hx - p.x) * k - p.vx * 2.4) * dt;
      p.vy += ((p.hy - p.y) * k - p.vy * 2.4) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const items = walkers.map((p) => ({ y: p.y, p }));
    items.push({ y: NIB.y, nib: true });
    items.sort((a, b) => a.y - b.y);

    for (const it of items) {
      if (it.nib) {
        const nibImg = nibSprite.img;
        const nh = h * 0.36;
        const nw = nibImg ? nh * (nibImg.width / nibImg.height) : nh * 0.8;
        const fx = w * NIB.x, fy = h * NIB.y;
        mctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - lift * 0.6)})`;
        mctx.beginPath();
        mctx.ellipse(fx, fy, nw * 0.42 * (1 - lift * 0.45), nw * 0.12 * (1 - lift * 0.45), 0, 0, Math.PI * 2);
        mctx.fill();
        const sy = 1 + lift * 0.1 - wob * 0.22 * Math.cos(time * 30) + (jumpT < 0 ? Math.sin(time * 2.4) * 0.015 : 0);
        const sx = 1 / Math.sqrt(sy);
        const y0 = fy - lift * h * 0.24;
        if (nibImg) {
          mctx.save();
          mctx.translate(fx, y0);
          mctx.rotate(Math.sin(time * 1.3) * 0.03 + lift * 0.08 * Math.sin(time * 9));
          mctx.scale(sx, sy);
          mctx.drawImage(nibImg, -nw / 2, -nh, nw, nh);
          mctx.restore();
        }
        continue;
      }
      const p = it.p;
      const ph = h * (0.026 + 0.034 * p.y); // tiny next to Nib, bigger nearer the camera
      const walkerImg = walkerSprite.img;
      const pw = walkerImg ? ph * (walkerImg.width / walkerImg.height) : ph * 0.8;
      const x = w * p.x, y = h * p.y;
      const fast = Math.min(1, Math.hypot(p.vx, p.vy) * 8);
      const step = time * (9 + fast * 10) + p.ph;
      mctx.fillStyle = "rgba(0,0,0,.13)";
      mctx.beginPath();
      mctx.ellipse(x, y, pw * 0.34, ph * 0.08, 0, 0, Math.PI * 2);
      mctx.fill();
      if (walkerImg) {
        mctx.save();
        mctx.translate(x, y - Math.abs(Math.sin(step)) * ph * 0.08);
        mctx.rotate(Math.sin(step) * 0.16);
        mctx.scale(Math.cos(p.dir) + p.vx * 3 < 0 ? -1 : 1, 1);
        mctx.drawImage(walkerImg, -pw / 2, -ph, pw, ph);
        mctx.restore();
      }
    }
  }

  // pencil cursor + fading ink
  const pencil = $("#pencil");
  const ink = $("#ink");
  const ictx = ink.getContext("2d");
  const pts = [];
  let pencilTilt = 0, lastPx = 0;
  addEventListener("pointermove", (e) => {
    if (active === 3) pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  function drawInk() {
    const w = ink.clientWidth, h = ink.clientHeight;
    if (ink.width !== w || ink.height !== h) { ink.width = w; ink.height = h; }
    ictx.clearRect(0, 0, w, h);
    const now = performance.now();
    while (pts.length && now - pts[0].t > 2400) pts.shift();
    ictx.lineCap = "round";
    ictx.lineJoin = "round";
    ictx.lineWidth = 9;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (b.t - a.t > 160 || Math.hypot(b.x - a.x, b.y - a.y) > 140) continue;
      ictx.strokeStyle = `rgba(214, 70, 255, ${clamp(1 - (now - b.t) / 2400) * 0.9})`;
      ictx.beginPath();
      ictx.moveTo(a.x, a.y);
      ictx.lineTo(b.x, b.y);
      ictx.stroke();
    }
  }

  // ---------- 5. code ----------
  const codefield = $("#codefield");

  // ---------- 6. space ----------
  const beam = $("#beam");
  const dirt = $("#dirt");
  const shoot = $("#shoot");
  let starClock = 0;
  function shootingStar(x, y) {
    shoot.animate([
      { transform: `translate(${x}px, ${y}px) rotate(155deg) scaleX(.1)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(${x - 520}px, ${y + 240}px) rotate(155deg) scaleX(1)`, opacity: 0 },
    ], { duration: 950, easing: "cubic-bezier(.2,.6,.3,1)" });
    starClock = 0;
  }

  // ---------- scene table ----------
  const SCENE = [
    { click: (x, y) => { spikes(x, y); wave(); }, nudge: () => wave(),
      frame: (dt) => { if (!reduce && (waveClock += dt) > 4.5) wave(); } },
    { click: () => kick(Math.random() < 0.5 ? -1 : 1), nudge: (d) => kick(d),
      frame: (dt) => {
        // Integrate the spring in small fixed steps so it stays stable even at low frame rates.
        for (let s = dt; s > 0; s -= 1 / 120) {
          const h = Math.min(s, 1 / 120);
          tumV += (-70 * tum - 8 * tumV) * h;
          tum += tumV * h;
        }
        filmEl.style.transform = `rotateZ(${tum * 0.22}deg) rotateY(${tum * 0.3}deg) scale(${1 + Math.abs(tum) * 0.0025})`;
        shardSpin *= Math.exp(-dt * 1.4);
        shardAngle += (40 + shardSpin) * dt;
        shards.forEach((el, k) => (el.style.rotate = `${(k % 2 ? 1 : -1) * shardAngle}deg`));
      },
      leave: () => { tum = tumV = 0; filmEl.style.transform = ""; } },
    { click: fire, nudge: fire,
      frame: (dt) => {
        if (!reduce && (laserClock += dt) > 5.5) fire();
        if (staticT > 0) {
          staticT -= dt;
          staticCv.width = 160; staticCv.height = 90;
          const img = stx.createImageData(160, 90);
          for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
          stx.putImageData(img, 0, 0);
          staticCv.style.opacity = clamp(staticT / 0.4) * 0.5;
        } else staticCv.style.opacity = 0;
        if (glitchKick > 0) {
          glitchKick -= dt * 2.5;
          glitchEl.style.translate = `${(Math.random() - 0.5) * 70 * glitchKick}px ${(Math.random() - 0.5) * 24 * glitchKick}px`;
        } else glitchEl.style.translate = "";
      },
      leave: () => { staticCv.style.opacity = 0; glitchEl.style.translate = ""; } },
    { click: jump, nudge: jump,
      frame: (dt, time) => {
        live.classList.toggle("on", idleIdx === 3);
        drawMap(dt, time);
        drawInk();
        const vx = px - lastPx;
        lastPx = px;
        pencilTilt += (clamp(vx * 0.6, -25, 25) - pencilTilt) * (1 - Math.exp(-dt * 10));
        pencil.style.transform = `translate(${px - 17}px, ${py - 118}px) rotate(${-14 + pencilTilt}deg)`;
        if (!reduce && (wordClock += dt) > 4.5) { wordClock = 0; scramble(pxWords[(Math.random() * pxWords.length) | 0]); }
      },
      leave: () => { live.classList.remove("on"); pts.length = 0; ictx.clearRect(0, 0, ink.width, ink.height); } },
    { click: () => $$("#codefield span").forEach((el, i) => setTimeout(() => scramble(el, 700), i * 25)),
      nudge: () => {},
      frame: () => { codefield.style.transform = `rotateY(${smx * 44}deg) rotateX(${-smy * 30}deg)`; },
      leave: () => { codefield.style.transform = ""; } },
    { click: (x, y) => shootingStar(x, y), nudge: () => shootingStar(innerWidth * (0.6 + Math.random() * 0.35), innerHeight * (0.05 + Math.random() * 0.25)),
      frame: (dt) => {
        const sx = innerWidth * 0.18, sy = (innerHeight - 40) * 0.38;
        const dx = px - sx, dy = py - sy;
        beam.style.width = `${Math.hypot(dx, dy) * 1.3 + 260}px`;
        beam.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        beam.style.opacity = 0.45 + 0.4 * clamp(Math.hypot(dx, dy) / innerWidth);
        dirt.style.opacity = 0.12 + 0.75 * clamp((px / innerWidth - 0.35) * 1.6);
        dirt.style.transform = `translate(${-smx * 50}px, ${-smy * 36}px)`;
        if (!reduce && (starClock += dt) > 3.5) shootingStar(innerWidth * (0.55 + Math.random() * 0.4), innerHeight * (0.05 + Math.random() * 0.3));
      } },
  ];

  // ---------- input routing ----------
  let lastNudge = 0;
  addEventListener("wheel", (e) => {
    const now = performance.now();
    if (!ready || now - lastNudge < 650) return;
    lastNudge = now;
    SCENE[active]?.nudge(Math.sign(e.deltaY) || 1);
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    if (!ready || e.button !== 0 || e.target.closest("a, button")) return;
    SCENE[active]?.click(e.clientX, e.clientY);
  });

  // ---------- loop ----------
  let shown = -1, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (ready && active >= 0) {
      if (active !== shown) {
        SCENE[shown]?.leave?.();
        shown = active;
        document.body.dataset.scene = String(active);
      }
      SCENE[active].frame(dt, now / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
