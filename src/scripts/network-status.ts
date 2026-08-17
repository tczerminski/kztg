// Sermon play buttons need a per-button check rather than a blanket disable:
// only the sermon(s) whose audio is actually cached (the homepage prefetches
// just the first one; any sermon the visitor has already played gets cached
// too) can play offline — the rest would just fail silently.
async function updateSermonPlayButtons(offline: boolean): Promise<void> {
  if (!("caches" in window)) return;

  const buttons = document.querySelectorAll<HTMLButtonElement>(".sermon-inline-player__toggle[data-audio]");
  await Promise.all(
    Array.from(buttons).map(async (button) => {
      const audioUrl = button.dataset.audio;
      const disabled = !!audioUrl && offline && !(await caches.match(audioUrl));
      button.disabled = disabled;
      button.classList.toggle("opacity-50", disabled);
      button.classList.toggle("cursor-not-allowed", disabled);
      button.setAttribute("aria-disabled", String(disabled));
    }),
  );
}

export function initNetworkStatus(): void {
  const banner = document.getElementById("offlineBanner");

  function update(): void {
    const offline = !navigator.onLine;
    banner?.classList.toggle("hidden", !offline);

    document.querySelectorAll<HTMLElement>("[data-requires-network]").forEach((el) => {
      if (el instanceof HTMLButtonElement) el.disabled = offline;
      el.classList.toggle("opacity-50", offline);
      el.classList.toggle("cursor-not-allowed", offline);
      el.setAttribute("aria-disabled", String(offline));
    });

    updateSermonPlayButtons(offline);
  }

  // <a> tags have no .disabled property — block the click instead so a
  // stale offline state can't sneak a navigation through between the last
  // online/offline event and this handler running.
  document.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>("a[data-requires-network]");
    if (link && link.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
    }
  });

  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  document.addEventListener("sermons:rendered", update);
  update();
}
