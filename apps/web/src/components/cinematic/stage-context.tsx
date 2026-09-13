'use client';

import { createContext, useContext, useMemo, useState } from 'react';

/**
 * Which channel the visitor is currently tuned to.
 *
 * Lives above the page so the switcher (a section two thirds down) can
 * repaint the backdrop (fixed behind the hero) without either knowing about
 * the other. `null` means the site default — no persona selected.
 */
interface StageState {
  themeKey: string | null;
  setThemeKey: (key: string | null) => void;
}

const StageContext = createContext<StageState | null>(null);

export function StageProvider({
  children,
  initialThemeKey = null,
}: {
  children: React.ReactNode;
  /** Persona pages open already tuned to their own channel. */
  initialThemeKey?: string | null;
}): React.JSX.Element {
  const [themeKey, setThemeKey] = useState<string | null>(initialThemeKey);
  const value = useMemo(() => ({ themeKey, setThemeKey }), [themeKey]);
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

/** Safe outside a provider: the backdrop simply stays on the site default. */
export function useStage(): StageState {
  return useContext(StageContext) ?? { themeKey: null, setThemeKey: () => undefined };
}
