import React, { useState } from "react";
import S3Files from "./components/S3Files";
import JobDashboard from "./components/JobDashboard";
import VideoPlayerPage from "./components/VideoPlayerPage";
import Navbar from "./components/Navbar";
import Login, { AuthProvider, useAuth } from "./components/Login";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { useTranslation } from 'react-i18next';

function MainApp() {
  const { user, logout, authenticatedFetch } = useAuth();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [panelOpen, setPanelOpen] = useState(true);

  const handleNavigation = (page) => {
    setCurrentPage(page);
  };

  async function onAnalyze(videos) {
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    try {
      const res = await authenticatedFetch(`${apiBase}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: videos })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      alert(t('analysisInProgress') + ": " + (data.jobs ? data.jobs.map(j => j.job_id).join(", ") : JSON.stringify(data)));
    } catch (err) {
      console.error("analyze error", err);
      alert(t('analysisFailed') + ": " + err);
    }
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div>
            {panelOpen && (
              <div style={{ marginBottom: 20 }}>
                <JobDashboard />
              </div>
            )}
            <div style={{ width: "100%" }}>
              <S3Files onAnalyze={onAnalyze} panelOpen={panelOpen} setPanelOpen={setPanelOpen} />
            </div>
          </div>
        );
      case 'video-player':
        return <VideoPlayerPage />;
      default:
        return <div>{t('notFoundError')}</div>;
    }
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div>      
      {/* Navbar */}
      <Navbar currentPage={currentPage} onNavigate={handleNavigation} />

      {/* User info bar */}
      <div style={{ 
        backgroundColor: "#34495e", 
        padding: "8px 20px", 
        borderBottom: "1px solid #2c3e50",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <span style={{ color: "#ecf0f1", fontSize: "14px" }}>
            👤 <strong>{user.email || user.username}</strong> ({user.role})
          </span>
          <LanguageSwitcher />
          <button 
            onClick={logout}
            style={{
              padding: "6px 12px",
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            🚪 {t('logout')}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ 
        padding: 16,
        backgroundColor: '#2c3e50',
        minHeight: '100vh'
      }}>
        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}