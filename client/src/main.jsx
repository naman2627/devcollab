import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

/**
 * BrowserRouter, not HashRouter. WHY it works in production: Express has a
 * catch-all that returns index.html for any non-API path (see server/app.js),
 * so a hard refresh on /projects/abc123 still loads the app instead of 404ing.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
