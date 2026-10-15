/* Cinematic deck: keep the backgrounds moving while each panel is in view.
   Scrolling only changes which panel is visible; it never seeks, pins, or
   animates the footage. Posters remain the fallback for reduced motion or
   slow connections. */
(function () {
  "use strict";

  var deck = document.getElementById("deck");
  if (!deck) return;

  var panels = [].slice.call(deck.querySelectorAll(".deck__panel"));
  if (!panels.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var connection = navigator.connection;
  var useClips = !reduced && !(connection && (connection.saveData || /(^|-)(2g|slow-2g)$/.test(connection.effectiveType || "")));
  var ticks = document.getElementById("deckTicks");
  var marks = [];

  if (ticks) {
    panels.forEach(function () {
      var mark = document.createElement("i");
      ticks.appendChild(mark);
      marks.push(mark);
    });
  }

  function attach(panel) {
    var video = panel.querySelector("video");
    if (!video || video.dataset.attached) return;
    var source = video.getAttribute("data-src");
    if (!source) return;

    video.dataset.attached = "1";
    video.loop = true;
    video.addEventListener("canplay", function () { video.classList.add("is-ready"); }, { once: true });
    video.addEventListener("error", function () { video.remove(); }, { once: true });
    video.src = source;
    video.load();
  }

  function play(panel) {
    if (!useClips) return;
    var video = panel.querySelector("video");
    if (!video) return;
    attach(panel);
    var result = video.play();
    if (result && result.catch) result.catch(function () { /* the poster remains visible */ });
  }

  function pause(panel) {
    var video = panel.querySelector("video");
    if (video && !video.paused) video.pause();
  }

  if (useClips && "IntersectionObserver" in window) {
    var preload = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          attach(entry.target);
          preload.unobserve(entry.target);
        }
      });
    }, { rootMargin: "100% 0px" });
    panels.forEach(function (panel) { preload.observe(panel); });
  } else if (useClips) {
    panels.forEach(attach);
  }

  if ("IntersectionObserver" in window) {
    var active = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var index = panels.indexOf(entry.target);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          play(entry.target);
          marks.forEach(function (mark, markIndex) { mark.classList.toggle("on", markIndex === index); });
        } else {
          pause(entry.target);
        }
      });
    }, { threshold: [0, 0.1, 0.55, 1] });
    panels.forEach(function (panel) { active.observe(panel); });

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (ticks) ticks.classList.toggle("is-on", entry.isIntersecting);
      });
    }, { threshold: 0 }).observe(deck);
  } else {
    panels.forEach(play);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) panels.forEach(pause);
    else if (useClips) panels.forEach(function (panel) {
      var bounds = panel.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) play(panel);
    });
  });
}());
