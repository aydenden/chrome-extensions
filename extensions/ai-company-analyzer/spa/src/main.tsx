import React from 'react';
import ReactDOM from 'react-dom/client';
import { autoInitExtensionClient } from '@/lib/extension-client';
import App from './App';
import './styles/globals.css';

// Extension Client 초기화 (manifest.json key로 고정된 ID)
const EXTENSION_ID = 'opndpciajcchajfpcafiglahllclcgam';
autoInitExtensionClient(EXTENSION_ID);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
