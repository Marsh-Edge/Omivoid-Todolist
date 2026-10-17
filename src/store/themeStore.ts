import { create } from "zustand";
import {
  applyTheme,
  nextThemeMode,
  readStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeState {
  /** Current preference; "system" follows the OS. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Cycles light → dark → system. */
  cycle: () => void;
  /** Loads the persisted preference on mount without writing it back. */
  hydrate: () => void;
}

const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  setMode: (mode) => {
    applyTheme(mode);
    set({ mode });
  },
  cycle: () => {
    get().setMode(nextThemeMode(get().mode));
  },
  hydrate: () => set({ mode: readStoredTheme() }),
}));

export default useThemeStore;
