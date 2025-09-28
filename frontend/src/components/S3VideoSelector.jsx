import React, { useEffect, useState } from "react";
import { useAuth } from "./Login";
import { useTranslation } from 'react-i18next';

export default function S3VideoSelector({ isOpen, onClose, onVideoSelect }) {
  const { t } = useTranslation();
  const { authenticatedFetch } = useAuth();
  const apiBase = import.meta.env.VITE_API_URL || "";
  const [videos, setVideos] = useState([]);
  const [files, setFiles] = useState([]);
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper: Check if file is a video
  function isVideoFile(key) {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    return videoExtensions.some(ext => key.toLowerCase().endsWith(ext));
  }

  // Helper: Check if item is a directory
  function isDirectory(file) {
    return file.key.endsWith('/') || (file.size === 0 && !file.key.includes('.'));
  }

  // Handle directory navigation
  function navigateToDirectory(dirKey) {
    setPrefix(dirKey);
    fetchFiles();
  }

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const url = `${apiBase}/list-videos?prefix=${encodeURIComponent(prefix)}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : data.files || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    if (isOpen) {
      fetchFiles(); 
    }
  }, [isOpen]);

  const handleVideoSelect = async (file) => {
    try {
      // Get signed URL from backend
      const url = `${apiBase}/video-url/${encodeURIComponent(file.bucket)}/${encodeURIComponent(file.key)}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      onVideoSelect({
        url: data.url,
        name: file.key.split('/').pop(),
        key: file.key,
        bucket: file.bucket
      });
      onClose();
    } catch (err) {
      console.error("Error getting video URL:", err);
      alert(`${t('error')}: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        borderRadius: '12px',
        padding: '20px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: '#ecf0f1' }}>📁 {t('selectVideo')}</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input 
            value={prefix} 
            onChange={e => setPrefix(e.target.value)} 
            placeholder={t('enterPrefix')} 
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              borderRadius: '6px', 
              border: '1px solid #34495e',
              backgroundColor: '#34495e',
              color: 'white'
            }} 
          />
          <button 
            onClick={fetchFiles}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 {t('refresh')}
          </button>
          {prefix && (
            <button 
              onClick={() => {
                const parts = prefix.split('/').filter(p => p);
                if (parts.length > 1) {
                  setPrefix(parts.slice(0, -1).join('/') + '/');
                } else {
                  setPrefix('');
                }
                fetchFiles();
              }}
              style={{ 
                backgroundColor: "#ff9800", 
                color: "white", 
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ← {t('back')}
            </button>
          )}
        </div>

        {/* Loading/Error */}
        {loading && <div style={{ color: '#bdc3c7', marginBottom: '16px' }}>{t('loading')}</div>}
        {error && <div style={{ color: '#e74c3c', marginBottom: '16px' }}>{t('error')}: {error}</div>}

        {/* File List */}
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {files.map((f, i) => (
            <div 
              key={i} 
              style={{
                display: "flex", 
                alignItems: "center", 
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: '#34495e',
                borderRadius: '8px',
                cursor: isVideoFile(f.key) ? 'pointer' : (isDirectory(f) ? 'pointer' : 'default'),
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (isVideoFile(f.key) || isDirectory(f)) {
                  e.target.style.backgroundColor = '#3498db';
                }
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#34495e';
              }}
              onClick={() => {
                if (isDirectory(f)) {
                  navigateToDirectory(f.key);
                } else if (isVideoFile(f.key)) {
                  handleVideoSelect(f);
                }
              }}
            >
              {isDirectory(f) ? (
                <>
                  <span style={{ fontSize: '20px', marginRight: '10px' }}>📁</span>
                  <span style={{ flex: 1, color: '#ecf0f1' }}>
                    {f.key}
                  </span>
                  <span style={{ color: '#bdc3c7', fontSize: '14px' }}>{t('folder')}</span>
                </>
              ) : isVideoFile(f.key) ? (
                <>
                  <span style={{ fontSize: '20px', marginRight: '10px' }}>🎬</span>
                  <span style={{ flex: 1, color: '#ecf0f1' }}>
                    {f.key.split('/').pop()}
                  </span>
                  <span style={{ color: '#bdc3c7', fontSize: '14px' }}>
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '20px', marginRight: '10px' }}>📄</span>
                  <span style={{ flex: 1, color: '#7f8c8d' }}>
                    {f.key.split('/').pop()}
                  </span>
                  <span style={{ color: '#7f8c8d', fontSize: '14px' }}>
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </>
              )}
            </div>
          ))}
          
          {files.length === 0 && !loading && (
            <div style={{ 
              textAlign: 'center', 
              color: '#7f8c8d', 
              padding: '40px',
              fontSize: '16px'
            }}>
              {t('noFilesFound')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
