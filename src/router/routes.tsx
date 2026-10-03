import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router';

import { AppShell } from '@/components/AppShell/AppShell';

const EnergyDashboard = lazy(() => import('@/pages/Energy/EnergyDashboard'));
const ToolPage = lazy(() => import('@/pages/Tool/ToolPage'));

/** Hash routing keeps deep links working on static hosts such as GitHub Pages. */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/nang-luong" replace /> },
      { path: 'nang-luong', element: <EnergyDashboard /> },
      { path: 'cong-cu', element: <ToolPage /> },
      // Legacy redirects
      { path: 'nang-luong/can-doi', element: <Navigate to="/nang-luong" replace /> },
      { path: 'nang-luong/tac-dong', element: <Navigate to="/nang-luong" replace /> },
      { path: 'phuong-phap', element: <Navigate to="/nang-luong" replace /> },
      { path: '*', element: <Navigate to="/nang-luong" replace /> },
    ],
  },
]);
