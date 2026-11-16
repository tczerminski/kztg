/**
 * Sermon detail pages render a pool of candidate cards in
 * [data-suggested-sermons], ordered newest → oldest across the whole archive
 * (see SermonDetail.astro). On each visit, split the pool into `data-count`
 * age groups, pick one card at random from each (so there's always a mix of
 * newer and older sermons), show them in random order and hide the rest.
 * Like the rest of the site's card grids, only the first visible card is
 * shown on mobile.
 */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function initSuggestedSermons(): void {
  const grid = document.querySelector<HTMLElement>("[data-suggested-sermons]");
  if (!grid) return;

  const count = Number(grid.dataset.count) || 3;
  const items = Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-suggested-item]"));
  if (items.length === 0) return;

  const groupSize = Math.ceil(items.length / count);
  const picked: HTMLElement[] = [];
  for (let start = 0; start < items.length; start += groupSize) {
    const group = items.slice(start, start + groupSize);
    picked.push(group[Math.floor(Math.random() * group.length)]);
  }
  shuffle(picked);

  for (const item of items) item.hidden = true;
  picked.forEach((item, i) => {
    item.hidden = false;
    item.classList.toggle("max-sm:hidden", i > 0);
    grid.appendChild(item);
  });
}
