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
  var $ = function (id) { return document.getElementById(id); };
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  /* Run `start` the first time `el` scrolls into view. */
  function whenSeen(el, start) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) return start();
    var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { o.disconnect(); start(); } }, { threshold: 0.3 });
    o.observe(el);
  }

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
  /* The new look spreads out from the click where the browser supports view transitions. */
  function restyle(e, change) {
    if (!document.startViewTransition || calm) { change(); syncChrome(); return; }
    root.style.setProperty("--vx", e.clientX + "px");
    root.style.setProperty("--vy", e.clientY + "px");
    document.startViewTransition(function () { change(); syncChrome(); });
  }
  document.getElementById("mode").addEventListener("click", function (e) {
    var light = root.dataset.theme !== "light";
    restyle(e, function () { if (light) root.dataset.theme = "light"; else delete root.dataset.theme; });
    store.set("sit-theme", light ? "light" : "dark");
  });
  document.getElementById("styles").addEventListener("click", function (e) {
    var b = e.target.closest(".sw");
    if (!b) return;
    restyle(e, function () { if (b.dataset.family === "sit") delete root.dataset.family; else root.dataset.family = b.dataset.family; });
    store.set("sit-family", b.dataset.family);
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



  /* ── Backdrop: a metro map of lanes, with commits travelling along them ──
     Drawn the way the commit graph is: straight runs, 90° rounded elbows, one colour per lane. It scrolls a
     little slower than the page, and nodes near the pointer light up. Still when motion is reduced. */
  (function backdrop() {
    var cv = $("bg"), ctx = cv && cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    var GRID = 56, STEP = 6, W = 0, H = 0, TH = 0, dpr = 1, lanes = [], colors = [], accent = "", light = false;
    var ptr = { x: -9999, y: -9999 }, last = 0;
    var rnd = function (n) { return Math.floor(Math.random() * n); };

    function readColors() {
      var cs = getComputedStyle(root);
      colors = [0, 1, 2, 3, 4].map(function (i) { return cs.getPropertyValue("--lane-" + i).trim(); });
      accent = cs.getPropertyValue("--accent").trim();
      light = root.dataset.theme === "light";
    }

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = innerWidth; H = innerHeight; TH = H * 1.5;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      lanes = [];
      var count = Math.max(5, Math.min(18, Math.round(W / 105)));
      for (var n = 0; n < count; n++) {
        // corner points: down, sideways by whole grid columns, down again
        var x = GRID * (1 + rnd(Math.max(1, Math.floor(W / GRID) - 1))), y = -GRID, pts = [[x, y]];
        while (y < TH + GRID) {
          y += GRID * (2 + rnd(5));
          pts.push([x, y]);
          if (y >= TH + GRID) break;
          var nx = Math.max(GRID, Math.min(W - GRID, x + (Math.random() < 0.5 ? -1 : 1) * GRID * (1 + rnd(3))));
          if (nx !== x) { x = nx; pts.push([x, y]); }
        }
        var path = new Path2D();
        path.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length - 1; i++) path.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 12);
        path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        // points every STEP px for the travelling commits; a node in the middle of each long vertical run
        var samples = [], nodes = [];
        for (i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
          for (var d = 0; d < len; d += STEP) samples.push([a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len]);
          if (a[0] === b[0] && len >= GRID * 3) nodes.push([a[0], a[1] + Math.round(len / 2 / GRID) * GRID, Math.random() * 6.28]);
        }
        var pulses = [];
        for (i = 0; i < 1 + rnd(2); i++) pulses.push({ s: Math.random() * samples.length, v: (38 + Math.random() * 70) / STEP });
        lanes.push({ path: path, samples: samples, nodes: nodes, pulses: pulses, color: n % 5 });
      }
    }

    function draw(t) {
      var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
      var max = root.scrollHeight - H, oy = max > 0 ? -(scrollY / max) * (TH - H) : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (ptr.x > -999) {           // light under the pointer
        var g = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 260);
        g.addColorStop(0, accent); g.addColorStop(1, "transparent");
        ctx.globalAlpha = light ? 0.1 : 0.13; ctx.fillStyle = g;
        ctx.fillRect(ptr.x - 260, ptr.y - 260, 520, 520);
      }
      ctx.translate(0, oy);
      var py = ptr.y - oy, base = light ? 0.15 : 0.11;
      ctx.lineCap = "round";
      lanes.forEach(function (l) {
        var c = colors[l.color];
        ctx.strokeStyle = c; ctx.fillStyle = c;
        ctx.lineWidth = 1.5; ctx.globalAlpha = base;
        ctx.stroke(l.path);
        l.nodes.forEach(function (nd) {
          var near = Math.max(0, 1 - Math.hypot(nd[0] - ptr.x, nd[1] - py) / 190);
          ctx.globalAlpha = Math.min(1, base * 1.7 + 0.12 * Math.sin(t / 900 + nd[2]) + near * 0.75);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(nd[0], nd[1], 4.5 + near * 3, 0, 6.2832); ctx.stroke();
          if (near > 0.05) { ctx.globalAlpha = near * 0.8; ctx.beginPath(); ctx.arc(nd[0], nd[1], 2, 0, 6.2832); ctx.fill(); }
        });
        l.pulses.forEach(function (p) {
          p.s += p.v * dt;
          if (p.s >= l.samples.length) p.s = 0;
          var head = Math.floor(p.s), TRAIL = 22;
          ctx.lineWidth = 2;
          for (var k = 0; k < TRAIL && head - k > 0; k++) {
            var a = l.samples[head - k], b = l.samples[head - k - 1];
            ctx.globalAlpha = (1 - k / TRAIL) * (light ? 0.6 : 0.5);
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          }
          var h = l.samples[head];
          ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(h[0], h[1], 8, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(h[0], h[1], 2.6, 0, 6.2832); ctx.fill();
        });
      });
      ctx.globalAlpha = 1;
    }

    function loop(t) { if (!document.hidden) draw(t); requestAnimationFrame(loop); }
    readColors(); build();
    new MutationObserver(function () { readColors(); if (calm) draw(0); }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-family"] });
    var resizeTimer;
    addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (innerWidth !== W || Math.abs(innerHeight - H) > 120) { build(); if (calm) draw(0); } }, 180);
    });
    if (calm) { draw(0); addEventListener("scroll", function () { draw(0); }, { passive: true }); return; }
    addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") { ptr.x = e.clientX; ptr.y = e.clientY; } }, { passive: true });
    document.addEventListener("pointerleave", function () { ptr.x = ptr.y = -9999; });
    requestAnimationFrame(loop);
  })();

  /* ── Page chrome: scroll progress, current section, pointer glow ── */
  var bar = $("progress"), ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = root.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? scrollY / max : 0) + ")";
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if ("IntersectionObserver" in window) {
    var links = {};
    $$(".nav a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (id) { links[id].classList.toggle("active", id === en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var sec = $(id); if (sec) spy.observe(sec); });
  }

  $$(".glow").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  /* ── Hero window: tilt with the pointer, and a commit list you can click ── */
  var heroWin = document.querySelector(".hero .win");
  if (heroWin && !calm && matchMedia("(hover: hover)").matches) {
    heroWin.addEventListener("pointermove", function (e) {
      var r = heroWin.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      heroWin.style.transform = "perspective(1800px) rotateX(" + (-py * 2.2).toFixed(2) + "deg) rotateY(" + (px * 2.6).toFixed(2) + "deg)";
    });
    heroWin.addEventListener("pointerleave", function () { heroWin.style.transform = ""; });
  }

  /* Files each example commit touches: [path, added, deleted]; deleted < 0 marks a new file. */
  var COMMITS = {
    1: [["frontend/src/features/board/boardDrag.ts", 86, 12], ["frontend/src/styles/44-board-agents.css", 31, 4], ["internal/dispatch/launch.go", 142, 9]],
    2: [["frontend/src/features/board/boardDrag.ts", 86, 12], ["frontend/src/styles/44-board-agents.css", 31, 4]],
    3: [["frontend/src/features/graph/graphRender.ts", 24, 6], ["frontend/e2e/chapters/72-graph-reveal.mjs", 58, -1]],
    4: [["internal/dispatch/launch.go", 142, 9], ["internal/terminal/tmuxsess/session.go", 37, 3]],
    5: [["internal/fsxfer/transfer.go", 19, 5], ["internal/fsxfer/transfer_test.go", 44, -1]],
    6: [["internal/watcher/watch.go", 73, 118], ["cmd/agent/watch.go", 61, -1], ["cmd/app/service_watch.go", 12, 40]],
    7: [["VERSION", 1, 1], ["changes/0.1.42/feat-github-publish.md", 8, -1]],
    8: [["internal/metrics/collector_windows.go", 164, -1], ["cmd/agent/metrics_windows.go", 39, 2]],
    9: [["cmd/agent/daemon.go", 14, 47], ["internal/agentdist/download.go", 22, 3]]
  };
  var AVATARS = { Max: ["MX", "#2f8f7a"], Aya: ["AY", "#b0563a"], Lin: ["LN", "#7a55c7"] };
  var gRows = $("g-rows");
  function selectRow(row) {
    var i = +row.dataset.row;
    $$("#g-rows .g-row").forEach(function (r) { r.classList.toggle("sel", r === row); });
    var ring = $("g-ring");
    ring.setAttribute("cx", parseFloat(row.style.getPropertyValue("--x")));
    ring.setAttribute("cy", 15 + 30 * i);
    $("d-wip").hidden = i !== 0;
    $("d-commit").hidden = i === 0;
    var view = $(i === 0 ? "d-wip" : "d-commit");
    if (!calm && view.animate) view.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    if (i === 0) return;
    var who = row.querySelector(".g-who").textContent, av = AVATARS[who], files = COMMITS[i], add = 0, del = 0;
    $("d-msg").textContent = row.querySelector(".g-msg").lastChild.textContent;
    $("d-who").textContent = who;
    $("d-sha").textContent = row.querySelector(".g-sha").textContent;
    $("d-av").textContent = av[0];
    $("d-av").style.background = av[1];
    $("d-files").innerHTML = files.map(function (f) {
      var cut = f[0].lastIndexOf("/") + 1, isNew = f[2] < 0;
      add += f[1]; del += Math.max(f[2], 0);
      return '<div class="f' + (isNew ? " add" : "") + '">' + f[0].slice(cut) + " <span>" + f[0].slice(0, cut) + '</span><span class="n"><span class="p">+' + f[1] + "</span>" + (isNew ? "" : ' <span class="m">−' + f[2] + "</span>") + "</span></div>";
    }).join("");
    $("d-n").textContent = files.length;
    $("d-add").textContent = "+" + add;
    $("d-del").textContent = "−" + del;
  }
  if (gRows) {
    gRows.addEventListener("click", function (e) { var r = e.target.closest(".g-row"); if (r) selectRow(r); });
    gRows.addEventListener("keydown", function (e) {
      var r = e.target.closest(".g-row");
      if (!r) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectRow(r); }
      var next = e.key === "ArrowDown" ? r.nextElementSibling : e.key === "ArrowUp" ? r.previousElementSibling : null;
      if (next && next.classList.contains("g-row")) { e.preventDefault(); next.focus(); selectRow(next); }
    });
    selectRow(gRows.querySelector(".g-row.sel"));
  }

  /* ── Diff: pick lines, stage them ─────────────────────────────── */
  var diff = $("diff");
  if (diff) {
    var count = function () {
      var n = diff.querySelectorAll(".ln.pick").length;
      $("diff-n").textContent = n + (n === 1 ? " line selected" : " lines selected");
      $("diff-bar").classList.toggle("none", n === 0);
    };
    diff.addEventListener("click", function (e) {
      var ln = e.target.closest(".ln.a, .ln.d");
      if (!ln || ln.classList.contains("staged")) return;
      ln.classList.toggle("pick");
      count();
    });
    var stage = function () {
      var picked = $$("#diff .ln.pick");
      if (!picked.length) return;
      picked.forEach(function (ln) { ln.classList.remove("pick"); ln.classList.add("staged"); ln.querySelector("b").textContent = "✓"; });
      $("diff-n").textContent = "Staged " + picked.length + (picked.length === 1 ? " line" : " lines");
      $("diff-bar").classList.add("none");
      // every changed line staged: start over after a moment
      if (!diff.querySelector(".ln.a:not(.staged), .ln.d:not(.staged)")) {
        setTimeout(function () {
          $$("#diff .ln.staged").forEach(function (ln) { ln.classList.remove("staged"); ln.querySelector("b").textContent = ln.classList.contains("a") ? "+" : "−"; });
          count();
        }, 2600);
      }
    };
    $("diff-stage").addEventListener("click", stage);
    $("diff-stage").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stage(); } });
  }

  /* ── Terminal: type the session out when it comes into view ───── */
  $$(".term[data-type]").forEach(function (term) {
    if (calm) return;
    var lines = term.innerHTML.split("\n"), slow = term.dataset.type === "slow";
    var caret = '<span class="caret"></span>';
    function play() {
      var done = [];
      var paint = function (partial) { term.innerHTML = done.concat(partial === undefined ? [] : [partial]).join("\n") + (slow ? "" : caret); };
      var chain = Promise.resolve();
      lines.forEach(function (line) {
        var isCmd = line.indexOf("$ ") === 0 && line.indexOf("<") < 0;
        chain = chain.then(function () {
          if (!isCmd) { done.push(line.replace(caret, "")); paint(); return wait(slow ? 520 : line ? 110 : 420); }
          var typed = Promise.resolve();
          line.split("").forEach(function (_, k) {
            typed = typed.then(function () { paint(line.slice(0, k + 1)); return wait(k < 2 ? 0 : 34); });
          });
          return typed.then(function () { done.push(line); paint(); return wait(380); });
        });
      });
      chain.then(function () { return wait(7000); }).then(play);
    }
    term.innerHTML = slow ? "" : caret;
    whenSeen(term, play);
  });

  /* ── Workbench: dispatch a Ready card to an agent ─────────────── */
  var wb = $("wb");
  if (wb) {
    var toastTimer;
    var toast = function (text, warn) {
      var t = $("wb-toast");
      t.textContent = text; t.hidden = false; t.classList.toggle("warn", !!warn);
      if (!calm && t.animate) t.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
    };
    var recount = function () {
      ["col-ready", "col-doing", "col-review"].forEach(function (id) {
        $(id).querySelector(".col-h span").textContent = $(id).querySelectorAll(".card").length;
      });
    };
    var setLoad = function (agent, d) {
      agent.dataset.n = +agent.dataset.n + d;
      agent.querySelector("small").textContent = agent.dataset.n + "/" + agent.dataset.cap;
    };
    var freeAgent = function () {
      return $$("#wb .agent").filter(function (a) { return +a.dataset.n < +a.dataset.cap; })[0];
    };
    var dispatch = function (card, agent) {
      var title = card.querySelector("b").textContent, name = agent.dataset.agent;
      if (+agent.dataset.n >= +agent.dataset.cap) {
        agent.classList.remove("full"); void agent.offsetWidth; agent.classList.add("full");
        return toast(name + " is busy. Pick an agent with a free slot.", true);
      }
      setLoad(agent, 1);
      var run = document.createElement("div");
      run.className = "run";
      run.innerHTML = title + "<span>Working · sit</span>";
      agent.after(run);
      card.removeAttribute("tabindex");
      card.classList.add("pop");
      card.insertAdjacentHTML("beforeend", '<div class="strip"><span class="p">+0</span><span class="m">−0</span><span class="live">working</span></div>');
      $("col-doing").querySelector(".col-h").after(card);
      recount();
      toast("Dispatched to " + name + ": worktree and branch created");
      var add = 0, del = 0, p = card.querySelector(".p"), m = card.querySelector(".m");
      var tick = setInterval(function () {
        add += 3 + Math.floor(Math.random() * 14); del += Math.floor(Math.random() * 4);
        p.textContent = "+" + add; m.textContent = "−" + del;
      }, 450);
      setTimeout(function () {
        clearInterval(tick);
        card.querySelector(".live").outerHTML = "<span>tests ok</span>";
        card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
        $("col-review").querySelector(".col-h").after(card);
        run.remove();
        setLoad(agent, -1);
        recount();
        toast("“" + title + "” is ready for review");
      }, calm ? 1200 : 5200);
    };

    var drag = null;
    var ready = $("col-ready");
    ready.addEventListener("pointerdown", function (e) {
      var card = e.target.closest(".card");
      if (!card || e.button > 0) return;
      drag = { card: card, x: e.clientX, y: e.clientY, ghost: null, over: null };
    });
    addEventListener("pointermove", function (e) {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
        var r = drag.card.getBoundingClientRect();
        drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
        drag.ghost = drag.card.cloneNode(true);
        drag.ghost.classList.add("ghost");
        drag.ghost.style.width = r.width + "px";
        document.body.appendChild(drag.ghost);
        drag.card.classList.add("lifted");
        wb.classList.add("dragging");
      }
      drag.ghost.style.left = e.clientX - drag.dx + "px";
      drag.ghost.style.top = e.clientY - drag.dy + "px";
      var hit = document.elementFromPoint(e.clientX, e.clientY);
      var agent = hit && hit.closest("#wb .agent");
      if (drag.over && drag.over !== agent) drag.over.classList.remove("drop");
      if (agent) agent.classList.add("drop");
      drag.over = agent;
    });
    var drop = function () {
      if (!drag) return;
      var d = drag; drag = null;
      wb.classList.remove("dragging");
      d.card.classList.remove("lifted");
      if (d.over) d.over.classList.remove("drop");
      if (!d.ghost) {                       // a click: send it to the first agent with room
        var a = freeAgent();
        return a ? dispatch(d.card, a) : toast("Every agent is busy. The card waits in Ready.", true);
      }
      d.ghost.remove();
      if (d.over) dispatch(d.card, d.over);
    };
    addEventListener("pointerup", drop);
    addEventListener("pointercancel", function () { if (drag && drag.ghost) drag.ghost.remove(); if (drag) { drag.card.classList.remove("lifted"); wb.classList.remove("dragging"); } drag = null; });
    ready.addEventListener("keydown", function (e) {
      var card = e.target.closest(".card");
      if (!card || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      var a = freeAgent();
      if (a) dispatch(card, a); else toast("Every agent is busy. The card waits in Ready.", true);
    });
  }

  /* ── Monitor: a chart that keeps moving ───────────────────────── */
  var chart = $("m-chart");
  if (chart && !calm) {
    var N = 28, cpu = [], mem = [], c = 62, mm = 57;
    var step = function () {
      c = Math.max(18, Math.min(96, c + (Math.random() - 0.5) * 22));
      mm = Math.max(40, Math.min(78, mm + (Math.random() - 0.48) * 3));
      cpu.push(c); mem.push(mm);
      if (cpu.length > N) { cpu.shift(); mem.shift(); }
    };
    for (var k = 0; k < N; k++) step();
    var curve = function (vals) {      // a smooth line through the points
      var pts = vals.map(function (v, i) { return [i * 400 / (N - 1), 126 - v * 1.2]; });
      var d = "M" + pts[0][0] + " " + pts[0][1].toFixed(1);
      for (var i = 1; i < pts.length; i++) {
        var mx = (pts[i - 1][0] + pts[i][0]) / 2;
        d += "C" + mx.toFixed(1) + " " + pts[i - 1][1].toFixed(1) + " " + mx.toFixed(1) + " " + pts[i][1].toFixed(1) + " " + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
      }
      return d;
    };
    var draw = function () {
      var a = curve(cpu), b = curve(mem);
      chart.querySelector(".l1").setAttribute("d", a); chart.querySelector(".a1").setAttribute("d", a + "V132H0Z");
      chart.querySelector(".l2").setAttribute("d", b); chart.querySelector(".a2").setAttribute("d", b + "V132H0Z");
      $("m-cpu").textContent = Math.round(c);
      $("m-mem").textContent = Math.round(mm);
      $("m-load").textContent = (c / 22).toFixed(2);
      $("m-net").textContent = (1 + c / 24 + Math.random()).toFixed(2);
    };
    draw();
    whenSeen(chart, function () { setInterval(function () { if (!document.hidden) { step(); draw(); } }, 1100); });
  }

  /* ── Figures count up ─────────────────────────────────────────── */
  $$("[data-count]").forEach(function (n) {
    if (calm) return;
    var to = parseFloat(n.dataset.count), dec = n.dataset.count.indexOf(".") >= 0 ? 1 : 0;
    n.textContent = (0).toFixed(dec);
    whenSeen(n, function () {
      var t0 = performance.now();
      (function frame(t) {
        var k = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - k, 3);
        n.textContent = (to * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(frame);
      })(t0);
    });
  });

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
