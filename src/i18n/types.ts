export interface TourStep {
  title: string;
  desc: string;
}

export interface TourDict {
  next: string;
  prev: string;
  done: string;
  progress: string;
  steps: TourStep[];
  /** Extra homepage-tour steps spliced in only when the Śpiewnik section is present (pl only). */
  songsSteps?: [TourStep, TourStep];
}

export interface LocaleDict {
  strings: Record<string, string>;
  tour: TourDict;
  sermonTour: TourDict;
  /** Optional: the songs section only renders under the pl locale, so only pl.ts needs this. */
  songTour?: TourDict;
}
