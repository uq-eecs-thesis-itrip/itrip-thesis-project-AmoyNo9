import { createTheme } from '@mui/material/styles';

// MUI主题：与Tailwind颜色同步，贴合厦门旅游场景
const theme = createTheme({
  palette: {
    primary: {
      main: '#1E88E5', // blue
    },
    scenery: {
      main: '#4CAF50', // green
    },
    cuisine: {
      main: '#FF9800', // orange
    },
    culture: {
      main: '#E53935', // red
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "sans-serif"',
    h4: {
      fontWeight: 600,
      color: '#1E88E5',
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px', // Tailwind rounded-lg
          textTransform: 'none', // disable uppercase transformation
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px', // Tailwind rounded-xl
        },
      },
    },
  },
});

export default theme;