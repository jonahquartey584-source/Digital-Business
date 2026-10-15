/* ──────────────────────────────────────────────────────────────────────
   hero.js — the homepage film and the motion around it.

   The hero is a tall pinned section with a sticky stage inside it. Scroll
   progress through that section maps 0 to 1 and drives the video's time,
   so the footage plays forward as you scroll down and backward as you
   scroll up. Five bands of copy fade in and out across that progress.

   The rules this file follows, each one earned the hard way:
   - the video is fetched as a Blob, because a host without byte-range
     support clamps every seek to zero and scrubbing silently dies;
   - the displayed time is eased toward the scroll target in a rAF loop
     that goes to sleep when it converges or the hero leaves the screen;
   - seeks are gated so two never overlap, which is what keeps Chrome
     smooth, and the gate releases on error so it cannot deadlock;
   - the DOM is written only when a value actually changes;
   - phones, portrait tablets and reduced motion get the static hero and
     never download the video at all.
   ────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var hero = document.getElementById("film");
  var stage = document.getElementById("stage");
  var video = document.getElementById("heroVideo");
  var poster = document.getElementById("poster");
  var ring = document.getElementById("ring");
  var cue = document.getElementById("cue");
  var meterBar = document.getElementById("meterBar");
  var meterLabel = document.getElementById("meterLabel");

  var VIDEO_URL = "assets/hero/hero-scrub.mp4";
  var VIDEO_BYTES = 4764879;
  var POSTER_URL = "assets/hero/hero-poster.jpg";

  /* ── the signal line (runs on every screen, hero or not) ───────────── */
  var sig = document.getElementById("sig");
  var sigFill = document.getElementById("sigFill");
  var nodeHosts = [].slice.call(document.querySelectorAll("[data-node]"));
  var nodes = [];

  if (sig && nodeHosts.length) {
    nodeHosts.forEach(function () {
      var n = document.createElement("span");
      n.className = "sig__node";
      sig.appendChild(n);
      nodes.push({ el: n, y: -1, lit: null });
    });
    sig.classList.add("is-on");
  }

  var lastSig = -1;

  var lastSolid = null;

  function updateHeader() {
    var mark = window.innerHeight * 0.75;
    var ref = hero && hero.offsetHeight > window.innerHeight * 1.5
      ? hero.offsetHeight - window.innerHeight * 0.4
      : mark;
    var solid = window.scrollY > ref;
    if (solid !== lastSolid) {
      lastSolid = solid;
      document.body.classList.toggle("head-solid", solid);
    }
  }

  function updateSig() {
    updateHeader();
    if (!sig) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (Math.abs(p - lastSig) > 0.002) {
      lastSig = p;
      sigFill.style.setProperty("--p", p.toFixed(3));
    }
    for (var i = 0; i < nodes.length; i++) {
      var box = nodeHosts[i].getBoundingClientRect();
      var y = Math.round(box.top + 18);
      var n = nodes[i];
      if (y !== n.y) {
        n.y = y;
        n.el.style.transform = "translateY(" + y + "px)";
        n.el.style.opacity = y > -40 && y < window.innerHeight + 40 ? "1" : "0";
      }
      var lit = box.top < window.innerHeight * 0.62;
      if (lit !== n.lit) {
        n.lit = lit;
        n.el.classList.toggle("is-lit", lit);
      }
    }
  }

  /* ── the hold moment ───────────────────────────────────────────────── */
  var holdBtn = document.getElementById("holdBtn");
  var holdLabel = document.getElementById("holdLabel");
  var flow = document.getElementById("flow");
  var holdRead = document.getElementById("holdRead");
  var READS = ["Waiting", "Call missed, text going out", "Booking link sent", "Slot taken, calendar updated", "Logged and done"];
  var lastRead = "";
  var steps = flow ? [].slice.call(flow.children) : [];
  var hp = 0;
  var holding = false;
  var holdRaf = null;
  var holdLast = 0;
  var holdDone = false;
  var litCount = -1;

  var HOLD_SECONDS = 2.6;
  var RELEASE_SECONDS = 1.6;

  function paintHold() {
    holdBtn.style.setProperty("--hp", hp.toFixed(3));
    var lit = 0;
    for (var i = 0; i < steps.length; i++) {
      if (hp >= (i + 1) / (steps.length + 0.25)) lit = i + 1;
    }
    if (lit !== litCount) {
      litCount = lit;
      for (var j = 0; j < steps.length; j++) steps[j].classList.toggle("is-lit", j < lit);
      if (holdRead && READS[lit] !== lastRead) {
        lastRead = READS[lit];
        holdRead.textContent = lastRead;
      }
    }
    if (hp >= 1 && !holdDone) {
      holdDone = true;
      holdBtn.setAttribute("data-done", "1");
      holdLabel.textContent = "That is the system, running on its own";
    }
    if (hp < 1 && holdDone) {
      holdDone = false;
      holdBtn.removeAttribute("data-done");
      holdLabel.textContent = "Hold to run it";
    }
  }

  function holdTick(now) {
    var dt = Math.min(100, now - (holdLast || now)) / 1000;
    holdLast = now;
    if (holding) hp = Math.min(1, hp + dt / HOLD_SECONDS);
    else if (!holdDone) hp = Math.max(0, hp - dt / RELEASE_SECONDS);
    paintHold();
    if ((holding && hp < 1) || (!holding && !holdDone && hp > 0)) {
      holdRaf = requestAnimationFrame(holdTick);
    } else {
      holdRaf = null;
      holdLast = 0;
    }
  }

  function startHold(e) {
    if (e && e.cancelable) e.preventDefault();
    holding = true;
    if (holdRaf === null) holdRaf = requestAnimationFrame(holdTick);
  }

  function endHold() {
    holding = false;
    if (holdRaf === null && hp > 0 && !holdDone) holdRaf = requestAnimationFrame(holdTick);
  }

  function finishHold() {
    hp = 1;
    paintHold();
  }

  if (holdBtn && steps.length) {
    holdBtn.addEventListener("pointerdown", startHold);
    holdBtn.addEventListener("pointerup", endHold);
    holdBtn.addEventListener("pointercancel", endHold);
    holdBtn.addEventListener("pointerleave", endHold);
    holdBtn.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") startHold(e);
    });
    holdBtn.addEventListener("keyup", function (e) {
      if (e.key === " " || e.key === "Enter") endHold();
    });
    holdBtn.addEventListener("blur", endHold);
  }

  /* ── entrance delays retire after they have played ─────────────────── */
  [].slice.call(document.querySelectorAll("[data-reveal]")).forEach(function (el) {
    el.addEventListener("transitionend", function () {
      if (el.classList.contains("is-visible")) el.classList.add("is-settled");
    });
  });

  document.addEventListener("visibilitychange", function () {
    document.body.classList.toggle("paused", document.hidden);
  });

  /* ── the hero film ─────────────────────────────────────────────────── */
  var bands = [].slice.call(document.querySelectorAll(".band")).map(function (el) {
    var r = (el.getAttribute("data-band") || "0,1").split(",");
    return {
      el: el,
      a: parseFloat(r[0]),
      b: parseFloat(r[1]),
      ramp: parseFloat(el.getAttribute("data-ramp")) || 0,
      op: -1,
      k: -1
    };
  });

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* Split every headline into word and character spans once, at load, with
     a seeded generator so the "random" offsets are the same every time. */
  function splitText() {
    bands.forEach(function (band, bi) {
      var h = band.el.querySelector("[data-split]");
      if (!h || h.dataset.done === "1") return;
      var mode = h.getAttribute("data-split");
      var spread = parseFloat(band.el.getAttribute("data-spread")) || 0.4;
      var rand = rng(9173 + bi * 571);
      var html = h.innerHTML;
      var plain = h.textContent;
      var parts = html.split(/(<em>.*?<\/em>)/g).filter(Boolean);
      var visual = document.createElement("span");
      visual.setAttribute("aria-hidden", "true");

      var total = plain.replace(/\s/g, "").length;
      var ci = 0;

      parts.forEach(function (part) {
        var em = /^<em>/.test(part);
        var text = part.replace(/<\/?em>/g, "");
        text.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) {
            visual.appendChild(document.createTextNode(" "));
            return;
          }
          var w = document.createElement(em ? "em" : "span");
          w.className = em ? "w em" : "w";
          w.style.setProperty("--th", (rand() * 0.42).toFixed(3));
          if (mode === "char") {
            chunk.split("").forEach(function (ch) {
              var c = document.createElement("span");
              c.className = "c";
              c.textContent = ch;
              var th = mode === "char" ? (ci / Math.max(1, total)) * spread + rand() * 0.06 : rand() * 0.4;
              c.style.setProperty("--th", th.toFixed(3));
              c.style.setProperty("--jx", (-30 - rand() * 46).toFixed(1) + "px");
              c.style.setProperty("--jy", ((rand() - 0.5) * 54).toFixed(1) + "px");
              c.style.setProperty("--jr", ((rand() - 0.5) * 22).toFixed(1) + "deg");
              w.appendChild(c);
              ci++;
            });
          } else {
            w.textContent = chunk;
          }
          visual.appendChild(w);
        });
      });

      var sr = document.createElement("span");
      sr.className = "visually-hidden";
      sr.textContent = plain;
      h.textContent = "";
      h.appendChild(sr);
      h.appendChild(visual);
      h.dataset.done = "1";
    });
  }

  splitText();

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function smoothstep(p, e0, e1) {
    var t = clamp((p - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function heroProgress() {
    if (!hero) return 0;
    var box = hero.getBoundingClientRect();
    var range = hero.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return clamp(-box.top / range, 0, 1);
  }

  var loadK = 0;
  var loadStart = 0;
  var lastMeter = "";
  var lastMeterAt = 0;
  var lastDeep = null;

  function updateCaptions(p, now) {
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      var f = Math.min(0.02, (band.b - band.a) / 3);
      var inEase = i === 0 ? 1 : smoothstep(p, band.a, band.a + f);
      var outEase = i === bands.length - 1 ? 1 : 1 - smoothstep(p, band.b - f, band.b);
      var op = inEase * outEase;
      var ramp = band.ramp || Math.min(0.028, (band.b - band.a) * 0.35);
      var k = clamp((p - band.a) / ramp, 0, 1);
      if (i === 0) k = Math.max(k, loadK);

      if (Math.abs(op - band.op) > 0.004) {
        band.op = op;
        band.el.style.opacity = op.toFixed(3);
        band.el.classList.toggle("is-on", op > 0.6);
      }
      if (Math.abs(k - band.k) > 0.008) {
        band.k = k;
        band.el.style.setProperty("--k", k.toFixed(3));
        if (band.el.getAttribute("data-entrance") === "rise") {
          band.el.style.setProperty("--ks", clamp((k - 0.5) * 2.4, 0, 1).toFixed(3));
          band.el.style.setProperty("--kb", clamp((k - 0.72) * 3.4, 0, 1).toFixed(3));
        }
      }
    }

    if (meterBar) meterBar.style.setProperty("--p", p.toFixed(3));
    if (meterLabel) {
      var n = Math.min(bands.length, Math.floor(p * bands.length) + 1);
      var label = "0" + n;
      var t = now || performance.now();
      if (t - lastMeterAt > 100 && label !== lastMeter) {
        lastMeter = label;
        lastMeterAt = t;
        meterLabel.textContent = label;
      }
    }
    var deep = p > 0.06;
    if (deep !== lastDeep) {
      lastDeep = deep;
      stage.classList.toggle("is-deep", deep);
    }
  }

  /* ── seeks, gated so two never overlap ─────────────────────────────── */
  var seekBusy = false;
  var pendingTime = null;

  function requestSeek(t) {
    if (!video.duration || isNaN(video.duration)) return;
    var clamped = clamp(t, 0, video.duration - 0.03);
    if (seekBusy) { pendingTime = clamped; return; }
    seekBusy = true;
    try { video.currentTime = clamped; } catch (_) { seekBusy = false; }
  }

  video.addEventListener("seeked", function () {
    seekBusy = false;
    if (pendingTime !== null) {
      var t = pendingTime;
      pendingTime = null;
      requestSeek(t);
    }
  });

  video.addEventListener("error", function () {
    seekBusy = false;
    pendingTime = null;
    failVideo();
  });

  /* ── the eased drive loop ──────────────────────────────────────────── */
  var target = 0;
  var shown = 0;
  var rafId = null;
  var lastTick = 0;
  var heroOnScreen = true;

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    var k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

    if (loadK < 1 && loadStart) {
      loadK = clamp((now - loadStart) / 900, 0, 1);
    }

    var settled = Math.abs(target - shown) < 0.0005 && loadK >= 1;
    if (settled) {
      shown = target;
      rafId = null;
      lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }

    if (video.duration) requestSeek(shown * video.duration);
    updateCaptions(shown, now);
  }

  function wake() {
    if (rafId === null && heroOnScreen && scrubOn) {
      lastTick = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function onScroll() {
    target = heroProgress();
    wake();
  }

  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroOnScreen = entries[0].isIntersecting;
      if (heroOnScreen) wake();
    }, { threshold: 0 }).observe(hero);
  }

  /* ── the streamed Blob, behind an honest loading ring ──────────────── */
  var startedFetch = false;
  var inited = false;

  function failVideo() {
    if (ring) ring.style.display = "none";
    stage.classList.add("video-failed");
  }

  function startBlobFetch() {
    if (startedFetch) return;
    startedFetch = true;
    loadHeroBlob().catch(failVideo);
  }

  function loadHeroBlob() {
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);

    return fetch(VIDEO_URL, { signal: ctrl.signal }).then(function (res) {
      if (!res.ok || !res.body) throw new Error("hero video unavailable");
      var total = Number(res.headers.get("Content-Length")) || VIDEO_BYTES;
      var reader = res.body.getReader();
      var chunks = [];
      var got = 0;
      var lastRing = 0;

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value);
          got += r.value.length;
          var frac = Math.min(1, got / total);
          var now = performance.now();
          if (now - lastRing > 100 || frac === 1) {
            lastRing = now;
            if (ring) ring.querySelector("circle").style.setProperty("--ld", Math.round(126 * (1 - frac)));
          }
          return pump();
        });
      }

      return pump().then(function () {
        clearTimeout(watchdog);
        if (ring) ring.querySelector("circle").style.setProperty("--ld", 0);
        video.src = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        video.load();
        video.addEventListener("canplay", function () {
          requestSeek(heroProgress() * video.duration);
          stage.classList.add("video-ready");
        }, { once: true });
      });
    });
  }

  function initHeroOnce() {
    if (inited) return;
    inited = true;
    poster.style.backgroundImage = "url('" + POSTER_URL + "')";
    loadStart = performance.now();
    var img = new Image();
    img.onload = startBlobFetch;
    img.onerror = startBlobFetch;
    img.src = POSTER_URL;
    setTimeout(startBlobFetch, 4000);
  }

  /* ── the five static-hero gates, kept live ─────────────────────────── */
  var GATES = [
    "(max-width: 720px)",
    "(orientation: portrait) and (max-width: 1024px)",
    "(orientation: portrait) and (pointer: coarse)",
    "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
    "(prefers-reduced-motion: reduce)"
  ];

  var scrubOn = false;

  function enableScrub() {
    if (scrubOn || !hero) return;
    scrubOn = true;
    initHeroOnce();
    window.addEventListener("scroll", onScroll, { passive: true });
    bands.forEach(function (b) { b.op = -1; b.k = -1; });
    unpinFinalStates();
    target = heroProgress();
    updateCaptions(target, performance.now());
    wake();
  }

  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener("scroll", onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function applyHeroMode() {
    var staticHero = GATES.some(function (q) { return matchMedia(q).matches; });
    if (staticHero) disableScrub();
    else enableScrub();
  }

  /* Reduced motion flipped on mid-session: finish everything that was
     being drawn, and stop the drives. Flipped back off: hand it all back
     to the scroll. */
  function pinToFinalStates() {
    disableScrub();
    bands.forEach(function (b) {
      b.el.style.opacity = "";
      b.el.style.removeProperty("--k");
      b.el.classList.remove("is-on");
    });
    if (sigFill) sigFill.style.setProperty("--p", 1);
    nodes.forEach(function (n) { n.el.classList.add("is-lit"); n.lit = true; });
    [].slice.call(document.querySelectorAll("[data-reveal]")).forEach(function (el) {
      el.classList.add("is-visible", "is-settled");
    });
    if (holdBtn && steps.length) finishHold();
  }

  function unpinFinalStates() {
    nodes.forEach(function (n) { n.lit = null; });
    lastSig = -1;
    updateSig();
  }

  var MQLS = GATES.map(function (q) { return matchMedia(q); });
  MQLS.forEach(function (m) { m.addEventListener("change", applyHeroMode); });

  var rm = matchMedia("(prefers-reduced-motion: reduce)");
  rm.addEventListener("change", function (e) {
    if (e.matches) pinToFinalStates();
    else applyHeroMode();
  });

  window.addEventListener("resize", function () {
    lastSig = -1;
    if (scrubOn) { target = heroProgress(); wake(); }
    updateSig();
  }, { passive: true });

  window.addEventListener("scroll", updateSig, { passive: true });

  if (rm.matches) {
    pinToFinalStates();
  } else {
    applyHeroMode();
  }
  updateSig();
})();
