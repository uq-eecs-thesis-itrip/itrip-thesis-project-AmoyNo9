import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CssBaseline, Box, Typography } from '@mui/material';

// pages
import Sidebar from './components/Sidebar'; // sidebar navigation menu
import ChatPage from './pages/ChatPage';   // core feature: AI chat assistant
import MapPage from './pages/MapPage';     // map route planning page

// theme
import theme from './theme';
import { ThemeProvider } from '@mui/material/styles';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Main layout: sidebar + right content area  */}
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar  */}
        <Sidebar />

        {/* Right main content area: flex-col layout, copyright bar fixed at the bottom */}
        <Box 
          className="flex-1 flex flex-col overflow-hidden"
          sx={{ marginLeft: '38px' }} // adjust right content margin 
        >
          {/* 1. Right content area  */}
          <Box className="flex-1 bg-neutral p-2">
            <Routes>
              <Route path="/" element={<ChatPage />} /> {/* chat page */}
              <Route path="/map" element={<MapPage />} /> {/* map page */}
            </Routes>
          </Box>

          {/* 2. Bottom copyright bar  */}
          <Box
            className="py-3 px-4"
            sx={{
              borderTop: '1px solid #e5e7eb', 
              // No background color
              backgroundColor: 'transparent', 
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
            }}
          >
            <Typography 
              variant="body2" 
              color="text.secondary" 
              align="center" // text alignment
            >
              © 2025 Cheng Fang 49548819
            </Typography>
          </Box>
        </Box>
      </div>
    </ThemeProvider>
  );
};

export default App;