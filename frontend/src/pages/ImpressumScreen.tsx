import React from 'react';
import { useNavigate } from 'react-router-dom';
import proovidLogo from '../assets/proovid-03.jpg';
import './ImpressumScreen.css';

const ImpressumScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="impressum-screen">
      {/* Decorative Background Shapes */}
      <div className="impressum-bg-shape impressum-shape-yellow"></div>
      <div className="impressum-bg-shape impressum-shape-purple"></div>
      <div className="impressum-bg-shape impressum-shape-pink"></div>

      {/* Content */}
      <div className="impressum-content">
        <div className="impressum-logo-container">
          <img src={proovidLogo} alt="Proovid Logo" className="impressum-logo-icon" />
          <div className="impressum-logo-text">
            <span className="impressum-brand">proovid.</span>
            <span className="impressum-brand-ai">ai</span>
          </div>
          <p className="impressum-tagline">I LIKE TO PROVE IT!</p>
        </div>

        <div className="impressum-details">
          <h2 className="impressum-title">Impressum:</h2>
          <p className="impressum-line">proovid.ai LTD. & Co.</p>
          <p className="impressum-line">Rue da Lorem Ispum 77</p>
          <p className="impressum-line">7878 Lorem di Zyprus</p>
        </div>

        <button 
          onClick={() => navigate(-1)} 
          className="impressum-back-button"
        >
          ← Zurück
        </button>
      </div>
    </div>
  );
};

export default ImpressumScreen;
