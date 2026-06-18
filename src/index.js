import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline'; // MUI基础样式重置

import './index.css';
import theme from './theme';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* 统一浏览器默认样式 */}
      <Router> {/* 路由支持多页面切换 */}
        <App />
      </Router>
    </ThemeProvider>
  </React.StrictMode>
);