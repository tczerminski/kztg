import type { SongView } from "../lib/songs";

interface ClientStrings {
  newer: string;
  older: string;
  page: string;
  noResults: string;
}

const PAGE_SIZE = 30;

export function initSongsClient(): void {
  const grid = document.getElementById("songs-grid");
  const nav = document.getElementById("songs-nav");
  const searchInput = document.getElementById("songs-search") as HTMLInputElement | null;
  const showAllBtn = document.getElementById("songs-show-all");
  const dataEl = document.getElementById("songs-data");
  const i18nEl = document.getElementById("songs-i18n");

  if (!grid || !nav || !dataEl || !i18nEl) return;

  const songs: SongView[] = JSON.parse(dataEl.textContent || "[]");
  const strings: ClientStrings = JSON.parse(i18nEl.textContent || "{}");

  let filteredSongs = songs.slice();
  let totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
  let fuse: import("fuse.js").default<SongView> | null = null;
  let fuseReadyPromise: Promise<void> | null = null;
  let searchTimer: number | undefined;

  function escapeAttr(value: string | undefined | null): string {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function songRowHTML(song: SongView): string {
    return (
      `<a href="${escapeAttr(song.href)}" class="song-row">` +
      `<span class="song-row-number">${escapeAttr(String(song.number))}.</span>` +
      `<span class="song-row-title">${escapeAttr(song.title)}</span>` +
      `</a>`
    );
  }

  function paginationNavHTML(page: number, total: number): string {
    const parts: string[] = [];

    if (page > 1) {
      parts.push(
        `<button class="songs-page-btn px-5 py-3 border border-[#7b8fc4] text-[#7b8fc4] rounded-xl hover:bg-[#7b8fc4] hover:text-white transition" data-page="${page - 1}">${escapeAttr(strings.newer)}</button>`,
      );
    }

    parts.push(`<span class="text-gray-600">${strings.page.replace("{page}", String(page)).replace("{total}", String(total))}</span>`);

    if (page < total) {
      parts.push(
        `<button class="songs-page-btn px-5 py-3 border border-[#7b8fc4] text-[#7b8fc4] rounded-xl hover:bg-[#7b8fc4] hover:text-white transition" data-page="${page + 1}">${escapeAttr(strings.older)}</button>`,
      );
    }

    return parts.join("");
  }

  function scrollToSongs(): void {
    document.getElementById("songs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reveal(): void {
    grid?.classList.remove("hidden");
    showAllBtn?.classList.add("hidden");
  }

  function renderPage(page: number): void {
    if (!grid || !nav) return;
    reveal();
    const start = (page - 1) * PAGE_SIZE;
    const items = filteredSongs.slice(start, start + PAGE_SIZE);

    if (!items.length) {
      grid.innerHTML = `<p class="text-center text-gray-500 p-6 sm:p-8">${escapeAttr(strings.noResults)}</p>`;
      nav.innerHTML = "";
      return;
    }

    grid.innerHTML = items.map(songRowHTML).join("");
    nav.innerHTML = paginationNavHTML(page, totalPages);

    nav.querySelectorAll<HTMLButtonElement>(".songs-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderPage(Number(btn.dataset.page));
        scrollToSongs();
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

  function buildSearchText(song: SongView): string {
    return normalizeText(`${song.title} ${song.number}`);
  }

  const searchIndex = songs.map((s) => ({ song: s, searchText: buildSearchText(s) }));

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
      }) as unknown as import("fuse.js").default<SongView>;
    });

    return fuseReadyPromise;
  }

  function updateSearchResults(query: string): void {
    const normalized = normalizeText(query);

    if (!normalized) {
      filteredSongs = songs.slice();
      totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
      renderPage(1);
      return;
    }

    initializeFuse()
      .then(() => {
        const results = (fuse as any)
          .search("'" + normalized)
          .map((entry: any) => entry.item.song as SongView)
          .filter((song: SongView) => buildSearchText(song).indexOf(normalized) !== -1)
          .sort((a: SongView, b: SongView) => a.number - b.number);

        filteredSongs = results;
        totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
        renderPage(1);
      })
      .catch(() => {
        filteredSongs = songs
          .filter((song) => buildSearchText(song).indexOf(normalized) !== -1)
          .sort((a, b) => a.number - b.number);
        totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
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

  showAllBtn?.addEventListener("click", () => {
    filteredSongs = songs.slice();
    totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
    renderPage(1);
  });

  // Idle by default: the grid stays hidden until the user searches or taps
  // "show all", so the homepage leads with search instead of a long list.
}
