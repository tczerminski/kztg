(function () {
  "use strict";

  var PAGE_SIZE = 6;
  var grid = document.getElementById("sermons-grid");
  var nav = document.getElementById("sermons-nav");
  var searchInput = document.getElementById("sermons-search");
  var sermons;
  var filteredSermons;
  var fuse;
  var totalPages;
  var currentPage = 1;
  var prefetchedCovers = {};
  var searchTimer;
  var Fuse; // Lazy-loaded

  if (!grid || !nav || !window.SERMONS) {
    return;
  }

  function formatDate(iso) {
    if (!iso) {
      return "";
    }

    var parts = iso.split("-");

    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  function enhanceSermon(sermon) {
    var copy = {};
    var key;

    for (key in sermon) {
      if (Object.prototype.hasOwnProperty.call(sermon, key)) {
        copy[key] = sermon[key];
      }
    }

    copy.dateDisplay = formatDate(sermon.date);

    return copy;
  }

  sermons = window.SERMONS.map(enhanceSermon);
  filteredSermons = sermons.slice();

  // Fuse will be lazy-loaded on first search input
  function initializeFuse() {
    if (fuse) {
        return;
    } // Already initialized
    
    // Dynamic import of Fuse - only when needed
    return import('./vendor/fuse.mjs').then(module => {
      Fuse = module.default;
      fuse = new Fuse(sermons, {
        includeScore: true,
        threshold: 0.28,
        distance: 80,
        ignoreLocation: true,
        minMatchCharLength: 1,
        useExtendedSearch: false,
        keys: [
          { name: "title", weight: 0.55 },
          { name: "preacher", weight: 0.3 },
          { name: "dateDisplay", weight: 0.1 },
          { name: "date", weight: 0.05 },
        ],
      });
    });
  }

  totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sermonCardHTML(sermon) {
    var title = sermon.title || "";
    var preacher = sermon.preacher || "";
    var date = formatDate(sermon.date);
    var audio = sermon.audio;
    var cover = sermon.cover;

    var titleHTML = title ? '<h3 class="text-xl font-semibold text-gray-900 mb-2 transition">' +
        title +
        "</h3>"
      : '<h3 class="text-xl font-semibold text-gray-400 mb-2 transition italic">Brak tytułu</h3>';

    var preacherHTML = preacher ? '<p class="text-sm text-gray-600 mb-1">' + preacher + "</p>"
      : "";

    return (
      "" +
      '<article class="group sermon-card bg-white rounded-2xl shadow-sm hover:shadow-xl transition flex flex-col">' +
      '<div class="sermon-cover relative overflow-hidden rounded-t-2xl h-64">' +
      '<img src="' +
      cover +
      '"' +
      ' class="sermon-cover-image w-full h-full object-cover transition duration-700 ease-out group-hover:scale-105"' +
      ' alt="Okładka kazania"' +
      ' loading="lazy">' +
      '<div class="sermon-cover-overlay absolute inset-0 bg-white/60 transition duration-700 group-hover:bg-transparent"></div>' +
      "</div>" +
      '<div class="p-6 flex flex-col flex-1">' +
      titleHTML +
      preacherHTML +
      '<p class="text-sm text-gray-600 mb-4">' +
      date +
      "</p>" +
      '<div class="mt-auto w-full">' +
      '<button type="button"' +
      ' class="sermon-play-btn sermon-btn block p-3 border border-[#3f568f] rounded-xl text-[#3f568f] hover:bg-[#3f568f]/10 transition flex items-center justify-center gap-2"' +
      ' data-title="' +
      escapeAttr(title || date) +
      '"' +
      ' data-preacher="' +
      escapeAttr(preacher) +
      '"' +
      ' data-audio="' +
      escapeAttr(audio) +
      '"' +
      ' onclick="setHero(this.dataset.title, this.dataset.audio, this)">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none"' +
      ' viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
      '<polygon points="5 3 19 12 5 21 5 3"/>' +
      "</svg>" +
      "Odsłuchaj" +
      "</button>" +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function paginationNavHTML(page, total) {
    var parts = [];

    if (page > 1) {
      parts.push(
        '<button class="sermons-page-btn px-5 py-3 border border-[#3f568f] text-[#3f568f] rounded-xl hover:bg-[#3f568f]/10 transition" data-page="' +
          (page - 1) +
          '">← Nowsze</button>'
      );
    }

    parts.push(
      '<span class="text-gray-600">Strona ' + page + " z " + total + "</span>"
    );

    if (page < total) {
      parts.push(
        '<button class="sermons-page-btn px-5 py-3 border border-[#3f568f] text-[#3f568f] rounded-xl hover:bg-[#3f568f]/10 transition" data-page="' +
          (page + 1) +
          '">Starsze →</button>'
      );
    }

    return parts.join("");
  }

  function preloadCover(url) {
    var img;

    if (!url || prefetchedCovers[url]) {
      return;
    }

    prefetchedCovers[url] = true;

    img = new Image();
    img.decoding = "async";
    img.src = url;
  }

  function prefetchPageImages(page) {
    var start = (page - 1) * PAGE_SIZE;
    var items = filteredSermons.slice(start, start + PAGE_SIZE);
    var i;

    for (i = 0; i < items.length; i += 1) {
      preloadCover(items[i].cover);
    }
  }

  function prefetchAdjacentPages(page) {
    if (page > 1) {
      prefetchPageImages(page - 1);
    }

    if (page < totalPages) {
      prefetchPageImages(page + 1);
    }
  }

  var prefetchedAudio = {};

  function prefetchAudio(url) {
    if (!url || prefetchedAudio[url]) {
      return;
    }
    prefetchedAudio[url] = true;

    var link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "audio";
    link.href = url;
    document.head.appendChild(link);
  }

  function prefetchFirstPageAudio() {
    var items = filteredSermons.slice(0, PAGE_SIZE);
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (items[i].audio) {
        prefetchAudio(items[i].audio);
      }
    }
  }

  function scrollToSermons() {
    var section = document.getElementById("kazania");

    if (section && section.scrollIntoView) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function renderPage(page) {
    var start = (page - 1) * PAGE_SIZE;
    var items = filteredSermons.slice(start, start + PAGE_SIZE);
    var i;

    currentPage = page;

    grid.innerHTML = "";

    if (!items.length) {
      grid.innerHTML =
        '<p class="text-center text-gray-500">Brak wyników wyszukiwania.</p>';

      nav.innerHTML = "";

      return;
    }

    for (i = 0; i < items.length; i += 1) {
      grid.innerHTML += sermonCardHTML(items[i]);
    }

    nav.innerHTML = paginationNavHTML(page, totalPages);

    prefetchAdjacentPages(page);

    nav.querySelectorAll(".sermons-page-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        renderPage(Number(btn.dataset.page));
        scrollToSermons();
      });
    });
  }

  function updateSearchResults(query) {
    var normalized = normalizeText(query);

    if (!normalized) {
      filteredSermons = sermons.slice();
      totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
      renderPage(1);
    } else {
      // Lazy-load Fuse when search is first used
      if (!fuse) {
        initializeFuse().then(() => {
          updateSearchResults(query); // Retry search after Fuse loads
        });
        return;
      }
      
      filteredSermons = fuse
        .search(normalized)
        .sort(function (a, b) {
          return (a.score || 0) - (b.score || 0);
        })
        .map(function (entry) {
          return entry.item;
        });

      totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
      renderPage(1);
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (searchInput) {
    searchInput.addEventListener("input", function (event) {
      if (searchTimer) {
        window.clearTimeout(searchTimer);
      }

      searchTimer = window.setTimeout(function () {
        updateSearchResults(event.target.value || "");
      }, 120);
    });
  }

  renderPage(currentPage);

  // Prefetch audio for first page when browser is idle
  if (window.requestIdleCallback) {
    window.requestIdleCallback(prefetchFirstPageAudio, { timeout: 3000 });
  } else {
    window.setTimeout(prefetchFirstPageAudio, 2000);
  }
})();
