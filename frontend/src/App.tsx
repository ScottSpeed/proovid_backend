import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntroAndLoginScreen from './pages/IntroAndLoginScreen';
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
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                  <div className="bg-white p-8 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold mb-4">File Upload Screen</h1>
                    <p className="text-gray-600 mb-4">This will be implemented in the next step.</p>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
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
