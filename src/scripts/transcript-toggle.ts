const COLLAPSED_MAX_HEIGHT_PX = 320;

export function initTranscriptToggle(): void {
  document.querySelectorAll<HTMLElement>("[data-transcript-wrap]").forEach((wrap) => {
    if (wrap.scrollHeight <= COLLAPSED_MAX_HEIGHT_PX + 40) return;

    wrap.classList.add("is-collapsed");
    const toggle = wrap.nextElementSibling;
    if (toggle instanceof HTMLElement && toggle.hasAttribute("data-transcript-toggle")) {
      toggle.classList.remove("hidden");
    }
  });

  document.addEventListener("click", (event) => {
    const toggle = (event.target as HTMLElement).closest<HTMLElement>("[data-transcript-toggle]");
    if (!toggle) return;

    const wrap = toggle.previousElementSibling;
    if (wrap instanceof HTMLElement) wrap.classList.remove("is-collapsed");
    toggle.classList.add("hidden");
  });
}
