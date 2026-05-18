(function () {
  'use strict';

  var PAGE_SIZE = 6;
  var grid = document.getElementById('sermons-grid');
  var nav = document.getElementById('sermons-nav');
  var sermons;
  var totalPages;
  var currentPage = 1;
  var prefetchedCovers = {};

  if (!grid || !nav || !window.SERMONS) {
    return;
  }

  sermons = window.SERMONS;
  totalPages = Math.ceil(sermons.length / PAGE_SIZE);

  function formatDate(iso) {
    var parts = iso.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sermonCardHTML(sermon) {
    var title = sermon.title || '';
    var preacher = sermon.preacher || '';
    var date = formatDate(sermon.date);
    var audio = sermon.audio;
    var cover = sermon.cover;
    var titleHTML = title
      ? '<h3 class="text-xl font-semibold text-gray-900 mb-2 transition">' + title + '</h3>'
      : '<h3 class="text-xl font-semibold text-gray-400 mb-2 transition italic">Brak tytułu</h3>';
    var preacherHTML = preacher
      ? '<p class="text-sm text-gray-600 mb-1">' + preacher + '</p>'
      : '';

    return '' +
      '<article class="group sermon-card bg-white rounded-2xl shadow-sm hover:shadow-xl transition flex flex-col">' +
        '<div class="sermon-cover relative overflow-hidden rounded-t-2xl h-64">' +
          '<img src="' + cover + '"' +
               ' class="sermon-cover-image w-full h-full object-cover transition duration-700 ease-out group-hover:scale-105"' +
               ' alt="Okładka kazania"' +
               ' loading="lazy">' +
          '<div class="sermon-cover-overlay absolute inset-0 bg-white/60 transition duration-700 group-hover:bg-transparent"></div>' +
        '</div>' +
        '<div class="p-6 flex flex-col flex-1">' +
          titleHTML +
          preacherHTML +
          '<p class="text-sm text-gray-500 mb-4">' + date + '</p>' +
          '<div class="mt-auto w-full">' +
            '<button type="button"' +
                    ' class="sermon-play-btn sermon-btn block p-3 border border-[#6f85b8] rounded-xl text-[#6f85b8] hover:bg-[#6f85b8]/10 transition flex items-center justify-center gap-2"' +
                    ' data-title="' + escapeAttr(title || date) + '"' +
                    ' data-preacher="' + escapeAttr(preacher) + '"' +
                    ' data-audio="' + escapeAttr(audio) + '"' +
                    ' onclick="setHero(this.dataset.title, this.dataset.audio, this)">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none"' +
                   ' viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
                '<polygon points="5 3 19 12 5 21 5 3"/>' +
              '</svg>' +
              'Odsłuchaj' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function paginationNavHTML(page, total) {
    var parts = [];

    if (page > 1) {
      parts.push('<button class="sermons-page-btn px-5 py-3 border border-[#6f85b8] text-[#6f85b8] rounded-xl hover:bg-[#6f85b8]/10 transition" data-page="' + (page - 1) + '">← Nowsze</button>');
    }

    parts.push('<span class="text-gray-600">Strona ' + page + ' z ' + total + '</span>');

    if (page < total) {
      parts.push('<button class="sermons-page-btn px-5 py-3 border border-[#6f85b8] text-[#6f85b8] rounded-xl hover:bg-[#6f85b8]/10 transition" data-page="' + (page + 1) + '">Starsze →</button>');
    }

    return parts.join('');
  }

  function preloadCover(url) {
    var img;

    if (!url || prefetchedCovers[url]) {
      return;
    }

    prefetchedCovers[url] = true;
    img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  function prefetchPageImages(page) {
    var start = (page - 1) * PAGE_SIZE;
    var items = sermons.slice(start, start + PAGE_SIZE);
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

  function scrollToSermons() {
    var section = document.getElementById('kazania');
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderPage(page) {
    var start = (page - 1) * PAGE_SIZE;
    var items = sermons.slice(start, start + PAGE_SIZE);
    var i;

    currentPage = page;

    grid.innerHTML = '';
    for (i = 0; i < items.length; i += 1) {
      grid.innerHTML += sermonCardHTML(items[i]);
    }

    nav.innerHTML = paginationNavHTML(page, totalPages);
    prefetchAdjacentPages(page);

    nav.querySelectorAll('.sermons-page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderPage(Number(btn.dataset.page));
        scrollToSermons();
      });
    });
  }

  renderPage(currentPage);
}());

