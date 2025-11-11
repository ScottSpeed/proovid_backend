import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { apiService, type UserJob } from '../services/api-service';
import './VideoCompareScreen.css';

interface VideoCompareScreenProps {
  onLogout: () => void;
}

interface VideoWithUrl {
  job: UserJob;
  url: string;
}

const VideoCompareScreen: React.FC<VideoCompareScreenProps> = ({ onLogout: _ }) => {
  const [availableVideos, setAvailableVideos] = useState<UserJob[]>([]);
  const [selectedVideo1, setSelectedVideo1] = useState<VideoWithUrl | null>(null);
  const [selectedVideo2, setSelectedVideo2] = useState<VideoWithUrl | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  // Video player refs
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Slider position (percentage: 0-100)
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  
  const navigate = useNavigate();

  // Handle slider dragging
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    // Clamp between 0 and 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Load available videos from navigation state (uploaded files from session)
  useEffect(() => {
    const loadVideos = async () => {
      try {
        setIsLoading(true);
        console.log('[VideoCompare] Loading videos from navigation state...');
        
        // Get navigation state (passed from upload or chat screen)
        const navigationState = window.history.state?.usr;
        
        if (navigationState?.completedJobs && navigationState.completedJobs.length > 0) {
          console.log('[VideoCompare] Using completedJobs from navigation:', navigationState.completedJobs);
          setAvailableVideos(navigationState.completedJobs);
        } else if (navigationState?.uploadResults && navigationState.uploadResults.length > 0) {
          // Use uploadResults directly - convert to UserJob format
          console.log('[VideoCompare] Using uploadResults from navigation:', navigationState.uploadResults);
          const jobsFromUpload = navigationState.uploadResults.map((result: any, index: number) => ({
            job_id: result.jobId || `upload-${index}`,
            s3_key: result.key, // UploadResult uses 'key' not 's3_key'
            status: 'processing',
            filename: navigationState.uploadedFiles?.[index]?.name || `Video ${index + 1}`,
            created_at: new Date().toISOString(),
            session_id: 'current'
          }));
          console.log('[VideoCompare] Converted jobs from upload:', jobsFromUpload);
          setAvailableVideos(jobsFromUpload);
        } else if (navigationState?.jobIds && navigationState.jobIds.length > 0) {
          // Fallback: Create minimal job objects from jobIds
          console.log('[VideoCompare] Creating job objects from jobIds:', navigationState.jobIds);
          const jobsFromIds = navigationState.jobIds.map((jobId: string, index: number) => ({
            job_id: jobId,
            s3_key: '', // Will need to be fetched
            status: 'processing',
            filename: `Video ${index + 1}`,
            created_at: new Date().toISOString(),
            session_id: 'current'
          }));
          setAvailableVideos(jobsFromIds);
        } else {
          // No session data - don't load anything (user came directly to page)
          console.log('[VideoCompare] No navigation state - showing empty state');
          setAvailableVideos([]);
        }
      } catch (err) {
        console.error('[VideoCompare] Error loading videos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideos();
  }, []);

  // Get signed URL for video
  const getVideoUrl = async (job: UserJob): Promise<string> => {
    try {
      const bucket = 'christian-aws-development';
      const response = await apiService.getVideoUrl(bucket, job.s3_key || '');
      if (response.success && response.url) {
        return response.url;
      }
      throw new Error('Failed to get video URL');
    } catch (err) {
      console.error('Error getting video URL:', err);
      throw err;
    }
  };

  // Handle video selection
  const handleVideoSelect = async (job: UserJob, position: 1 | 2) => {
    try {
      const url = await getVideoUrl(job);
      const videoWithUrl: VideoWithUrl = { job, url };
      
      if (position === 1) {
        setSelectedVideo1(videoWithUrl);
      } else {
        setSelectedVideo2(videoWithUrl);
      }
    } catch (err) {
      console.error(`Failed to load video:`, err);
    }
  };

  // Playback controls
  const togglePlayPause = () => {
    const vid1 = video1Ref.current;
    const vid2 = video2Ref.current;

    if (!vid1 || !vid2) return;

    if (isPlaying) {
      vid1.pause();
      vid2.pause();
    } else {
      vid2.currentTime = vid1.currentTime;
      vid1.play();
      vid2.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    const vid1 = video1Ref.current;
    const vid2 = video2Ref.current;

    if (!vid1 || !vid2) return;

    vid1.currentTime = time;
    vid2.currentTime = time;
    setCurrentTime(time);
  };

  const handleTimeUpdate = () => {
    const vid1 = video1Ref.current;
    if (vid1) {
      setCurrentTime(vid1.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const vid1 = video1Ref.current;
    if (vid1) {
      setDuration(vid1.duration);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group videos by session (uploaded files together)
  const groupedVideos = availableVideos.reduce((acc, video) => {
    // Use session_id or job creation date to group
    const sessionLabel = video.session_id 
      ? `Upload Session ${video.session_id.slice(0, 8)}...`
      : 'Uploaded Files';
    
    if (!acc[sessionLabel]) {
      acc[sessionLabel] = [];
    }
    acc[sessionLabel].push(video);
    return acc;
  }, {} as Record<string, UserJob[]>);

  return (
    <div className="video-compare-mockup">
      {/* Header Bar (wie im ChatBot) */}
      <div className="chatbot-header">
        <div className="header-content">
          <img 
            src={proovidLogo} 
            alt="Proovid Logo" 
            className="header-logo"
          />
          <h1 className="header-title">🎬 Video Comparison</h1>
        </div>
        
        {/* Hamburger Menu */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="hamburger-button"
        >
          <div className="hamburger-icon">
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
          </div>
        </button>
      </div>

      {/* Horizontal Divider Bar */}
      <div className="header-divider"></div>

      {/* Navigation Menu */}
      <NavigationMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
      />

      {/* Main Content Wrapper */}
      <div className="video-compare-content-wrapper">
        {/* Left Sidebar - Folder Structure */}
        <div className="sidebar-folders">
        <div className="sidebar-header">
          <button onClick={() => navigate('/chat')} className="back-icon">←</button>
          <span className="sidebar-title">File Explorer</span>
        </div>

        <div className="folder-tree">
          <div className="folder-root">
            <span className="folder-icon">📁</span>
            <span className="folder-name">Uploaded Files</span>
          </div>

          {isLoading ? (
            <div className="loading-folders">Loading videos...</div>
          ) : Object.keys(groupedVideos).length === 0 ? (
            <div className="no-videos-sidebar">
              <p>No videos available</p>
              <button onClick={() => navigate('/upload')} className="upload-btn-small">
                Upload Videos
              </button>
            </div>
          ) : (
            Object.entries(groupedVideos).map(([folderName, videos]) => (
              <div key={folderName} className="folder-group">
                <div 
                  className={`folder-item ${selectedFolder === folderName ? 'selected' : ''}`}
                  onClick={() => setSelectedFolder(selectedFolder === folderName ? null : folderName)}
                >
                  <span className="folder-icon">📂</span>
                  <span className="folder-label">{folderName}</span>
                </div>

                {selectedFolder === folderName && (
                  <div className="video-files">
                    {videos.map((video) => (
                      <div
                        key={video.job_id}
                        className={`video-file ${
                          selectedVideo1?.job.job_id === video.job_id || 
                          selectedVideo2?.job.job_id === video.job_id 
                            ? 'active' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!selectedVideo1) {
                            handleVideoSelect(video, 1);
                          } else if (!selectedVideo2) {
                            handleVideoSelect(video, 2);
                          } else {
                            // Replace video 1 if both are selected
                            handleVideoSelect(video, 1);
                          }
                        }}
                      >
                        <span className="file-icon">🎬</span>
                        <span className="file-name">
                          {video.filename || (video.s3_key ? video.s3_key.split('/').pop() : `Video_${video.job_id.slice(0, 8)}.mp4`)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="compare-main-area">
        {/* Top Bar */}
        <div className="compare-top-bar">
          <div className="app-title">
            <span className="director-icon">🎬</span>
            <span>Video Comparison Player</span>
          </div>
        </div>

        {/* Video Players - Overlay Comparison */}
        {selectedVideo1 && selectedVideo2 ? (
          <div className="video-comparison-container">
            {/* Overlay Video Container */}
            <div 
              ref={containerRef}
              className="overlay-video-container"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Video 1 (Bottom Layer - Full) */}
              <video
                ref={video1Ref}
                src={selectedVideo1.url}
                className="overlay-video video-bottom"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                playsInline
              />

              {/* Video 2 (Top Layer - Clipped) */}
              <div 
                className="overlay-video-clip"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <video
                  ref={video2Ref}
                  src={selectedVideo2.url}
                  className="overlay-video video-top"
                  playsInline
                />
              </div>

              {/* Draggable Slider */}
              <div 
                className="comparison-slider"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={handleMouseDown}
              >
                <div className="slider-line"></div>
                <div className="slider-handle">
                  <div className="slider-arrow slider-arrow-left">◄</div>
                  <div className="slider-arrow slider-arrow-right">►</div>
                </div>
              </div>

              {/* Video Labels */}
              <div className="video-label-overlay video-label-left">
                {selectedVideo1.job.filename || (selectedVideo1.job.s3_key ? selectedVideo1.job.s3_key.split('/').pop() : 'Video 1')}
              </div>
              <div className="video-label-overlay video-label-right">
                {selectedVideo2.job.filename || (selectedVideo2.job.s3_key ? selectedVideo2.job.s3_key.split('/').pop() : 'Video 2')}
              </div>
            </div>

            {/* Video Info Bar */}
            <div className="comparison-info-bar">
              <div className="info-section">
                <span className="info-label">Left:</span>
                <span className="info-value">{selectedVideo1.job.filename || (selectedVideo1.job.s3_key ? selectedVideo1.job.s3_key.split('/').pop() : 'Video 1')}</span>
              </div>
              <div className="info-section">
                <span className="info-label">Right:</span>
                <span className="info-value">{selectedVideo2.job.filename || (selectedVideo2.job.s3_key ? selectedVideo2.job.s3_key.split('/').pop() : 'Video 2')}</span>
              </div>
              <div className="info-section">
                <span className="info-label">Position:</span>
                <span className="info-value">{sliderPosition.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-selection-message">
            <h2>📹 Select Two Videos</h2>
            <p>Choose videos from the sidebar to compare them side by side</p>
            {!isLoading && availableVideos.length === 0 && (
              <button onClick={() => navigate('/upload')} className="upload-btn-large">
                Upload Videos
              </button>
            )}
          </div>
        )}

        {/* Bottom Timeline */}
        <div className="timeline-bar">
          <button 
            className="play-control" 
            onClick={togglePlayPause}
            disabled={!selectedVideo1 || !selectedVideo2}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <div className="timeline-track">
            <span className="time-display">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="timeline-slider-mockup"
              disabled={!selectedVideo1 || !selectedVideo2}
            />
            <span className="time-display">{formatTime(duration)}</span>
          </div>

          <button className="volume-control">🔊</button>
        </div>
      </div>
      </div> {/* Close video-compare-content-wrapper */}
    </div>
  );
};

export default VideoCompareScreen;
