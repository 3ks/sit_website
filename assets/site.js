/* SIT website: language, theme and style pickers, scroll reveal, and release links.
   No dependencies. English lives in index.html; other languages load on demand from assets/i18n/<code>.js. */
(function () {
  "use strict";

  var REPO = "3ks/sit";
  var LANGS = { en: "EN", "zh-CN": "CN", "zh-TW": "TW", ja: "JA", fr: "FR", es: "ES" };
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: the choice lasts for this page */ } }
  };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* ── Language ─────────────────────────────────────────────────── */
  window.SIT_I18N = window.SIT_I18N || {};
  var nodes = $$("[data-i18n]");
  var english = { title: document.title, desc: document.querySelector('meta[name="description"]').content };
  nodes.forEach(function (n) { english[n.dataset.i18n] = n.innerHTML; });
  window.SIT_I18N.en = english;

  function loadDict(lang) {
    return new Promise(function (resolve, reject) {
      if (window.SIT_I18N[lang]) return resolve(window.SIT_I18N[lang]);
      var s = document.createElement("script");
      s.src = "assets/i18n/" + lang + ".js";
      s.onload = function () { window.SIT_I18N[lang] ? resolve(window.SIT_I18N[lang]) : reject(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function applyLang(lang) {
    if (!LANGS[lang]) lang = "en";
    return loadDict(lang).then(function (dict) {
      nodes.forEach(function (n) { n.innerHTML = dict[n.dataset.i18n] || english[n.dataset.i18n]; });
      document.title = dict.title || english.title;
      document.querySelector('meta[name="description"]').content = dict.desc || english.desc;
      root.lang = lang;
      document.getElementById("lang-code").textContent = LANGS[lang];
      $$("#lang-menu button").forEach(function (b) { b.setAttribute("aria-current", String(b.dataset.lang === lang)); });
    }).catch(function () { if (lang !== "en") applyLang("en"); });
  }

  var langBtn = document.getElementById("lang"), langMenu = document.getElementById("lang-menu");
  function toggleMenu(open) {
    langMenu.hidden = !open;
    langBtn.setAttribute("aria-expanded", String(open));
  }
  langBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(langMenu.hidden); });
  langMenu.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-lang]");
    if (!b) return;
    store.set("sit-lang", b.dataset.lang);
    applyLang(b.dataset.lang);
    toggleMenu(false);
    langBtn.focus();
  });
  document.addEventListener("click", function (e) { if (!langMenu.hidden && !langMenu.contains(e.target)) toggleMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !langMenu.hidden) { toggleMenu(false); langBtn.focus(); } });
  applyLang(root.lang || "en");

  /* ── Light / dark and style ───────────────────────────────────── */
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function syncChrome() {
    themeMeta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#131418";
    var fam = root.dataset.family || "sit";
    $$("#styles .sw").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.family === fam)); });
  }
  document.getElementById("mode").addEventListener("click", function () {
    var light = root.dataset.theme !== "light";
    if (light) root.dataset.theme = "light"; else delete root.dataset.theme;
    store.set("sit-theme", light ? "light" : "dark");
    syncChrome();
  });
  document.getElementById("styles").addEventListener("click", function (e) {
    var b = e.target.closest(".sw");
    if (!b) return;
    if (b.dataset.family === "sit") delete root.dataset.family; else root.dataset.family = b.dataset.family;
    store.set("sit-family", b.dataset.family);
    syncChrome();
  });
  syncChrome();

  /* ── Reveal on scroll ─────────────────────────────────────────── */
  var reveal = $$(".rv");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveal.forEach(function (n) { io.observe(n); });
  } else {
    reveal.forEach(function (n) { n.classList.add("in"); });
  }

  /* ── Latest release: point each button at its file ────────────────
     Without this (offline, rate-limited, no release yet) the buttons keep their link to the releases page. */
  fetch("https://api.github.com/repos/" + REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (rel) {
      if (rel.tag_name) $$("[data-version]").forEach(function (n) { n.textContent = rel.tag_name; });
      $$("a[data-asset]").forEach(function (a) {
        var hit = (rel.assets || []).filter(function (x) { return x.name.slice(-a.dataset.asset.length) === a.dataset.asset; })[0];
        if (!hit) return;
        a.href = hit.browser_download_url;
        var small = a.querySelector("small");
        if (small && hit.size) small.textContent += " · " + Math.round(hit.size / 1048576) + " MB";
      });
    })
    .catch(function () { /* keep the static links */ });
})();
