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
}

export interface LocaleDict {
  strings: Record<string, string>;
  tour: TourDict;
  sermonTour: TourDict;
}
