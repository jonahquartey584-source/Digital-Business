/* The example sites are embedded live rather than shown as screenshots. Each
   one renders at its real desktop width inside the browser chrome and is
   scaled down to fit the card, so what you see is the actual site reflowing
   and responding, not a picture of one.

   The scale has to be computed: CSS can match a transform to a container's
   width only with a fixed ratio, and these cards are fluid. Frames start
   inert and are only loaded when they come near the viewport, so the page
   does not pull two whole sites on first paint. */
(function () {
  "use strict";
  var DESKTOP = 1280;
  var frames = [].slice.call(document.querySelectorAll("[data-demo]"));
  if (!frames.length) return;

  function fit(shell) {
    var frame = shell.querySelector("iframe");
    if (!frame) return;
    var scale = shell.clientWidth / DESKTOP;
    frame.style.width = DESKTOP + "px";
    frame.style.height = Math.round(shell.clientHeight / scale) + "px";
    frame.style.transform = "scale(" + scale + ")";
  }

  function load(shell) {
    if (shell.dataset.loaded) return;
    shell.dataset.loaded = "1";
    var frame = document.createElement("iframe");
    frame.src = shell.dataset.demo;
    frame.title = shell.dataset.demoTitle || "Example website";
    frame.loading = "lazy";
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("scrolling", "no");
    shell.appendChild(frame);
    fit(shell);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: "300px" });
    frames.forEach(function (s) { io.observe(s); });
  } else {
    frames.forEach(load);
  }

  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { frames.forEach(fit); }, 120);
  });
})();
