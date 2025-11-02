import React, { useState, useContext, createContext, useEffect } from "react";
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import '../amplify-config.js';
import LogoGreen from '../assets/Logo_Green.png';

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      if (currentUser && session.tokens) {
        // Extract user info from token for consistency
        const userInfo = {
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId || currentUser.username,
          role: "admin",
          sub: currentUser.userId,
          isAuthenticated: true
        };
        
        setUser(userInfo);
        setToken(session.tokens.idToken.toString());
      }
    } catch (error) {
      console.log('No authenticated user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const signInResult = await signIn({
        username,
        password
      });

      if (signInResult.isSignedIn) {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        
        console.log('Cognito currentUser:', currentUser);
        console.log('Cognito session:', session.tokens.idToken);
        
        // Extract user info from token
        const userInfo = {
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId || currentUser.username,
          role: "admin",
          sub: currentUser.userId,
          isAuthenticated: true
        };
        
        setUser(userInfo);
        setToken(session.tokens.idToken.toString());
        
        return { success: true, user: userInfo };
      } else {
        throw new Error("Sign in not completed");
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAuthHeaders = () => {
    if (!token) return {};
    return {
      "Authorization": `Bearer ${token}`
    };
  };

  const authenticatedFetch = async (url, options = {}) => {
    try {
      // Refresh session to get latest token
      const session = await fetchAuthSession();
      
      const headers = {
        ...options.headers,
        "Authorization": `Bearer ${session.tokens.idToken.toString()}`
      };

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // Token expired or invalid
        await logout();
        throw new Error("Authentication expired. Please login again.");
      }

      return response;
    } catch (error) {
      if (error.message.includes('No credentials')) {
        await logout();
        throw new Error("Authentication expired. Please login again.");
      }
      throw error;
    }
  };

  const value = {
    user,
    token,
    login,
    logout,
    getAuthHeaders,
    authenticatedFetch,
    isAuthenticated: !!token,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(username, password);
    
    if (result.success) {
      onLoginSuccess?.(result.user);
    } else {
      setError(result.error || "Login failed");
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#34495e",
      padding: "20px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }}>
      {/* Logo Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        padding: '20px'
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Orbiting Stars */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '1px',
            animation: 'orbit 8s linear infinite'
          }}>
            <span style={{
              position: 'absolute',
              fontSize: '14px',
              color: '#52c41a',
              textShadow: '0 0 10px #52c41a',
              transform: `translate(-50%, -50%) translateY(-${isMobile ? '50px' : '70px'})`
            }}>✦</span>
          </div>
          
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '1px',
            animation: 'orbit 10s linear infinite reverse'
          }}>
            <span style={{
              position: 'absolute',
              fontSize: '12px',
              color: '#3498db',
              textShadow: '0 0 8px #3498db',
              transform: `translate(-50%, -50%) translateY(-${isMobile ? '60px' : '80px'})`
            }}>✨</span>
          </div>
          
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '1px',
            height: '1px',
            animation: 'orbit 12s linear infinite'
          }}>
            <span style={{
              position: 'absolute',
              fontSize: '10px',
              color: '#f39c12',
              textShadow: '0 0 6px #f39c12',
              transform: `translate(-50%, -50%) translateY(-${isMobile ? '45px' : '60px'})`
            }}>⭐</span>
          </div>

          <img 
            src={LogoGreen}
            alt="Proovid Logo" 
            style={{
              height: isMobile ? '88px' : '120px',
              width: 'auto',
              marginBottom: isMobile ? '15px' : '20px',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 15px rgba(82, 196, 26, 0.1))',
              animation: 'logoGlow 4s ease-in-out infinite alternate, logoFloat 6s ease-in-out infinite',
              maxWidth: '90vw',
              transition: 'all 0.3s ease',
              position: 'relative',
              zIndex: 10
            }} 
          />
        </div>

      </div>

      <div style={{ 
        maxWidth: "400px", 
        margin: "20px auto 50px auto", 
        padding: "30px", 
        border: "1px solid #34495e", 
        borderRadius: "8px",
        backgroundColor: "#2c3e50",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        color: "white",
        boxSizing: "border-box"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: "30px", color: "white" }}>
          🛡️ Proovid Login
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "white" }}>
              Username:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "10px", 
                border: "1px solid #34495e", 
                borderRadius: "4px",
                fontSize: "16px",
                backgroundColor: "#34495e",
                color: "white"
              }}
              required
            />
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "white" }}>
              Password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "10px", 
                border: "1px solid #34495e", 
                borderRadius: "4px",
                fontSize: "16px",
                backgroundColor: "#34495e",
                color: "white"
              }}
              required
            />
          </div>

          {error && (
            <div style={{ 
              color: "#ffffff", 
              marginBottom: "20px", 
              padding: "12px", 
              backgroundColor: "#e74c3c",
              borderRadius: "6px",
              border: "1px solid #c0392b",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ 
              width: "100%", 
              padding: "12px", 
              backgroundColor: loading ? "#7f8c8d" : "#27ae60", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "🔄 Logging in..." : "🔐 Login"}
          </button>
        </form>
      </div>
      
      {/* CSS Animations for the fancy effects */}
      <style jsx>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes logoGlow {
          from { 
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 10px rgba(82, 196, 26, 0.1)); 
          }
          to { 
            filter: drop-shadow(0 6px 15px rgba(0,0,0,0.4)) drop-shadow(0 0 25px rgba(82, 196, 26, 0.3)); 
          }
        }
        
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
