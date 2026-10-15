/* Cinematic deck: reveals each panel as it lands, drives the progress ticks,
   and attaches the background clips only where they are worth the bytes.

   The clip is never the content — every panel renders from its poster alone.
   A clip is only fetched when the visitor is on a wide screen, has not asked
   for reduced motion, is not on a metered or slow connection, and the panel
   is close to the viewport. Panels that scroll away are paused so a stack of
   them is not decoding at once. */
(function () {
  "use strict";

  var deck = document.getElementById("deck");
  if (!deck) return;

  var panels = [].slice.call(deck.querySelectorAll(".deck__panel"));
  if (!panels.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clipsAreWorthIt() {
    if (reduced) return false;
    /* Phones get the footage too — the deck is the same piece of work on a
       small screen. Screen size is the wrong thing to withhold it on; the
       connection is the right one, so a metered or slow link still falls
       back to the posters, which every panel renders from anyway. */
    var c = navigator.connection;
    if (c) {
      if (c.saveData) return false;
      if (/(^|-)(2g|slow-2g)$/.test(c.effectiveType || "")) return false;
    }
    return true;
  }
  var useClips = clipsAreWorthIt();

  /* ---- progress ticks -------------------------------------------------- */
  var ticks = document.getElementById("deckTicks");
  var marks = [];
  if (ticks) {
    panels.forEach(function () {
      var i = document.createElement("i");
      ticks.appendChild(i);
      marks.push(i);
    });
  }

  /* ---- reveal + clip lifecycle ----------------------------------------- */
  function attach(panel) {
    var v = panel.querySelector("video");
    if (!v || v.dataset.attached) return;
    var src = v.getAttribute("data-src");
    if (!src) return;
    v.dataset.attached = "1";
    v.addEventListener("canplay", function () { v.classList.add("is-ready"); }, { once: true });
    // a clip that will not load just leaves the poster in place
    v.addEventListener("error", function () { v.remove(); }, { once: true });
    v.src = src;
    /* preload="none" means nothing is fetched until something asks to play,
       and a scrubbed clip is never played — scrolling seeks it. Without this
       the hero would sit on its poster for ever and never scrub at all. */
    if (panel.classList.contains("deck__panel--scrub")) {
      v.preload = "auto";
      v.load();
    }
  }

  function play(panel) {
    if (panel.classList.contains("deck__panel--scrub")) return; // scroll drives it
    var v = panel.querySelector("video");
    if (!v || !v.dataset.attached) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay refused; poster stands */ });
  }

  function pause(panel) {
    if (panel.classList.contains("deck__panel--scrub")) return;
    var v = panel.querySelector("video");
    if (v && !v.paused) v.pause();
  }

  // near the viewport: worth fetching, not yet worth playing
  if (useClips && "IntersectionObserver" in window) {
    var pre = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { attach(e.target); pre.unobserve(e.target); }
      });
    }, { rootMargin: "120% 0px" });
    panels.forEach(function (p) { pre.observe(p); });
  } else if (useClips) {
    panels.forEach(attach);
  }

  if ("IntersectionObserver" in window) {
    /* Liveness is judged on the stage, not the panel. A scrub panel is three
       screens tall, so its intersection ratio tops out around a third and a
       0.55 test can never pass — the wording would stay at opacity 0 and the
       opening would render as a black screen with nothing on it. The stage is
       one screen and pinned, so it reads near 1 while the panel is in front
       of you, which is the thing we actually mean. */
    function watched(panel) { return panel.querySelector(".deck__stage") || panel; }
    var panelOf = new WeakMap();
    panels.forEach(function (p) { panelOf.set(watched(p), p); });

    var live = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var panel = panelOf.get(e.target) || e.target;
        e = { target: panel, isIntersecting: e.isIntersecting, intersectionRatio: e.intersectionRatio };
        var i = panels.indexOf(e.target);
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          e.target.classList.add("is-live");
          play(e.target);
          marks.forEach(function (m, j) { m.classList.toggle("on", j === i); });
        } else {
          pause(e.target);
          /* Re-arm it. This used to only ever add the class, so a panel
             animated once per page load and every scroll after that showed
             static text over a static frame — the deck stopped moving as soon
             as you had been down it once. Dropping the class when the panel is
             well clear of the viewport means it plays again on the way back,
             and the threshold gap (out at 0.1, in at 0.55) keeps it from
             flickering while a panel sits on the boundary. */
          if (e.intersectionRatio < 0.1) e.target.classList.remove("is-live");
        }
      });
    }, { threshold: [0, 0.1, 0.55, 1] });
    panels.forEach(function (p) { live.observe(watched(p)); });

    // the ticks belong to the deck, so they show only while it is on screen
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (ticks) ticks.classList.toggle("is-on", e.isIntersecting);
      });
    }, { threshold: 0 }).observe(deck);
  } else {
    panels.forEach(function (p) { p.classList.add("is-live"); });
  }

  /* ---- scroll-scrubbed panels -------------------------------------------
     The reference effect is a scroll-linked frame sequence: scrolling moves
     the footage rather than the footage playing itself. A scrub panel is
     taller than the screen and pinned, so how far you have scrolled through
     it maps onto the clip's currentTime.

     Seeking is driven from rAF rather than straight off the scroll event,
     because a seek that is still in flight when the next one arrives is
     dropped, and the picture sticks. */
  var scrubs = panels.filter(function (p) { return p.classList.contains("deck__panel--scrub"); });
  if (scrubs.length && !reduced) {
    var pending = false;

    function paintScrubs() {
      pending = false;
      scrubs.forEach(function (panel) {
        var v = panel.querySelector("video");
        if (!v || !v.duration || isNaN(v.duration)) return;
        var r = panel.getBoundingClientRect();
        var travel = panel.offsetHeight - innerHeight;
        if (travel <= 0) return;
        var progress = Math.min(1, Math.max(0, -r.top / travel));
        var want = progress * (v.duration - 0.05);
        // a seek under one frame is not worth the decode
        if (Math.abs(v.currentTime - want) > 0.04) {
          try { v.currentTime = want; } catch (e) { /* not seekable yet */ }
        }
      });
    }

    function requestScrub() {
      if (!pending) { pending = true; requestAnimationFrame(paintScrubs); }
    }

    addEventListener("scroll", requestScrub, { passive: true });
    addEventListener("resize", requestScrub);
    scrubs.forEach(function (panel) {
      var v = panel.querySelector("video");
      if (v) v.addEventListener("loadedmetadata", requestScrub, { once: true });
    });
    requestScrub();
  }

  // a tab in the background should not be decoding video
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) panels.forEach(pause);
    else panels.forEach(function (p) { if (p.classList.contains("is-live")) play(p); });
  });
}());
