const SHOW_AFTER_PX = 300;
const FOOTER_GAP_PX = 24;

export function initBackToTop(): void {
  const button = document.querySelector<HTMLElement>(".back-to-top");
  if (!button) return;

  const footer = document.querySelector<HTMLElement>("footer");

  function update(): void {
    const scrollY = window.scrollY;
    button!.classList.toggle("is-visible", scrollY > SHOW_AFTER_PX);

    if (!footer) return;

    const footerTop = footer.getBoundingClientRect().top + scrollY;
    const wouldOverlapFooter = scrollY + window.innerHeight >= footerTop + FOOTER_GAP_PX;

    if (wouldOverlapFooter) {
      button!.style.position = "absolute";
      button!.style.bottom = "auto";
      button!.style.top = `${footerTop - FOOTER_GAP_PX - button!.offsetHeight}px`;
    } else {
      button!.style.position = "";
      button!.style.top = "";
      button!.style.bottom = "";
    }
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}
