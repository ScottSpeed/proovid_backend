import React from 'react';

interface NavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="nav-overlay"
        onClick={onClose}
      ></div>
      
      {/* Slide-out Menu */}
      <div className="nav-menu">
        <div className="nav-header">
          <h2 className="nav-title">Proovid</h2>
          <button
            onClick={onClose}
            className="nav-close"
          >
            ✕
          </button>
        </div>
        
        <nav className="nav-content">
          <a href="#impressum" className="nav-item">
            📄 Impressum
          </a>
        </nav>
      </div>
    </>
  );
};

export default NavigationMenu;