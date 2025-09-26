import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function VideoPlayer({ title, videoUrl, onVideoChange }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Update current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Update duration when video loads
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Play/Pause toggle
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Stop video
  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Seek to position
  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.target.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  return (
    <div style={{
      backgroundColor: '#2c3e50',
      borderRadius: '12px',
      padding: '20px',
      color: 'white',
      minHeight: '400px'
    }}>
      {/* Title and file selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>{title}</h3>
        <button
          onClick={onVideoChange}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📁 {t('selectVideo')}
        </button>
      </div>

      {/* Video Element */}
      <div style={{
        backgroundColor: '#000',
        borderRadius: '8px',
        marginBottom: '15px',
        minHeight: '250px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            style={{
              width: '100%',
              height: '250px',
              borderRadius: '8px'
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div style={{
            color: '#7f8c8d',
            fontSize: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎬</div>
            <div>{t('noVideoSelected')}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '15px' }}>
        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: '#34495e',
          borderRadius: '3px',
          marginBottom: '15px',
          cursor: 'pointer'
        }}
        onClick={handleSeek}
        >
          <div style={{
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            height: '100%',
            backgroundColor: '#3498db',
            borderRadius: '3px',
            transition: 'width 0.1s ease'
          }} />
        </div>

        {/* Control Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={togglePlayPause}
              disabled={!videoUrl}
              style={{
                backgroundColor: !videoUrl ? '#7f8c8d' : (isPlaying ? '#e74c3c' : '#27ae60'),
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: !videoUrl ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {isPlaying ? `⏸️ ${t('pause')}` : `▶️ ${t('play')}`}
            </button>
            
            <button
              onClick={stopVideo}
              disabled={!videoUrl}
              style={{
                backgroundColor: !videoUrl ? '#7f8c8d' : '#95a5a6',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: !videoUrl ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ⏹️ {t('stop')}
            </button>

            {/* Time Display */}
            <span style={{ fontSize: '14px', color: '#bdc3c7', marginLeft: '15px' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              style={{
                width: '80px'
              }}
            />
            <span style={{ fontSize: '12px', color: '#bdc3c7', minWidth: '35px' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
