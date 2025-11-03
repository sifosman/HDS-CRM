import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import './App.css';

// Components
import Header from './components/Header';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import Optimizer from './pages/Optimizer';
import WhatsAppUpload from './pages/WhatsAppUpload';
import CutlistEdit from './pages/CutlistEdit';
import CutlistDemo from './pages/CutlistDemo';
import NotFound from './pages/NotFound';
import QuotesDashboard from './pages/QuotesDashboard';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2E5077', // Deep blue
      light: '#4D7CAA',
      dark: '#1A3A5F',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E87121', // Orange accent
      light: '#FF9D5C',
      dark: '#C55A00',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2C3E50',
      secondary: '#5D6D7E',
    },
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box
          className="app-container"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: '100%'
          }}
        >
          <Header />
          <Box
            component="main"
            sx={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard/quotes" element={<QuotesDashboard />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/optimizer" element={<Optimizer />} />
              <Route path="/upload" element={<WhatsAppUpload />} />
              <Route path="/cutlist-edit/new" element={<CutlistEdit />} />
              <Route path="/cutlist-edit/:id" element={<CutlistEdit />} />
              <Route path="/cutlist-demo" element={<CutlistDemo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Box>
          <Footer />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
