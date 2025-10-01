import React from 'react';
import { useTranslation } from 'react-i18next';
import LogoGreen from '../assets/Logo_Green.png';

export default function Navbar({ currentPage, onNavigate }) {
  const { t } = useTranslation();
  
  const navItems = [
    { key: 'dashboard', label: t('dashboard'), icon: '📊' },
    { key: 'video-player', label: 'Video Player', icon: '🎬' },
    { key: 'chat', label: 'AI Chat', icon: '🤖' },
  ];

  return (
    <nav style={{
      backgroundColor: '#2c3e50',
      padding: '0 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderBottom: '3px solid #3498db'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Logo/Brand */}
        <div 
          onClick={() => onNavigate('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '15px 0',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img 
            src={LogoGreen} 
            alt="Proovid Logo" 
            style={{
              height: '32px',
              width: 'auto',
              filter: 'brightness(1.1)',
              transition: 'all 0.3s ease'
            }} 
          />
        </div>

        {/* Navigation Items */}
        <div style={{
          display: 'flex',
          gap: '0'
        }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                background: currentPage === item.key ? '#3498db' : 'transparent',
                color: currentPage === item.key ? 'white' : '#ecf0f1',
                border: 'none',
                padding: '12px 20px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '0',
                transition: 'all 0.3s ease',
                borderBottom: currentPage === item.key ? '3px solid #2980b9' : '3px solid transparent'
              }}
              onMouseOver={(e) => {
                if (currentPage !== item.key) {
                  e.target.style.backgroundColor = '#34495e';
                  e.target.style.borderBottomColor = '#3498db';
                }
              }}
              onMouseOut={(e) => {
                if (currentPage !== item.key) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.borderBottomColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* User Info (placeholder) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#ecf0f1'
        }}>
          <span style={{ fontSize: '14px' }}>👤 User</span>
        </div>
      </div>
    </nav>
  );
}