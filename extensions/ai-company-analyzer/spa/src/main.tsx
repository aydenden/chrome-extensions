import React from 'react';
import ReactDOM from 'react-dom/client';
import { autoInitExtensionClient } from '@/lib/extension-client';
import { EXTENSION_ID } from '@shared/constants';
import App from './App';
import './styles/globals.css';

// Extension Client 초기화
autoInitExtensionClient(EXTENSION_ID);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
