import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService, type LoginCredentials } from '../services/amplify-auth';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';

interface IntroAndLoginScreenProps {
  onLoginSuccess: () => void;
}

const IntroAndLoginScreen: React.FC<IntroAndLoginScreenProps> = ({ onLoginSuccess }) => {
  const [showLogo, setShowLogo] = useState(false);
  const [showUI, setShowUI] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Animation sequence: logo fade-in, then UI elements
  useEffect(() => {
    const timer1 = setTimeout(() => setShowLogo(true), 800);  // Logo nach 0.8s
    const timer2 = setTimeout(() => setShowUI(true), 2000);   // UI nach 2s
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await authService.login(credentials);
      onLoginSuccess();
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  return (
    <div>
      {/* LILA BALKEN LINKS - nur wenn UI sichtbar */}
      {showUI && <div className="purple-bar fade-in"></div>}
      
      {/* HAMBURGER MENÜ OBEN RECHTS - nur wenn UI sichtbar */}
      {showUI && (
        <button
          onClick={() => setIsMenuOpen(true)}
          className="hamburger-menu fade-in"
        >
          <div className="hamburger-lines">
            <div></div>
            <div></div>
            <div></div>
          </div>
        </button>
      )}
      {/* Navigation Menu */}
      <NavigationMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* LILA BALKEN LINKS */}
      <div className="fixed left-0 top-0 bottom-0 w-1 bg-purple-600 z-50"></div>
      
      {/* HAMBURGER MENÜ OBEN RECHTS */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-2 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
        >
          <div className="w-6 h-6 flex flex-col justify-center space-y-1">
            <div className="w-full h-0.5 bg-gray-800"></div>
            <div className="w-full h-0.5 bg-gray-800"></div>
            <div className="w-full h-0.5 bg-gray-800"></div>
          </div>
        </button>
      </div>

      {/* Main Content */}
      <div className="main-container">
        <div className="content-center">
          {/* Logo - fade in first */}
          {showLogo && (
            <div className="logo-container fade-in-slow">
              <img 
                src={proovidLogo} 
                alt="Proovid Logo" 
                className="real-logo"
              />
            </div>
          )}
          


          {/* Login Form - fade in with UI */}
          {showUI && (
            <form onSubmit={handleSubmit} className="login-form fade-in">
              <input
                type="email"
                placeholder="Email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                onKeyPress={handleKeyPress}
                className="form-input"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                onKeyPress={handleKeyPress}
                className="form-input"
                required
              />

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="form-button"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntroAndLoginScreen;