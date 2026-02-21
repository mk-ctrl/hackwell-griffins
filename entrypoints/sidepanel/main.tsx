import React from 'react';
import ReactDOM from 'react-dom/client';
import SidePanel from './sidepanel.tsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
