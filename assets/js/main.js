/* =========================================================
   Portfolio script — shared by the main page and project pages.
   You normally don't need to edit this file.

   What it does:
   1. Picks the 720p video on small screens, 1080p on large ones
      (from the data-hd / data-sd attributes on each <video>).
   2. Only loads a video when it's close to the screen, plays the
      one you're looking at and pauses the rest.
   3. Builds the dot navigation on the main page.
   ========================================================= */
(function () {
  "use strict";

  // Screens this wide or narrower get the lighter 720p file.
  var SMALL_SCREEN = window.matchMedia("(max-width: 900px)");

  function pickSource(video) {
    return SMALL_SCREEN.matches ? video.dataset.sd : video.dataset.hd;
  }

  function loadVideo(video) {
    if (!video || video.dataset.loaded) return;
    video.src = pickSource(video);
    video.dataset.loaded = "1";
  }

  function playVideo(video) {
    loadVideo(video);
    var p = video.play();
    if (p && p.catch) p.catch(function () {}); // autoplay can be refused (e.g. iOS low-power mode); the poster stays visible
  }

  var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-hd]"));

  // Fallback for very old browsers: just load everything.
  if (!("IntersectionObserver" in window)) {
    videos.forEach(playVideo);
    return;
  }

  // Start downloading a video when it's within one screen of the viewport.
  var preloadObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          loadVideo(e.target);
          preloadObserver.unobserve(e.target);
        }
      });
    },
    { rootMargin: "50% 0px" }
  );

  // Play when at least half visible, pause otherwise.
  var playObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) playVideo(e.target);
        else e.target.pause();
      });
    },
    { threshold: 0.5 }
  );

  videos.forEach(function (v) {
    preloadObserver.observe(v);
    playObserver.observe(v);
  });

  // ---------- Main page extras ----------
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-section]"));
  if (!sections.length) return;

  // Dot navigation
  var dots = document.createElement("nav");
  dots.className = "dots";
  dots.setAttribute("aria-label", "Sections");
  var buttons = sections.map(function (section) {
    var b = document.createElement("button");
    b.type = "button";
    b.title = section.dataset.section;
    b.setAttribute("aria-label", section.dataset.section);
    b.addEventListener("click", function () {
      section.scrollIntoView({ behavior: "smooth" });
    });
    dots.appendChild(b);
    return b;
  });
  document.body.appendChild(dots);

  var hint = document.querySelector(".scroll-hint");

  var sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = sections.indexOf(e.target);
        buttons.forEach(function (b, j) {
          b.classList.toggle("active", i === j);
        });
        if (hint) hint.classList.toggle("hidden", i !== 0);
      });
    },
    { threshold: 0.5 }
  );
  sections.forEach(function (s) {
    sectionObserver.observe(s);
  });

  // Mouse wheel / trackpad: one gesture = one section.
  // (CSS scroll-snap already handles touch and keyboard; this makes the
  //  mouse wheel and trackpads behave the same in every browser.)
  var locked = false;
  var quietTimer = null;
  var lockedAt = 0;

  function currentIndex() {
    var best = 0;
    var bestDist = Infinity;
    sections.forEach(function (s, i) {
      var d = Math.abs(s.getBoundingClientRect().top);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  window.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // pinch-zoom / sideways

      var i = currentIndex();
      var last = sections.length - 1;
      var goingDown = e.deltaY > 0;

      // Inside the About section, scroll normally — except scrolling up from its top.
      if (i === last) {
        var atTop = sections[last].getBoundingClientRect().top > -5;
        if (goingDown || !atTop) return;
      }

      e.preventDefault();

      // Ignore the rest of this gesture (trackpads send many events with inertia).
      clearTimeout(quietTimer);
      quietTimer = setTimeout(function () {
        if (Date.now() - lockedAt > 600) locked = false;
        else quietTimer = setTimeout(function () { locked = false; }, 600 - (Date.now() - lockedAt));
      }, 200);

      if (locked || Math.abs(e.deltaY) < 4) return;
      var target = Math.max(0, Math.min(last, i + (goingDown ? 1 : -1)));
      if (target === i) return;
      locked = true;
      lockedAt = Date.now();
      sections[target].scrollIntoView({ behavior: "smooth" });
    },
    { passive: false }
  );
})();

/* ---------- About: English / Chinese toggle ----------
   Elements with lang="en" or lang="zh-Hant" inside .about are shown or
   hidden together. The visitor's choice is remembered in this browser. */
(function () {
  "use strict";

  var about = document.querySelector(".about");
  var button = about && about.querySelector(".lang-toggle");
  if (!button) return;

  var KEY = "about-lang";

  function setLang(lang) {
    var parts = about.querySelectorAll('[lang="en"], [lang="zh-Hant"]');
    for (var i = 0; i < parts.length; i++) {
      parts[i].hidden = parts[i].getAttribute("lang") !== lang;
    }
    button.setAttribute("aria-label", lang === "en" ? "切換為中文" : "Switch to English");
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  setLang(saved === "zh-Hant" ? "zh-Hant" : "en");

  button.addEventListener("click", function () {
    var current = about.querySelector('div[lang="en"]').hidden ? "zh-Hant" : "en";
    setLang(current === "en" ? "zh-Hant" : "en");
  });
})();
