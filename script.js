const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const revealItems = document.querySelectorAll("[data-reveal]");

const legislationItems = [
  {
    title: "Party balloon ban in public marinas, parks, marine facilities, and city beaches",
    role: "Main sponsor",
    topic: "Environment",
    year: "2024",
    summary: "City release identifies Commissioner Suarez as sponsor of the ordinance prohibiting party balloons in key public spaces to protect waterways and marine life.",
    source: "City press release",
    url: "https://www.miamibeachfl.gov/miami-beach-prohibits-party-balloons-in-public-marinas-parks-and-beaches/",
    tags: ["balloons", "marine debris", "parks", "beaches"]
  },
  {
    title: "Remove eco-tours exception to marina hours of operation",
    role: "Main sponsor",
    topic: "Waterways",
    year: "2025",
    summary: "Ordinance item sponsored by Commissioner Suarez addressing vessel departure-hour exceptions at publicly owned marinas and marine facilities.",
    source: "City Clerk document",
    url: "https://docmgmt.miamibeachfl.gov/WebLink/ElectronicFile.aspx?dbid=0&docid=299211&repo=CityClerk",
    tags: ["marinas", "charters", "quality of life"]
  },
  {
    title: "Sound regulations for vessels and floating structures",
    role: "Main sponsor",
    topic: "Waterways",
    year: "2025",
    summary: "Official agenda minutes identify Commissioner Suarez as sponsor of a noise item for vessels and floating structures, with public comment and commission discussion recorded.",
    source: "Official agenda minutes",
    url: "https://miamibeach.novusagenda.com/AgendaPublic/MinutesView.aspx?MinutesMeetingID=273",
    tags: ["noise", "vessels", "floating structures", "quality of life"]
  },
  {
    title: "Metromover extension opposition resolution",
    role: "Main sponsor",
    topic: "Transportation",
    year: "2025",
    summary: "Official agenda item lists Commissioner Suarez as sponsor, with Commissioner Dominguez as co-sponsor, for a resolution opposing extension of the Metromover into Miami Beach.",
    source: "Official agenda item",
    url: "https://miamibeach.novusagenda.com/agendapublic/CoverSheet.aspx?ItemID=37718&MeetingID=1381",
    tags: ["transportation", "metromover", "resolution"]
  },
  {
    title: "Anchoring limitations and derelict-vessel advocacy",
    role: "Presented",
    topic: "Waterways",
    year: "2025",
    summary: "Public deck presented by Commissioner Suarez on derelict and abandoned boats, Miami Beach examples, and statewide anchoring limitations.",
    source: "City Clerk presentation",
    url: "https://docmgmt.miamibeachfl.gov/WebLink/edoc/309503/R5%20I%20Anchoring%20Legislation.pdf?dbid=0&repo=CityClerk",
    tags: ["anchoring", "derelict boats", "state legislation"]
  },
  {
    title: "Repeal civil citation option for certain marijuana-related offenses",
    role: "Co-sponsor",
    topic: "Public safety",
    year: "2024",
    summary: "Business impact estimate identifies the item as sponsored by Commissioner Alex Fernandez and co-sponsored by Mayor Steven Meiner and Commissioner Suarez.",
    source: "Business impact estimate",
    url: "https://docmgmt.miamibeachfl.gov/WebLink/edoc/294032/BIE%20-%20Repeal%20Decriminalization%20of%20Marijuana%20Related%20Offenses.%20%28292024%29.pdf?dbid=0&repo=CityClerk",
    tags: ["public safety", "ordinance", "co-sponsor"]
  },
  {
    title: "Water management expert alternative for land use boards",
    role: "Co-sponsor",
    topic: "Environment",
    year: "2025",
    summary: "Official agenda item lists Commissioner Laura Dominguez as sponsor and Commissioner Suarez as co-sponsor for allowing water management experts as an alternative to floodplain managers on land use boards.",
    source: "Official agenda item",
    url: "https://miamibeach.novusagenda.com/agendapublic/CoverSheet.aspx?ItemID=38415&MeetingID=1411",
    tags: ["land use boards", "water management", "floodplain", "co-sponsor"]
  },
  {
    title: "Humane wildlife removal before closing crawlspaces or tenting structures",
    role: "Background record",
    topic: "Animal welfare",
    year: "2024",
    summary: "Animal Welfare Committee agenda notes the crawlspace ordinance passed unanimously on December 11, 2024 and required humane removal before closing crawlspaces or tenting structures.",
    source: "Committee agenda",
    url: "https://docmgmt.miamibeachfl.gov/WebLink/edoc/301750/12.17%20AWC%20Agenda.pdf?dbid=0&repo=CityClerk",
    tags: ["animal welfare", "crawlspaces", "humane removal"]
  },
  {
    title: "Short-term rental prohibition in his neighborhood",
    role: "Background record",
    topic: "Neighborhoods",
    year: "Public bio",
    summary: "Official city bio credits Suarez with championing legislation prohibiting short-term rentals in his neighborhood to preserve residential character.",
    source: "Official city bio",
    url: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/commissioner-david-suarez/",
    tags: ["short-term rentals", "residential character", "neighborhoods"]
  },
  {
    title: "Disabled placard and valet parking loophole",
    role: "Background record",
    topic: "Neighborhoods",
    year: "Public bio",
    summary: "Official city bio credits Suarez with addressing a 70-year loophole involving valet operators abusing disabled placards and parking in residential areas.",
    source: "Official city bio",
    url: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/commissioner-david-suarez/",
    tags: ["parking", "valet", "quality of life"]
  }
];

function toggleMenu(forceClose = false) {
  if (!menuToggle || !siteNav) {
    return;
  }

  const shouldOpen = forceClose ? false : menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(shouldOpen));
  siteNav.classList.toggle("is-open", shouldOpen);
}

function renderLegislation() {
  const list = document.querySelector("#legislation-list");
  const count = document.querySelector("#legislation-count");
  const search = document.querySelector("#legislation-search");
  const role = document.querySelector("#role-filter");
  const topic = document.querySelector("#topic-filter");

  if (!list || !count || !search || !role || !topic) {
    return;
  }

  const query = search.value.trim().toLowerCase();
  const roleValue = role.value;
  const topicValue = topic.value;

  const filtered = legislationItems.filter((item) => {
    const haystack = [item.title, item.role, item.topic, item.year, item.summary, item.source, ...item.tags]
      .join(" ")
      .toLowerCase();
    return (roleValue === "all" || item.role === roleValue)
      && (topicValue === "all" || item.topic === topicValue)
      && (!query || haystack.includes(query));
  });

  count.textContent = `${filtered.length} source-backed ${filtered.length === 1 ? "record" : "records"} shown`;

  list.innerHTML = filtered.length
    ? filtered.map((item) => `
      <article class="record-card">
        <div>
          <span class="record-status">${item.role}</span>
        </div>
        <div>
          <h3>${item.title}</h3>
          <p class="record-copy">${item.summary}</p>
          <div class="record-tags">
            <span>${item.topic}</span>
            <span>${item.year}</span>
            ${item.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
        </div>
        <a href="${item.url}" target="_blank" rel="noreferrer">${item.source}</a>
      </article>
    `).join("")
    : `<article class="record-card"><div></div><div><h3>No matching records</h3><p class="record-copy">Clear the filters or search another keyword.</p></div></article>`;
}

if (menuToggle) {
  menuToggle.addEventListener("click", () => toggleMenu());
}

if (siteNav) {
  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleMenu(true));
  });
}

["#legislation-search", "#role-filter", "#topic-filter"].forEach((selector) => {
  const element = document.querySelector(selector);
  if (element) {
    element.addEventListener("input", renderLegislation);
    element.addEventListener("change", renderLegislation);
  }
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
    threshold: 0.14,
    rootMargin: "0px 0px -30px 0px"
  }
);

revealItems.forEach((item) => revealObserver.observe(item));
renderLegislation();
