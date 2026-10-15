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
    panel.querySelectorAll("video[data-src]").forEach(function (video) {
      if (video.dataset.attached) return;
      var source = video.getAttribute("data-src");
      if (!source) return;

      video.dataset.attached = "1";
      video.loop = true;
      video.addEventListener("canplay", function () { video.classList.add("is-ready"); }, { once: true });
      video.addEventListener("error", function () { video.remove(); }, { once: true });
      video.src = source;
      video.load();
    });
  }

  function play(panel) {
    if (!useClips) return;
    var videos = [].slice.call(panel.querySelectorAll("video"));
    if (!videos.length) return;
    attach(panel);
    var token = (panel._deckPlayToken || 0) + 1;
    panel._deckPlayToken = token;
    Promise.all(videos.map(function (video) {
      if (video.readyState >= 2) return Promise.resolve();
      return new Promise(function (resolve) {
        video.addEventListener("canplay", resolve, { once: true });
        video.addEventListener("error", resolve, { once: true });
      });
    })).then(function () {
      if (panel._deckPlayToken !== token) return;
      var cycle = panel.querySelector(".holo-cycle");
      if (cycle) cycle.classList.add("is-playing");
      videos.forEach(function (video) {
        if (!video.isConnected) return;
        var offset = cycle ? Number(video.dataset.cycleOffset || 0) : 0;
        try { video.currentTime = offset; } catch (error) { /* metadata may still be settling */ }
        var result = video.play();
        if (result && result.catch) result.catch(function () { /* poster remains visible */ });
      });
    });
  }

  function pause(panel) {
    panel._deckPlayToken = (panel._deckPlayToken || 0) + 1;
    var cycle = panel.querySelector(".holo-cycle");
    if (cycle) cycle.classList.remove("is-playing");
    panel.querySelectorAll("video").forEach(function (video) {
      if (!video.paused) video.pause();
      try { video.currentTime = 0; } catch (error) { /* metadata may still be settling */ }
    });
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
