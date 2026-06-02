const body = document.body;
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const langToggle = document.querySelector(".lang-toggle");
const langLabel = document.querySelector(".lang-label");
const revealItems = document.querySelectorAll("[data-reveal]");
const tabs = document.querySelectorAll(".explorer-tab");
const panels = document.querySelectorAll(".explorer-panel");
const counters = document.querySelectorAll(".count-up");

let currentLanguage = "en";

function setLanguage(language) {
  currentLanguage = language;
  body.dataset.language = language;
  document.documentElement.lang = language === "en" ? "en" : "es";
  langLabel.textContent = language === "en" ? "ES" : "EN";
}

function toggleMenu(forceClose = false) {
  if (!menuToggle || !siteNav) {
    return;
  }

  const shouldOpen = forceClose ? false : menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(shouldOpen));
  siteNav.classList.toggle("is-open", shouldOpen);
}

function setActivePanel(panelName) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.panel === panelName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === panelName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function runCounters() {
  counters.forEach((counter) => {
    if (counter.dataset.done === "true") {
      return;
    }

    const target = Number(counter.dataset.target || 0);
    const duration = 1400;
    const startTime = performance.now();

    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.round(target * eased).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        counter.dataset.done = "true";
        counter.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(update);
  });
}

setLanguage("en");
setActivePanel("legislation");

if (langToggle) {
  langToggle.addEventListener("click", () => {
    setLanguage(currentLanguage === "en" ? "es" : "en");
  });
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => toggleMenu());
}

if (siteNav) {
  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleMenu(true));
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActivePanel(tab.dataset.panel);
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  {
    threshold: 0.16,
    rootMargin: "0px 0px -40px 0px"
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      runCounters();
      counterObserver.disconnect();
    });
  },
  {
    threshold: 0.35
  }
);

if (counters.length > 0) {
  counterObserver.observe(counters[0]);
}
