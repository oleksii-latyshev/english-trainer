import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startEvaLook } from './components/eva/applyEvaLook';
import { startTheme } from './theme/applyTheme';
import { appearancePreference } from './theme/themePreference';

let stopTheme = startTheme(appearancePreference.get().theme);
appearancePreference.subscribe(() => {
  stopTheme();
  stopTheme = startTheme(appearancePreference.get().theme);
});
startEvaLook();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
