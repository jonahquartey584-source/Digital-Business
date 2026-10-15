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

    /* The ticks belong to the deck, and the same signal hardens the snap:
       mandatory between panels, proximity everywhere else.

       The release has to happen BEFORE you try to leave, not after. Under
       mandatory snap the browser must come to rest on a snap point, and the
       last one is the final panel — with nothing below it to snap to, the
       page pins there and everything under the deck becomes unreachable, by
       wheel and by scrollTo alike. So snapping is hard through the panels
       and lets go once the last one has settled, which is still every
       transition the deck actually has. */
    var deckOnScreen = false, onLastPanel = false;
    var lastPanel = panels[panels.length - 1];

    function syncSnap() {
      var hard = deckOnScreen && !onLastPanel;
      if (ticks) ticks.classList.toggle("is-on", deckOnScreen);
      if (!reduced) document.documentElement.classList.toggle("is-in-deck", hard);
    }

    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { deckOnScreen = e.isIntersecting; });
      syncSnap();
    }, { threshold: 0 }).observe(deck);

    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onLastPanel = e.intersectionRatio >= 0.55; });
      syncSnap();
    }, { threshold: [0, 0.55, 1] }).observe(lastPanel);

    /* Safety net. If an observer ever misses, a visitor must not be stuck on
       a page they cannot scroll: once the deck's bottom is above the fold the
       snap is released no matter what the observers believe. */
    addEventListener("scroll", function () {
      if (document.documentElement.classList.contains("is-in-deck") &&
          deck.getBoundingClientRect().bottom <= innerHeight) {
        document.documentElement.classList.remove("is-in-deck");
      }
    }, { passive: true });
  } else {
    panels.forEach(function (p) { p.classList.add("is-live"); });
  }

  // a tab in the background should not be decoding video
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) panels.forEach(pause);
    else panels.forEach(function (p) { if (p.classList.contains("is-live")) play(p); });
  });
}());
