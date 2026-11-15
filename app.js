/* Secret Santa Gasquard — 100% static, no server, no tracking. */
(function () {
  "use strict";

  // ---------- Configuration ----------
  var FAMILY = "Gasquard";
  var PLAYERS = ["Stephane", "Alena", "Dolores", "Michel", "Jean-Luc", "Victoria", "Benoit", "Jacqueline"];
  var BUDGET = 25;
  var STORAGE_KEY = "ss-gasquard-draw";
  var LANG_KEY = "ss-gasquard-lang";

  // ---------- Translations ----------
  var I18N = {
    fr: {
      title: "Secret Santa " + FAMILY,
      orgIntro: "Page de l'organisateur. Cliquez sur le bouton pour tirer au sort, puis envoyez à chacun son lien personnel.",
      ruleBudget: "Budget : " + BUDGET + " € maximum",
      ruleSecret: "C'est secret : ne dites à personne qui vous avez tiré !",
      players: "Participants",
      drawBtn: "🎲 Faire le tirage",
      drawDone: "✅ Tirage effectué !",
      drawHint: "Envoyez à chaque personne SON lien uniquement. N'ouvrez pas les liens des autres : ça gâcherait la surprise 😉",
      drawId: "N° de tirage :",
      redrawBtn: "Refaire un nouveau tirage",
      confirmRedraw: "Refaire le tirage ? Les anciens liens ne seront plus valables pour ce tirage — il faudra renvoyer les nouveaux liens à tout le monde.",
      copy: "Copier",
      copied: "Copié ✓",
      whatsapp: "WhatsApp",
      waMessage: "🎅 Coucou {name} ! Voici ton lien personnel pour le Secret Santa " + FAMILY + " (ne le partage pas) : {url}",
      hello: "Bonjour {name} 🎅",
      revealIntro: "Votre mission de Secret Santa vous attend…",
      openGift: "Ouvrir le cadeau",
      tapGift: "Touchez le cadeau pour découvrir à qui vous offrez un cadeau.",
      youGiftTo: "Vous offrez un cadeau à :",
      keepSecret: "🤫 Chut… gardez-le pour vous !",
      countdown: "🎄 Plus que {n} jour(s) avant Noël !",
      christmas: "🎄 Joyeux Noël !",
      badLink: "Ce lien n'est pas valide. Vérifiez que vous l'avez copié en entier, ou demandez à l'organisateur de vous le renvoyer.",
      footer: "Fait avec ❤️ pour la famille " + FAMILY + " · Aucune donnée n'est enregistrée"
    },
    en: {
      title: "Secret Santa " + FAMILY,
      orgIntro: "Organizer page. Click the button to draw names, then send each person their personal link.",
      ruleBudget: "Budget: " + BUDGET + " € maximum",
      ruleSecret: "It's a secret: don't tell anyone who you drew!",
      players: "Players",
      drawBtn: "🎲 Draw names",
      drawDone: "✅ Names drawn!",
      drawHint: "Send each person ONLY their own link. Don't open other people's links — it would spoil the surprise 😉",
      drawId: "Draw ID:",
      redrawBtn: "Start a new draw",
      confirmRedraw: "Redo the draw? You'll need to send the new links to everyone.",
      copy: "Copy",
      copied: "Copied ✓",
      whatsapp: "WhatsApp",
      waMessage: "🎅 Hi {name}! Here is your personal link for the " + FAMILY + " Secret Santa (don't share it): {url}",
      hello: "Hello {name} 🎅",
      revealIntro: "Your Secret Santa mission awaits…",
      openGift: "Open the gift",
      tapGift: "Tap the gift to find out who you're buying for.",
      youGiftTo: "You are buying a gift for:",
      keepSecret: "🤫 Shh… keep it to yourself!",
      countdown: "🎄 Only {n} day(s) until Christmas!",
      christmas: "🎄 Merry Christmas!",
      badLink: "This link isn't valid. Make sure you copied all of it, or ask the organizer to send it again.",
      footer: "Made with ❤️ for the " + FAMILY + " family · No data is stored"
    }
  };

  var lang = (function () {
    try { var s = localStorage.getItem(LANG_KEY); if (s === "fr" || s === "en") return s; } catch (e) {}
    return (navigator.language || "fr").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
  })();

  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]) || I18N.fr[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }

  // ---------- Randomness & draw ----------
  function randInt(max) { // uniform integer in [0, max)
    var buf = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  // Sattolo's algorithm: random single-cycle permutation.
  // => nobody draws themselves, and (with 3+ players) no two people draw each other.
  function draw(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = randInt(j); // 0..j-1 (never j itself)
      var tmp = a[j]; a[j] = a[k]; a[k] = tmp;
    }
    return a; // a[giver] = receiver
  }

  // ---------- Token encoding (obfuscation, not strong crypto) ----------
  var KEY = [0x47, 0x61, 0x73, 0x71, 0x75, 0x61, 0x72, 0x64, 0x58, 0x6d];

  function b64urlEncode(bytes) {
    var s = "";
    bytes.forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    var bin = atob(str), out = [];
    for (var i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    return out;
  }
  function checksum(bytes) {
    var c = 0x5a;
    bytes.forEach(function (b, i) { c = (c * 31 + b + i) & 0xff; });
    return c;
  }

  function encodeToken(drawId, giver, receiver) {
    var raw = [1, drawId[0], drawId[1], drawId[2], drawId[3], giver, receiver];
    raw.push(checksum(raw));
    return b64urlEncode(raw.map(function (b, i) {
      var k = KEY[i % KEY.length];
      if (i >= 5) k ^= drawId[i % 4];
      return b ^ k;
    }));
  }

  function decodeToken(token) {
    try {
      var x = b64urlDecode(token);
      if (x.length !== 8) return null;
      var raw = [], drawId = [];
      for (var i = 0; i < 5; i++) raw.push(x[i] ^ KEY[i % KEY.length]);
      drawId = raw.slice(1, 5);
      for (var j = 5; j < 8; j++) raw.push(x[j] ^ KEY[j % KEY.length] ^ drawId[j % 4]);
      if (raw[0] !== 1) return null;
      if (checksum(raw.slice(0, 7)) !== raw[7]) return null;
      var g = raw[5], r = raw[6];
      if (g >= PLAYERS.length || r >= PLAYERS.length || g === r) return null;
      return { drawId: drawId, giver: g, receiver: r };
    } catch (e) { return null; }
  }

  function drawIdText(id) {
    return id.map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("").toUpperCase();
  }

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function baseUrl() { return location.href.split("#")[0].split("?")[0]; }
  function linkFor(token) { return baseUrl() + "?t=" + token; }

  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
  }

  function daysToChristmas() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var xmas = new Date(now.getFullYear(), 11, 25);
    if (today > xmas) xmas = new Date(now.getFullYear() + 1, 11, 25);
    return Math.round((xmas - today) / 86400000);
  }

  function makeSnow() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var box = document.querySelector(".snow");
    var count = window.innerWidth < 600 ? 25 : 45;
    for (var i = 0; i < count; i++) {
      var f = document.createElement("span");
      f.className = "flake";
      f.textContent = Math.random() < 0.5 ? "❄" : "•";
      f.style.left = Math.random() * 100 + "vw";
      f.style.fontSize = (8 + Math.random() * 14) + "px";
      f.style.animationDuration = (8 + Math.random() * 12) + "s";
      f.style.animationDelay = (-Math.random() * 20) + "s";
      box.appendChild(f);
    }
  }

  // ---------- Organizer view ----------
  function loadDraw() {
    try { var d = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (d && d.tokens && d.tokens.length === PLAYERS.length) return d; } catch (e) {}
    return null;
  }

  function newDraw() {
    var id = [randInt(256), randInt(256), randInt(256), randInt(256)];
    var perm = draw(PLAYERS.length);
    var tokens = perm.map(function (r, g) { return encodeToken(id, g, r); });
    var d = { id: id, tokens: tokens }; // only obfuscated tokens are stored, never names-to-names
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  function renderOrganizer() {
    var pl = $("player-list");
    pl.innerHTML = "";
    PLAYERS.forEach(function (p) { var li = document.createElement("li"); li.textContent = p; pl.appendChild(li); });

    var d = loadDraw();
    $("draw-empty").hidden = !!d;
    $("draw-done").hidden = !d;
    if (!d) return;

    $("org-draw-id").textContent = drawIdText(d.id);
    var list = $("link-list");
    list.innerHTML = "";
    PLAYERS.forEach(function (name, i) {
      var url = linkFor(d.tokens[i]);
      var li = document.createElement("li");

      var span = document.createElement("span");
      span.className = "name";
      span.textContent = "🎁 " + name;

      var actions = document.createElement("div");
      actions.className = "actions";

      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn-small btn-green";
      copy.textContent = t("copy");
      copy.addEventListener("click", function () {
        var done = function () { copy.textContent = t("copied"); setTimeout(function () { copy.textContent = t("copy"); }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { window.prompt(name, url); });
        } else { window.prompt(name, url); }
      });

      var wa = document.createElement("a");
      wa.className = "btn btn-small btn-wa";
      wa.textContent = t("whatsapp");
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
      wa.href = "https://wa.me/?text=" + encodeURIComponent(t("waMessage", { name: name, url: url }));

      actions.appendChild(copy);
      actions.appendChild(wa);
      li.appendChild(span);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  // ---------- Reveal view ----------
  function renderReveal(info) {
    $("greeting").textContent = t("hello", { name: PLAYERS[info.giver] });
    $("receiver").textContent = PLAYERS[info.receiver];
    $("rev-draw-id").textContent = drawIdText(info.drawId);
    var n = daysToChristmas();
    $("countdown").textContent = n === 0 ? t("christmas") : t("countdown", { n: n });
  }

  // ---------- Init ----------
  var params = new URLSearchParams(location.search);
  var token = params.get("t");
  var info = token ? decodeToken(token) : null;

  function render() {
    applyI18n();
    if (token) {
      if (info) renderReveal(info);
    } else {
      renderOrganizer();
    }
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      lang = b.getAttribute("data-lang");
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      render();
    });
  });

  if (token) {
    if (info) {
      $("view-reveal").hidden = false;
      $("gift").addEventListener("click", function () {
        var g = $("gift");
        if (g.classList.contains("open")) return;
        g.classList.add("open");
        g.setAttribute("aria-disabled", "true");
        $("gift-hint").hidden = true;
        setTimeout(function () { $("result").hidden = false; }, 350);
      });
    } else {
      $("view-error").hidden = false;
    }
  } else {
    $("view-organizer").hidden = false;
    $("btn-draw").addEventListener("click", function () { newDraw(); render(); });
    $("btn-redraw").addEventListener("click", function () {
      if (window.confirm(t("confirmRedraw"))) { newDraw(); render(); }
    });
  }

  makeSnow();
  render();

  // Exposed for automated tests only.
  window.__ss = { draw: draw, encodeToken: encodeToken, decodeToken: decodeToken, PLAYERS: PLAYERS };
})();
