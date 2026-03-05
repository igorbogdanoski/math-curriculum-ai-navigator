import { create } from 'zustand';

interface TourState {
  run: boolean;
  tourName: string | null;
  steps: any[];
  startTour: (name: string, steps: any[]) => void;
  stopTour: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  run: false,
  tourName: null,
  steps: [],
  startTour: (name, steps) => set({ run: true, tourName: name, steps }),
  stopTour: () => set({ run: false, tourName: null, steps: [] }),
}));
