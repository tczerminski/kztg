import type { SermonView } from "../lib/sermons";

interface ClientStrings {
  noTitle: string;
  play: string;
  progress: string;
  cover: string;
  newer: string;
  older: string;
  page: string;
  noResults: string;
  aiGenerated: string;
  aiVoice: string;
  viewDetails: string;
}

const PAGE_SIZE = 6;

export function initSermonsClient(): void {
  const grid = document.getElementById("sermons-grid");
  const nav = document.getElementById("sermons-nav");
  const searchInput = document.getElementById("sermons-search") as HTMLInputElement | null;
  const dataEl = document.getElementById("sermons-data");
  const i18nEl = document.getElementById("sermons-i18n");

  if (!grid || !nav || !dataEl || !i18nEl) return;

  const sermons: SermonView[] = JSON.parse(dataEl.textContent || "[]");
  const strings: ClientStrings = JSON.parse(i18nEl.textContent || "{}");

  let filteredSermons = sermons.slice();
  let totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
  let fuse: import("fuse.js").default<SermonView> | null = null;
  let fuseReadyPromise: Promise<void> | null = null;
  const prefetchedCovers: Record<string, boolean> = {};
  const prefetchedAudio: Record<string, boolean> = {};
  let searchTimer: number | undefined;

  function escapeAttr(value: string | undefined | null): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sermonCardHTML(sermon: SermonView): string {
    const titleText = sermon.title ? escapeAttr(sermon.title) : escapeAttr(strings.noTitle);
    const titleHTML = sermon.title
      ? `<h3 class="sermon-card-title text-lg font-semibold text-gray-900 leading-tight mb-1 transition"><a href="${escapeAttr(sermon.href)}" class="hover:underline">${titleText}</a></h3>`
      : `<h3 class="sermon-card-title text-lg font-semibold text-gray-400 leading-tight mb-1 transition italic"><a href="${escapeAttr(sermon.href)}" class="hover:underline">${titleText}</a></h3>`;

    const metaParts = [sermon.preacher, sermon.dateDisplay, sermon.durationDisplay].filter(Boolean);
    const metaHTML =
      `<div class="sermon-card-meta">` +
      metaParts.map((p) => `<span>${escapeAttr(p)}</span>`).join(`<span class="sermon-card-meta-dot">·</span>`) +
      `</div>`;

    const summaryHTML = sermon.summary
      ? `<p class="sermon-card-summary">${escapeAttr(sermon.summary)} <span class="ai-badge" aria-label="${escapeAttr(strings.aiGenerated)}">✦ AI</span></p>`
      : "";

    return (
      `<article class="sermon-card bg-white rounded-2xl shadow-sm flex flex-col">` +
      `<a href="${escapeAttr(sermon.href)}" class="sermon-cover block relative overflow-hidden rounded-t-2xl aspect-video">` +
      `<img src="${escapeAttr(sermon.cover)}" class="sermon-cover-image w-full h-full object-cover" alt="${escapeAttr(strings.cover)}" loading="lazy" ` +
      `onload="this.classList.add('loaded');this.parentElement.classList.add('cover-ready')" ` +
      `onerror="this.classList.add('loaded');this.parentElement.classList.add('cover-ready')">` +
      `</a>` +
      `<div class="sermon-card-body">` +
      titleHTML +
      metaHTML +
      summaryHTML +
      `<div class="sermon-card-action">` +
      `<div class="sermon-inline-player" data-sermon-player>` +
      `<div class="sermon-inline-player__body">` +
      `<button type="button" class="sermon-inline-player__toggle" data-sermon-play ` +
      `data-title="${escapeAttr(sermon.title || sermon.dateDisplay)}" data-preacher="${escapeAttr(sermon.preacher)}" data-audio="${escapeAttr(sermon.audio)}" ` +
      `aria-label="${escapeAttr(strings.play)}">` +
      `<svg data-play-icon xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>` +
      `<svg data-pause-icon xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="hidden"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>` +
      `</button>` +
      `<input type="range" min="0" max="100" value="0" class="sermon-inline-player__progress" data-sermon-progress data-duration="${sermon.duration || 0}" aria-label="${escapeAttr(strings.progress)}">` +
      `<div class="sermon-inline-player__times"><span data-current-time>0:00</span><span data-total-time>${escapeAttr(sermon.durationDisplay || "0:00")}</span></div>` +
      (sermon.isTTS ? `<div class="sermon-tts-notice">${escapeAttr(strings.aiVoice)}</div>` : "") +
      `</div></div></div>` +
      `<a href="${escapeAttr(sermon.href)}" class="sermon-card-details-link">${escapeAttr(strings.viewDetails)}` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>` +
      `</a></div></article>`
    );
  }

  function paginationNavHTML(page: number, total: number): string {
    const parts: string[] = [];

    if (page > 1) {
      parts.push(
        `<button class="sermons-page-btn px-5 py-3 border border-[#3f568f] text-[#3f568f] rounded-xl hover:bg-[#3f568f]/10 transition" data-page="${page - 1}">${escapeAttr(strings.newer)}</button>`,
      );
    }

    parts.push(`<span class="text-gray-600">${strings.page.replace("{page}", String(page)).replace("{total}", String(total))}</span>`);

    if (page < total) {
      parts.push(
        `<button class="sermons-page-btn px-5 py-3 border border-[#3f568f] text-[#3f568f] rounded-xl hover:bg-[#3f568f]/10 transition" data-page="${page + 1}">${escapeAttr(strings.older)}</button>`,
      );
    }

    return parts.join("");
  }

  function preloadCover(url?: string): void {
    if (!url || prefetchedCovers[url]) return;
    prefetchedCovers[url] = true;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }

  function prefetchPageImages(page: number): void {
    const start = (page - 1) * PAGE_SIZE;
    filteredSermons.slice(start, start + PAGE_SIZE).forEach((s) => preloadCover(s.cover));
  }

  function prefetchAdjacentPages(page: number): void {
    if (page > 1) prefetchPageImages(page - 1);
    if (page < totalPages) prefetchPageImages(page + 1);
  }

  function isConstrainedConnection(): boolean {
    const conn = (navigator as any).connection;
    if (!conn) return false;
    if (conn.saveData) return true;
    return ["slow-2g", "2g", "3g"].includes(conn.effectiveType);
  }

  function prefetchAudio(url?: string): void {
    if (!url || prefetchedAudio[url] || isConstrainedConnection()) return;
    prefetchedAudio[url] = true;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "audio";
    link.href = url;
    document.head.appendChild(link);
  }

  const AUDIO_PREFETCH_COUNT = 1;

  function prefetchFirstPageAudio(): void {
    if (isConstrainedConnection()) return;
    filteredSermons.slice(0, AUDIO_PREFETCH_COUNT).forEach((s) => prefetchAudio(s.audio));
  }

  function scrollToSermons(): void {
    document.getElementById("sermons")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderPage(page: number): void {
    if (!grid || !nav) return;
    const start = (page - 1) * PAGE_SIZE;
    const items = filteredSermons.slice(start, start + PAGE_SIZE);

    document.dispatchEvent(new CustomEvent("sermons:before-render"));
    grid.innerHTML = "";

    if (!items.length) {
      grid.innerHTML = `<p class="text-center text-gray-500">${escapeAttr(strings.noResults)}</p>`;
      nav.innerHTML = "";
      return;
    }

    grid.innerHTML = items.map(sermonCardHTML).join("");
    nav.innerHTML = paginationNavHTML(page, totalPages);

    prefetchAdjacentPages(page);

    nav.querySelectorAll<HTMLButtonElement>(".sermons-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderPage(Number(btn.dataset.page));
        scrollToSermons();
      });
    });
  }

  function normalizeText(value: string): string {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildSearchText(sermon: SermonView): string {
    return normalizeText([...sermon.searchTitles, sermon.preacher, sermon.dateDisplay, sermon.date].join(" "));
  }

  const searchIndex = sermons.map((s) => ({ sermon: s, searchText: buildSearchText(s) }));

  function initializeFuse(): Promise<void> {
    if (fuse) return Promise.resolve();
    if (fuseReadyPromise) return fuseReadyPromise;

    fuseReadyPromise = import("fuse.js").then((module) => {
      const FuseCtor = module.default;
      fuse = new FuseCtor(searchIndex, {
        includeScore: false,
        useExtendedSearch: true,
        ignoreLocation: true,
        threshold: 0,
        keys: ["searchText"],
      }) as unknown as import("fuse.js").default<SermonView>;
    });

    return fuseReadyPromise;
  }

  function updateSearchResults(query: string): void {
    const normalized = normalizeText(query);

    if (!normalized) {
      filteredSermons = sermons.slice();
      totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
      renderPage(1);
      return;
    }

    initializeFuse()
      .then(() => {
        const results = (fuse as any)
          .search("'" + normalized)
          .map((entry: any) => entry.item.sermon as SermonView)
          .filter((sermon: SermonView) => buildSearchText(sermon).indexOf(normalized) !== -1)
          .sort((a: SermonView, b: SermonView) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));

        filteredSermons = results;
        totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
        renderPage(1);
      })
      .catch(() => {
        filteredSermons = sermons
          .filter((sermon) => buildSearchText(sermon).indexOf(normalized) !== -1)
          .sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));
        totalPages = Math.max(1, Math.ceil(filteredSermons.length / PAGE_SIZE));
        renderPage(1);
      });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      if (searchTimer) window.clearTimeout(searchTimer);
      const value = (event.target as HTMLInputElement).value || "";
      searchTimer = window.setTimeout(() => updateSearchResults(value), 120);
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchInput.blur();
    });
  }

  // Re-render page 1 client-side so pagination/search take over from the
  // server-rendered first page (identical markup, so no visible flash).
  renderPage(1);

  if (window.requestIdleCallback) {
    window.requestIdleCallback(prefetchFirstPageAudio, { timeout: 3000 });
  } else {
    window.setTimeout(prefetchFirstPageAudio, 2000);
  }
}
