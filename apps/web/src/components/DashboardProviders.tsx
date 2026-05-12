'use client';

import { ConfirmModalProvider } from './confirm-modal';
import type { ReactNode } from 'react';

export default function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ConfirmModalProvider>
      {children}
    </ConfirmModalProvider>
  );
}
