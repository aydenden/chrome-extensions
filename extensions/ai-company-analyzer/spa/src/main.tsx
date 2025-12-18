import React from 'react';
import ReactDOM from 'react-dom/client';
import { autoInitExtensionClient } from '@/lib/extension-client';
import App from './App';
import './styles/globals.css';

// Extension Client 초기화 (환경변수에서 ID 읽음, 없으면 Mock 사용)
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID ?? '';
autoInitExtensionClient(EXTENSION_ID);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
