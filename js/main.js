/* ==========================================================================
   Irfan Nadhir — Portfolio
   Vanilla JS: theme toggle, nav, scroll reveal, typewriter, contact form.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Theme toggle ---------- */
  const themeToggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  function getSavedTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"
    );
  }

  setTheme(getSavedTheme());

  themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(next);
  });

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  const navLinks = navMenu.querySelectorAll("a[href^='#']");

  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    navToggle.setAttribute("aria-label", open ? "Buka menu navigasi" : "Tutup menu navigasi");
    navMenu.classList.toggle("is-open", !open);
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      navMenu.classList.remove("is-open");
    });
  });

  /* ---------- Scroll spy (active nav link) ---------- */
  const sections = document.querySelectorAll("main section[id]");

  const spyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle(
            "is-active",
            link.getAttribute("href") === "#" + id
          );
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );

  sections.forEach((section) => spyObserver.observe(section));

  /* ---------- Scroll reveal (with stagger) ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    revealEls.forEach((el, i) => {
      el.style.transitionDelay = (i % 6) * 60 + "ms";
    });

    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add("is-visible");
            setTimeout(() => {
              el.style.transitionDelay = "";
            }, 700);
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Scroll progress bar ---------- */
  const progress = document.getElementById("scrollProgress");

  const updateProgress = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progress.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + "%";
  };

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------- Cursor glow (mouse devices only) ---------- */
  const glow = document.getElementById("cursorGlow");

  if (glow && window.matchMedia("(pointer: fine)").matches && !reduceMotion) {
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;

    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!glow.classList.contains("is-active")) glow.classList.add("is-active");
    });

    const offset = 160;
    (function glide() {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      glow.style.transform = "translate(" + (x - offset) + "px, " + (y - offset) + "px)";
      requestAnimationFrame(glide);
    })();
  }

  /* ---------- Tilt effect on cards ---------- */
  const tiltCards = document.querySelectorAll(".skill");

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    tiltCards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--rx", -py * 8 + "deg");
        card.style.setProperty("--ry", px * 8 + "deg");
      });
      card.addEventListener("mouseleave", () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Typewriter ---------- */
  const typeTarget = document.getElementById("typeTarget");
  const typedText = "start portfolio --deploy=github.io";

  if (typeTarget && !reduceMotion) {
    let i = 0;
    (function type() {
      if (i <= typedText.length) {
        typeTarget.textContent = typedText.slice(0, i);
        i += 1;
        setTimeout(type, 42);
      }
    })();
  } else if (typeTarget) {
    typeTarget.textContent = typedText;
  }

  /* ---------- Contact form (Google Sheets) ---------- */
  const form = document.getElementById("contactForm");
  if (form) {
    const scriptURL =
      "https://script.google.com/macros/s/AKfycby74-svO1z-XlbPbSeAEIWnep-Rhdp8B6BiUyf0rvjNDE1cDay0iXvtLAIdRXi-ExFa5w/exec";
    const successMsg = document.getElementById("formSuccess");
    const errorMsg = document.getElementById("formError");
    const submitBtn = document.getElementById("formSubmit");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      successMsg.classList.add("d-none");
      errorMsg.classList.add("d-none");
      form.classList.add("is-loading");
      submitBtn.disabled = true;

      fetch(scriptURL, {
        method: "POST",
        body: new FormData(form),
      })
        .then(() => {
          form.reset();
          successMsg.classList.remove("d-none");
          successMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        })
        .catch(() => {
          errorMsg.classList.remove("d-none");
        })
        .finally(() => {
          form.classList.remove("is-loading");
          submitBtn.disabled = false;
        });
    });
  }

  /* ---------- Footer year ---------- */
  const year = new Date().getFullYear();
  document.getElementById("year").textContent = year;
  document.getElementById("year2").textContent = year;
})();