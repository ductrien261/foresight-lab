import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { NavLink, Outlet, useLocation } from 'react-router';

import { ErrorFallback } from '@/components/ErrorFallback';
import { OnboardingDialog } from '@/components/Onboarding/OnboardingDialog';
import ui from '@/components/ui.module.css';
import { APP, NAV } from '@/content/vi';
import { useAppPrefs } from '@/contexts/AppPrefsContext';

import s from './AppShell.module.css';

const ALL_NAV = [
  { to: '/nang-luong', label: NAV.spaces.energy, icon: '⚡' },
  { to: '/cong-cu', label: NAV.spaces.tool, icon: '🛠' },
];

export function AppShell() {
  const { openGuide } = useAppPrefs();
  const { pathname } = useLocation();

  return (
    <div className={s.app}>
      <header className={s.header}>
        {/* Brand */}
        <NavLink to="/nang-luong" className={s.brand}>
          <span className={s.logo}>{APP.name}</span>
          <span className={s.divider} aria-hidden="true" />
          <span className={s.tagline}>{APP.tagline}</span>
        </NavLink>

        {/* Centre navigation */}
        <nav aria-label="Điều hướng chính" className={s.centreNav}>
          {ALL_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={s.navLink}>
              <span className={s.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className={s.rightActions}>
          <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={openGuide}>
            {NAV.guide}
          </button>
        </div>
      </header>

      <main className={s.main} id="noi-dung">
        {/* Mobile horizontal nav */}
        <nav aria-label="Điều hướng (di động)" className={s.mobileNav}>
          {ALL_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={s.mobileLink}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[pathname]}>
          <Suspense fallback={<p className={s.loading}>Đang tải…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <OnboardingDialog />
    </div>
  );
}
