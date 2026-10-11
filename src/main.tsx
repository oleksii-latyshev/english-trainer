import { RegistryProvider } from '@effect/atom-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EvaLookApplier } from '@/core/eva-look';
import App from './App';
import { startDockIcon } from './lib/dockIcon';
import { startTheme } from './theme/applyTheme';
import { appearancePreference } from './theme/themePreference';

let stopTheme = startTheme(appearancePreference.get().theme);
appearancePreference.subscribe(() => {
  stopTheme();
  stopTheme = startTheme(appearancePreference.get().theme);
});
startDockIcon();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RegistryProvider>
      <EvaLookApplier />
      <App />
    </RegistryProvider>
  </React.StrictMode>,
);
