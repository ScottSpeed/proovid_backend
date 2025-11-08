import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntroAndLoginScreen from './pages/IntroAndLoginScreen';
import FileUploadScreen from './pages/FileUploadScreen';
import AnalyzeProgressScreen from './pages/AnalyzeProgressScreen';
import ChatBotScreen from './pages/ChatBotScreen';
import { authService } from './services/amplify-auth';
import './amplify-config';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check initial auth state
    const checkAuthState = async () => {
      const isAuth = await authService.isAuthenticated();
      setIsAuthenticated(isAuth);
      setIsLoading(false);
    };

    checkAuthState();

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange((isAuth) => {
      setIsAuthenticated(isAuth);
    });

    return unsubscribe;
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

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
          <Route
            path="/analyze-progress"
            element={
              isAuthenticated ? (
                <AnalyzeProgressScreen onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/chat"
            element={
              isAuthenticated ? (
                <ChatBotScreen onLogout={handleLogout} />
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
