import './global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router';

import { ErrorFallback } from '@/components/ErrorFallback';
import { AppPrefsProvider } from '@/contexts/AppPrefsContext';
import { router } from '@/router/routes';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppPrefsProvider>
        <RouterProvider router={router} />
      </AppPrefsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
