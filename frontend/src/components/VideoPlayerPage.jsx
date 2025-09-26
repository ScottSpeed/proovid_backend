import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import VideoPlayer from './VideoPlayer';
import S3VideoSelector from './S3VideoSelector';

export default function VideoPlayerPage() {
  const { t } = useTranslation();
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [currentPlayerSelect, setCurrentPlayerSelect] = useState(null);

  const handleVideoSelect = (videoData) => {
    if (currentPlayerSelect === 1) {
      setVideo1(videoData);
    } else if (currentPlayerSelect === 2) {
      setVideo2(videoData);
    }
    setSelectorOpen(false);
    setCurrentPlayerSelect(null);
  };

  const openVideoSelector = (playerNumber) => {
    setCurrentPlayerSelect(playerNumber);
    setSelectorOpen(true);
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Page Header */}
      <div style={{
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '32px',
          fontWeight: 'bold',
          margin: '0 0 10px 0'
        }}>
          🎬 {t('videoPlayer')}
        </h1>
        <p style={{
          color: '#7f8c8d',
          fontSize: '16px',
          margin: 0
        }}>
          {t('playTwoVideos')}
        </p>
      </div>

      {/* Video Players Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <VideoPlayer
          title={`🎬 ${t('videoPlayer')} 1`}
          videoUrl={video1?.url}
          onVideoChange={() => openVideoSelector(1)}
        />
        
        <VideoPlayer
          title={`🎬 ${t('videoPlayer')} 2`}
          videoUrl={video2?.url}
          onVideoChange={() => openVideoSelector(2)}
        />
      </div>

      {/* Current Selection Info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
      }}>
        <div style={{
          backgroundColor: '#ecf0f1',
          padding: '15px',
          borderRadius: '8px',
          borderLeft: '4px solid #3498db'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>{t('video1')}</h4>
          <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
            {video1 ? (
              <>
                <strong>📁 {video1.name}</strong><br />
                <span style={{ fontSize: '12px' }}>
                  {t('bucket')}: {video1.bucket}<br />
                  {t('key')}: {video1.key}
                </span>
              </>
            ) : t('noVideoSelected')}
          </p>
        </div>

        <div style={{
          backgroundColor: '#ecf0f1',
          padding: '15px',
          borderRadius: '8px',
          borderLeft: '4px solid #e74c3c'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>{t('video2')}</h4>
          <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
            {video2 ? (
              <>
                <strong>📁 {video2.name}</strong><br />
                <span style={{ fontSize: '12px' }}>
                  {t('bucket')}: {video2.bucket}<br />
                  {t('key')}: {video2.key}
                </span>
              </>
            ) : t('noVideoSelected')}
          </p>
        </div>
      </div>

      {/* Video Selector Modal */}
      <S3VideoSelector
        isOpen={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setCurrentPlayerSelect(null);
        }}
        onVideoSelect={handleVideoSelect}
      />
    </div>
  );
}
