import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntroAndLoginScreen from './pages/IntroAndLoginScreen';
import FileUploadScreen from './pages/FileUploadScreen';
import { authService } from './services/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              !isAuthenticated ? (
                <IntroAndLoginScreen onLoginSuccess={handleLoginSuccess} />
              ) : (
                <Navigate to="/upload" replace />
              )
            }
          />
          <Route
            path="/upload"
            element={
              isAuthenticated ? (
                <FileUploadScreen onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App
