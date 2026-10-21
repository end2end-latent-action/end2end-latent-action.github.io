// Joint-training diagram (#fig-joint). One loop plays the LAM-update pass, then the Policy-update
// pass; the pass not playing is dimmed and idle. Each pass runs forward (dots along data-flow
// arrows), then backward (active losses light up and gradient pulses travel back, marking the
// trained modules they reach). Buttons (or a click on a panel) jump to either pass.
// Static under prefers-reduced-motion.
(() => {
  const root = document.querySelector("#fig-joint .jd");
  if (!root) return;

  const NS = "http://www.w3.org/2000/svg";
  const FWD_SCALE = 1.8;    // stretches the data-t / data-d timings in the markup
  const BWD_AT = 3.0;       // s into a pass: backward phase starts, losses light up
  const GRAD_AT = 3.4;      // s into a pass: gradient pulses start
  const GRAD_SPEED = 180;   // SVG units per second
  const GRAD_MIN = 0.8;     // s, so short gradient paths are still visible
  const HOLD = 1.2;         // s to hold the finished pass before switching

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const btn = root.querySelector(".jd-toggle");
  const pickers = [...root.querySelectorAll(".jd-switch button")];   // one per pass, in panel order

  function makeDot(layer, r, cls) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", r);
    c.setAttribute("class", cls);
    c.style.visibility = "hidden";
    layer.appendChild(c);
    return c;
  }

  // Length along `path` at which it first enters `rect` (padded), or -1.
  function entryLength(path, len, rect) {
    const b = rect.getBBox(), pad = 4;
    for (let s = 0; s <= 200; s++) {
      const p = path.getPointAtLength((len * s) / 200);
      if (p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad) {
        return (len * s) / 200;
      }
    }
    return -1;
  }

  function setupPass(el) {
    const svg = el.querySelector("svg");
    const dots = svg.querySelector(".dots"), pulses = svg.querySelector(".pulses");
    const trained = [...svg.querySelectorAll(".node.is-trained")];
    const flows = [...svg.querySelectorAll(".flow path")].map((p) => ({
      p, len: p.getTotalLength(), t0: FWD_SCALE * p.dataset.t, dur: FWD_SCALE * (p.dataset.d || 0.25), dot: makeDot(dots, 3.2, "dot"),
    }));
    const grads = [...svg.querySelectorAll(".grad path")].map((p) => {
      // Minor paths (e.g. L_fdm) get a smaller pulse and don't mark modules.
      const len = p.getTotalLength(), minor = p.classList.contains("minor");
      const dur = Math.max(len / GRAD_SPEED, GRAD_MIN);
      const hits = minor ? [] : trained
        .map((node) => ({ node, at: (entryLength(p, len, node.querySelector("rect")) / len) * dur }))
        .filter((h) => h.at >= 0);
      return { p, len, dur, dot: makeDot(pulses, minor ? 3 : 5, minor ? "pulse minor" : "pulse"), hits };
    });
    const end = Math.max(...grads.map((g) => GRAD_AT + g.dur)) + HOLD;
    return { el, flows, grads, trained, losses: [...svg.querySelectorAll(".loss")], end };
  }

  function place(dot, path, len, k) {
    if (k < 0 || k > 1) { dot.style.visibility = "hidden"; return; }
    const p = path.getPointAtLength(len * k);
    dot.setAttribute("cx", p.x);
    dot.setAttribute("cy", p.y);
    dot.style.visibility = "visible";
  }

  // Draw one pass at time t (seconds into that pass); t < 0 resets it to the idle state.
  function renderPass(ps, t) {
    for (const f of ps.flows) place(f.dot, f.p, f.len, (t - f.t0) / f.dur);
    for (const l of ps.losses) l.classList.toggle("on", t >= BWD_AT);
    ps.el.classList.toggle("is-grad", t >= GRAD_AT);
    const hit = new Set();
    for (const g of ps.grads) {
      place(g.dot, g.p, g.len, (t - GRAD_AT) / g.dur);
      for (const h of g.hits) if (t >= GRAD_AT + h.at) hit.add(h.node);
    }
    for (const n of ps.trained) n.classList.toggle("hit", hit.has(n));
  }

  const passes = [...root.querySelectorAll(".jd-pass")].map(setupPass);
  const starts = passes.map((_, i) => passes.slice(0, i).reduce((s, ps) => s + ps.end, 0));
  const total = passes.reduce((s, ps) => s + ps.end, 0);

  let clock = 0, last = null, raf = 0, visible = false, playing = true;

  function draw() {
    let active = 0;
    while (active < passes.length - 1 && clock >= starts[active + 1]) active++;
    passes.forEach((ps, i) => {
      ps.el.classList.toggle("is-dim", i !== active);
      renderPass(ps, i === active ? clock - starts[i] : -1);
    });
    pickers.forEach((b, i) => b.setAttribute("aria-pressed", i === active));
  }

  function frame(now) {
    raf = 0;
    if (!(playing && visible) || reduce.matches) { last = null; return; }
    if (last !== null) clock = (clock + Math.min(now - last, 100) / 1000) % total;
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && playing && visible && !reduce.matches) raf = requestAnimationFrame(frame); }

  function applyMotionPref() {
    const isStatic = reduce.matches;
    root.classList.toggle("is-static", isStatic);
    if (isStatic) {
      passes.forEach((ps) => { ps.el.classList.remove("is-dim"); renderPass(ps, -1); });
    } else {
      draw();
      start();
    }
  }

  function setPlaying(on) {
    playing = on;
    btn.classList.toggle("is-paused", !playing);
    btn.querySelector(".label").textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
    start();
  }

  btn.addEventListener("click", () => setPlaying(!playing));

  // Jump to the start of a pass and play from there (buttons, or a click anywhere on a panel).
  function playPass(i) {
    if (reduce.matches) return;
    clock = starts[i];
    last = null;
    draw();
    setPlaying(true);
  }
  pickers.forEach((b, i) => b.addEventListener("click", () => playPass(i)));
  passes.forEach((ps, i) => ps.el.addEventListener("click", () => playPass(i)));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(root);
  } else {
    visible = true;
  }

  reduce.addEventListener?.("change", applyMotionPref);
  applyMotionPref();
})();
