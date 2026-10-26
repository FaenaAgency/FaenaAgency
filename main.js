/* ==========================================================================
   fæna — The Wild Editorial
   Motion: Lenis (heavy scroll) + GSAP ScrollTrigger
   ========================================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const isMobile = () => innerWidth <= 860;

  // interface words the script writes, per page language (<html lang>)
  const WORDS = {
    en: { view: "view", menu: "( MENU )", close: "( CLOSE )", play: "( PLAY MUSIC )", pause: "( PAUSE MUSIC )", playA: "Play music", pauseA: "Pause music", copied: "( COPIED )" },
    es: { view: "ver", menu: "( MENÚ )", close: "( CERRAR )", play: "( PONER MÚSICA )", pause: "( PAUSAR MÚSICA )", playA: "Poner música", pauseA: "Pausar música", copied: "( CORREO COPIADO )" },
  };
  const T = WORDS[document.documentElement.lang.slice(0, 2)] || WORDS.en;

  /* ------------------------------------------------------------------ text splitting */
  function splitChars(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            [...part].forEach((c) => {
              const s = document.createElement("span");
              s.className = "ch";
              s.textContent = c;
              w.appendChild(s);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$(".ch", el);
  }

  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const s = document.createElement("span");
            s.className = "word";
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName === "EM") n.classList.add("word");
        else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$(".word", el);
  }

  /* ------------------------------------------------------------------ clock */
  function clock() {
    const el = $(".js-clock");
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    tick(); setInterval(tick, 20000);
  }

  /* ------------------------------------------------------------------ cursor */
  function cursor() {
    const c = $(".cursor");
    if (!fine || !c) return;
    const label = $(".cursor__label", c);
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
    document.addEventListener("mouseleave", () => c.classList.add("is-hidden"));
    document.addEventListener("mouseenter", () => c.classList.remove("is-hidden"));
    document.addEventListener("mouseover", (e) => {
      const view = e.target.closest("[data-cursor='view']");
      const link = e.target.closest("a, button, .species__row");
      c.classList.toggle("is-view", !!view);
      c.classList.toggle("is-link", !view && !!link);
      if (view) label.textContent = view.dataset.cursorLabel || T.view;
    });
    const loop = () => {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ------------------------------------------------------------------ species hover image */
  function speciesFloat() {
    const list = $(".species"), fig = $(".species__float");
    if (!list || !fig || !fine) return;
    const img = $("img", fig);
    $$(".species__row", list).forEach((row) => { new Image().src = row.dataset.img; });
    let x = 0, y = 0, fx = 0, fy = 0, on = false;
    list.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
    $$(".species__row", list).forEach((row) => {
      row.addEventListener("mouseenter", () => {
        if (img.getAttribute("src") !== row.dataset.img) img.src = row.dataset.img;
        fig.classList.add("is-on"); on = true;
      });
    });
    const off = () => { fig.classList.remove("is-on"); on = false; };
    list.addEventListener("mouseleave", off);
    addEventListener("wheel", off, { passive: true });
    const loop = () => {
      fx += (x - fx) * 0.12; fy += (y - fy) * 0.12;
      const rot = Math.max(-12, Math.min(12, (x - fx) * 0.08));
      if (on) fig.style.translate = `${fx + 30}px ${fy - fig.offsetHeight / 2}px`;
      fig.style.rotate = rot + "deg";
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ------------------------------------------------------------------ menu */
  function menu(lenis) {
    const btn = $(".js-menu"), m = $("#menu");
    const set = (open) => {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open);
      btn.textContent = open ? T.close : T.menu;
      m.setAttribute("aria-hidden", !open);
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    btn.addEventListener("click", () => set(!document.body.classList.contains("menu-open")));
    addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    $$("a", m).forEach((a) => a.addEventListener("click", () => set(false)));
  }

  /* ------------------------------------------------------------------ music (off by default) */
  // Plays the Spotify link set on .js-player[data-spotify] through Spotify's embed,
  // loaded only on the first click. With no link set, it falls back to soft rain.
  function sound() {
    const btn = $(".js-sound"), txt = $(".sound__txt", btn);
    const panel = $(".js-player"), mount = $(".js-spotify", panel);
    const match = (panel.dataset.spotify || "").match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
    const uri = match ? `spotify:${match[1]}:${match[2]}` : null;
    let ctx, rain, controller, apiRequested = false, started = false;

    const rainOn = (on) => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = b.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.3 + last * 3; }
        const n = ctx.createBufferSource(); n.buffer = b; n.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
        rain = ctx.createGain(); rain.gain.value = 0;
        n.connect(lp).connect(rain).connect(ctx.destination); n.start();
      }
      ctx.resume();
      rain.gain.cancelScheduledValues(ctx.currentTime);
      rain.gain.linearRampToValueAtTime(on ? 0.22 : 0, ctx.currentTime + (on ? 2 : 0.8));
    };

    const setState = (on) => {
      btn.setAttribute("aria-pressed", on);
      btn.setAttribute("aria-label", on ? T.pauseA : T.playA);
      txt.textContent = on ? T.pause : T.play;
    };

    const showPanel = (open) => {
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", !open);
    };

    const loadSpotify = () => {
      apiRequested = true;
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        IFrameAPI.createController(mount, { uri, width: "100%", height: 80 }, (c) => {
          controller = c;
          c.addListener("ready", () => c.play());
          // keep our toggle honest if someone pauses inside Spotify's player
          c.addListener("playback_update", (e) => {
            if (!e.data.isPaused) started = true;
            if (started) setState(!e.data.isPaused);
          });
        });
      };
      const s = document.createElement("script");
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.async = true;
      document.body.appendChild(s);
    };

    btn.addEventListener("click", () => {
      const on = btn.getAttribute("aria-pressed") !== "true";
      setState(on);
      if (!uri) { rainOn(on); return; }
      showPanel(on);
      if (!on) { if (controller) controller.pause(); return; }
      if (!apiRequested) loadSpotify();
      else if (controller) controller.resume();
    });

    $(".js-player-close", panel).addEventListener("click", () => {
      if (controller) controller.pause();
      showPanel(false);
      setState(false);
    });
  }

  /* ------------------------------------------------------------------ copy email */
  // The address stays out of sight; this puts it on the clipboard for anyone without a mail app.
  function copyEmail() {
    $$(".js-copy").forEach((btn) => {
      const label = btn.textContent;
      btn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(btn.dataset.email); btn.textContent = T.copied; }
        catch (e) { location.href = `mailto:${btn.dataset.email}`; return; }
        btn.classList.add("is-copied");
        setTimeout(() => { btn.textContent = label; btn.classList.remove("is-copied"); }, 2200);
      });
    });
  }

  /* ------------------------------------------------------------------ loader */
  function loader() {
    return new Promise((resolve) => {
      const count = $(".loader__count");
      let n = 0, ready = false;
      const done = () => { ready = true; };
      Promise.race([
        Promise.all([document.fonts ? document.fonts.ready : 0, new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r)))]),
        new Promise((r) => setTimeout(r, 3500)),
      ]).then(done);
      const t0 = performance.now();
      const step = () => {
        const p = Math.min((performance.now() - t0) / 1600, ready ? 1 : 0.86);
        n = Math.max(n, p * 100);
        count.textContent = String(Math.floor(n)).padStart(2, "0");
        if (n >= 100) {
          document.body.classList.remove("is-loading");
          document.body.classList.add("is-loaded");
          resolve();
        } else setTimeout(step, 30);
      };
      step();
    });
  }

  /* ==================================================================== init */
  clock();
  cursor();
  speciesFloat();
  sound();
  copyEmail();

  const charsMap = new Map();
  $$("[data-split]").forEach((el) => charsMap.set(el, splitChars(el)));
  const quote = $(".js-words");
  const quoteWords = quote ? splitWords(quote) : [];

  if (!window.gsap || !window.ScrollTrigger || reduce) {
    menu(null);
    loader();
    quoteWords.forEach((w) => (w.style.opacity = 1));
    $$(".card--hero, .scene__top, .scene__bot").forEach((el) => (el.style.opacity = 1));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // heavy, slow scroll — walking through the forest
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  menu(lenis);

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis ? lenis.scrollTo(target, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 4) }) : (target === 0 ? scrollTo(0, 0) : target.scrollIntoView());
    });
  });

  /* ---------- hero: pinned transformation ---------- */
  const heroChars = [".ht--1", ".ht--2"].flatMap((s) => charsMap.get($(s)) || []);
  gsap.set(heroChars, { yPercent: 60, opacity: 0, filter: "blur(10px)" });

  const cards = $$(".hero__cards .card");
  const fan = cards.map((c) => c.dataset.fan.split(",").map(Number));
  const cardW = () => (isMobile() ? innerWidth * 0.34 : Math.min(250, Math.max(130, innerWidth * 0.15)));

  gsap.set(cards, { xPercent: -50, yPercent: -50 });
  gsap.set(".card--hero", { xPercent: -50, yPercent: -50 });

  const heroTl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: () => "+=" + innerHeight * 3.4,
      scrub: 1.2,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  heroTl
    .to(".hero__bg", { scale: 1.14, duration: 9, ease: "none" }, 0)
    .fromTo(".hero__ui", { opacity: 1 }, { opacity: 0, duration: 1, immediateRender: false }, 0.2)
    .to(".flora__item", { x: (i, el) => el.dataset.dx + "vw", y: (i, el) => el.dataset.dy + "vh", opacity: 0.55, duration: 4.5 }, 0.3)
    .to(".hero__seal", { y: "-4vh", opacity: 0.18, duration: 2.6 }, 0.6)
    .fromTo(cards,
      { x: 0, y: 0, rotation: 0, scale: 0.25, opacity: 0, width: cardW },
      { x: (i) => fan[i][0] + "vw", y: (i) => fan[i][1] + "vh", rotation: (i) => fan[i][2], scale: 1, opacity: 1, width: cardW, stagger: 0.07, duration: 2.2, ease: "power3.out" }, 2.2)
    .fromTo(".card--hero",
      { width: cardW, height: () => cardW() * 1.33, rotation: -9, scale: 0.3, opacity: 0 },
      { rotation: 0, scale: 1, opacity: 1, duration: 1.2, ease: "power3.out" }, 4.2)
    .to(cards, { x: (i) => fan[i][0] * 2.8 + "vw", y: (i) => fan[i][1] * 3 + "vh", rotation: (i) => fan[i][2] * 2, opacity: 0, duration: 2.2, ease: "power2.in" }, 5.2)
    .to(".card--hero", { width: () => innerWidth, height: () => innerHeight, duration: 2.4 }, 5.4)
    .to(".hero__title", { opacity: 0, duration: 1 }, 6.2)
    .fromTo(".scene__lockup", { xPercent: -50, yPercent: -50, opacity: 0, y: 30 }, { xPercent: -50, yPercent: -50, opacity: 1, y: 0, duration: 2, ease: "power2.out" }, 5.8)
    .to([".scene__top", ".scene__bot"], { opacity: 1, stagger: 0.12, duration: 0.8 }, 7.2)
    .to({}, { duration: 0.8 });

  /* ---------- char reveals for every other split headline ---------- */
  charsMap.forEach((chars, el) => {
    if (el.closest(".hero")) return;
    gsap.from(chars, {
      yPercent: 40, opacity: 0, filter: "blur(8px)",
      stagger: 0.025, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  /* ---------- manifesto: words wake up ---------- */
  gsap.to(quoteWords, {
    opacity: 1, stagger: 0.2, ease: "none",
    scrollTrigger: { trigger: quote, start: "top 78%", end: "bottom 40%", scrub: true },
  });
  /* ---------- parallax ---------- */
  $$("[data-speed]").forEach((el) => {
    const s = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { y: () => -s * innerHeight * 0.5 }, {
      y: () => s * innerHeight * 0.5, ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
    });
  });

  /* ---------- the canopy band drifts as you pass beneath it ---------- */
  gsap.fromTo(".interlude__img", { yPercent: -6 }, {
    yPercent: 6, ease: "none",
    scrollTrigger: { trigger: ".interlude", start: "top bottom", end: "bottom top", scrub: true },
  });

  /* ---------- nav colour on light sections ---------- */
  $$("[data-light]").forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: "top 40px", end: "bottom 40px",
      onToggle: (self) => document.body.classList.toggle("nav-dark", self.isActive),
    });
  });

  /* ---------- intro ---------- */
  loader().then(() => {
    const intro = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: () => lenis && lenis.start() });
    intro
      .from(".hero__bg", { scale: 1.25, duration: 2.6, ease: "power3.out" }, 0)
      .to(heroChars, { yPercent: 0, opacity: 1, filter: "blur(0px)", stagger: 0.04, duration: 1.8 }, 0.5)
      .from(".hero__seal", { opacity: 0, scale: 0.97, duration: 2, ease: "power2.out" }, 0.2)
      .from(".flora__item", { opacity: 0, x: (i, el) => el.dataset.dx * 1.6 + "vw", y: (i, el) => el.dataset.dy * 1.6 + "vh", stagger: 0.15, duration: 2.6, ease: "power3.out" }, 0)
      .from(".hero__ui > *", { opacity: 0, y: 10, stagger: 0.08, duration: 1.2, ease: "power1.out" }, 1.4)
      .from(".nav", { opacity: 0, y: -20, duration: 1, clearProps: "transform" }, 1.2);
  });

  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener("load", () => ScrollTrigger.refresh());
})();
