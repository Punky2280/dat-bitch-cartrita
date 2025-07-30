import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';
import { AmbientProvider } from '@/context/AmbientContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AmbientProvider>
      <App />
    </AmbientProvider>
  </React.StrictMode>
);
