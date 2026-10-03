import { createContext, useContext, useMemo, useState } from 'react';

import type { Role } from '@/content/vi';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface AppPrefs {
  role: Role;
  setRole: (role: Role) => void;
  isGuideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
}

const AppPrefsContext = createContext<AppPrefs | null>(null);

export function AppPrefsProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useLocalStorage<Role>('fl.role', 'gov');
  const [hasSeenGuide, setHasSeenGuide] = useLocalStorage('fl.onboarded', false);
  const [isGuideOpen, setGuideOpen] = useState(!hasSeenGuide);

  const value = useMemo<AppPrefs>(
    () => ({
      role,
      setRole,
      isGuideOpen,
      openGuide: () => setGuideOpen(true),
      closeGuide: () => {
        setGuideOpen(false);
        setHasSeenGuide(true);
      },
    }),
    [role, setRole, isGuideOpen, setHasSeenGuide],
  );
  return <AppPrefsContext.Provider value={value}>{children}</AppPrefsContext.Provider>;
}

export function useAppPrefs(): AppPrefs {
  const ctx = useContext(AppPrefsContext);
  if (!ctx) throw new Error('useAppPrefs must be used within AppPrefsProvider');
  return ctx;
}
