(function () {
  "use strict";

  var PAGE_SIZE = 6;
  var grid = document.getElementById("sermons-grid");
  var nav = document.getElementById("sermons-nav");
  var searchInput = document.getElementById("sermons-search");
  var sermons;
  var filteredSermons;
  var fuse;
  var fuseReadyPromise;
  var totalPages;
  var currentPage = 1;
  var prefetchedCovers = {};
  var searchTimer;

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
    copy.searchText = normalizeText(
      [copy.title, copy.preacher, copy.dateDisplay, copy.date].join(" ")
    );

    return copy;
  }

  sermons = window.SERMONS.map(enhanceSermon);
  filteredSermons = sermons.slice();

  function initializeFuse() {
    if (fuse) {
      return Promise.resolve();
    }

    if (fuseReadyPromise) {
      return fuseReadyPromise;
    }

    fuseReadyPromise = import("./vendor/fuse.mjs").then(function (module) {
      var FuseCtor = module && module.default ? module.default : module;

      fuse = new FuseCtor(sermons, {
        includeScore: false,
        useExtendedSearch: true,
        ignoreLocation: true,
        threshold: 0,
        keys: ["searchText"],
      });
    });

    return fuseReadyPromise;
  }

  totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatDuration(seconds) {
    if (!seconds) return "";
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function sermonCardHTML(sermon) {
    var title = sermon.title || "";
    var preacher = sermon.preacher || "";
    var date = formatDate(sermon.date);
    var duration = formatDuration(sermon.duration);
    var summary = sermon.summary || "";
    var audio = sermon.audio;
    var cover = sermon.cover;

    var titleHTML = title ? '<h3 class="sermon-card-title text-lg font-semibold text-gray-900 leading-tight mb-1 transition">' +
        title +
        "</h3>"
      : '<h3 class="sermon-card-title text-lg font-semibold text-gray-400 leading-tight mb-1 transition italic">Brak tytułu</h3>';

    var metaParts = [];
    if (preacher) metaParts.push('<span>' + escapeAttr(preacher) + '</span>');
    if (date) metaParts.push('<span>' + date + '</span>');
    if (duration) metaParts.push('<span>' + duration + '</span>');

    var metaHTML = '<div class="sermon-card-meta">' +
      metaParts.join('<span class="sermon-card-meta-dot">·</span>') +
      '</div>';

    var summaryHTML = summary
      ? '<p class="sermon-card-summary">' + escapeAttr(summary) + "</p>"
      : "";

    return (
      "" +
      '<article class="sermon-card bg-white rounded-2xl shadow-sm flex flex-col">' +
      '<div class="sermon-cover relative overflow-hidden rounded-t-2xl aspect-video">' +
      '<img src="' +
      cover +
      '"' +
      ' class="sermon-cover-image w-full h-full object-cover"' +
      ' alt="Okładka kazania"' +
      ' loading="lazy"' +
      ' onload="this.classList.add(\'loaded\');this.parentElement.classList.add(\'cover-ready\')"' +
      ' onerror="this.classList.add(\'loaded\');this.parentElement.classList.add(\'cover-ready\')">' +
      "</div>" +
      '<div class="sermon-card-body">' +
      titleHTML +
      metaHTML +
      summaryHTML +
      '<div class="sermon-card-action">' +
      '<div class="sermon-inline-player" data-sermon-player>' +
      '<div class="sermon-inline-player__body">' +
      '<button type="button"' +
      ' class="sermon-inline-player__toggle"' +
      ' data-title="' +
      escapeAttr(title || date) +
      '"' +
      ' data-preacher="' +
      escapeAttr(preacher) +
      '"' +
      ' data-audio="' +
      escapeAttr(audio) +
      '"' +
      ' onclick="setHero(this.dataset.title, this.dataset.audio, this)"' +
      ' aria-label="Odtwórz kazanie">' +
      '<svg data-play-icon xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"' +
      ' viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
      '<polygon points="5 3 19 12 5 21 5 3"/>' +
      "</svg>" +
      '<svg data-pause-icon xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"' +
      ' viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="hidden">' +
      '<rect x="6" y="4" width="4" height="16"/>' +
      '<rect x="14" y="4" width="4" height="16"/>' +
      "</svg>" +
      "</button>" +
      '<input type="range" min="0" max="100" value="0"' +
      ' class="sermon-inline-player__progress"' +
      ' data-sermon-progress aria-label="Postęp odtwarzania kazania">' +
      '<div class="sermon-inline-player__times">' +
      '<span data-current-time>0:00</span>' +
      '<span data-total-time>' +
      escapeAttr(duration || "0:00") +
      "</span>" +
      "</div>" +
      "</div>" +
      "</div>" +
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

    document.dispatchEvent(new CustomEvent("sermons:before-render"));
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
      initializeFuse()
        .then(function () {
          // Use Fuse include search, then enforce phrase contains exactly.
          filteredSermons = fuse
            .search("'" + normalized)
            .map(function (entry) {
              return entry.item;
            })
            .filter(function (sermon) {
              return sermon.searchText.indexOf(normalized) !== -1;
            })
            .sort(function (a, b) {
              var dateA = a && a.date ? a.date : "";
              var dateB = b && b.date ? b.date : "";

              if (dateA === dateB) {
                return 0;
              }

              // ISO yyyy-mm-dd sorts correctly as plain strings.
              return dateA > dateB ? -1 : 1;
            });

          totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
          renderPage(1);
        })
        .catch(function () {
          filteredSermons = sermons
            .filter(function (sermon) {
              return sermon.searchText.indexOf(normalized) !== -1;
            })
            .sort(function (a, b) {
              var dateA = a && a.date ? a.date : "";
              var dateB = b && b.date ? b.date : "";

              if (dateA === dateB) {
                return 0;
              }

              return dateA > dateB ? -1 : 1;
            });

          totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
          renderPage(1);
        });
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

    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        searchInput.blur();
      }
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
