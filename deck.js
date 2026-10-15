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
    if (window.matchMedia("(max-width: 640px)").matches) return false;
    var c = navigator.connection;
    if (c) {
      if (c.saveData) return false;
      if (/(^|-)2g$/.test(c.effectiveType || "")) return false;
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
  }

  function play(panel) {
    var v = panel.querySelector("video");
    if (!v || !v.dataset.attached) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay refused; poster stands */ });
  }

  function pause(panel) {
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
    var live = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = panels.indexOf(e.target);
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          e.target.classList.add("is-live");
          play(e.target);
          marks.forEach(function (m, j) { m.classList.toggle("on", j === i); });
        } else {
          pause(e.target);
        }
      });
    }, { threshold: [0, 0.55, 1] });
    panels.forEach(function (p) { live.observe(p); });

    // The ticks belong to the deck, so they show only while it is on screen,
    // and the same signal hardens the snap: mandatory inside the deck, back to
    // proximity once you are past it so long sections below stay readable.
    var inDeck = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (ticks) ticks.classList.toggle("is-on", e.isIntersecting);
        if (!reduced) document.documentElement.classList.toggle("is-in-deck", e.isIntersecting);
      });
    }, { threshold: 0 });
    inDeck.observe(deck);
  } else {
    panels.forEach(function (p) { p.classList.add("is-live"); });
  }

  // a tab in the background should not be decoding video
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) panels.forEach(pause);
    else panels.forEach(function (p) { if (p.classList.contains("is-live")) play(p); });
  });
}());
