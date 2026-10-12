import { RegistryContext } from '@effect/atom-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EvaLookApplier } from '@/core/eva-look';
import { appRegistry } from '@/core/runtime';
import { ThemeApplier } from '@/features/appearance';
import { DockIconApplier } from '@/features/eva-settings';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RegistryContext.Provider value={appRegistry}>
      <ThemeApplier />
      <EvaLookApplier />
      <DockIconApplier />
      <App />
    </RegistryContext.Provider>
  </React.StrictMode>,
);
