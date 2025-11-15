import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { s3UploadService } from '../services/s3-upload';
import { apiService } from '../services/api-service';
import { sessionService } from '../services/session-service';
import type { UploadResult } from '../services/s3-upload';


interface FileUploadScreenProps {
  onLogout: () => void;
}

const FileUploadScreen: React.FC<FileUploadScreenProps> = ({ onLogout }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [_uploadResults, setUploadResults] = useState<{ [key: string]: UploadResult }>({});
  const [_analysisJobs, setAnalysisJobs] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    setSelectedFiles(prev => [...prev, ...videoFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Ensure we have a session for this upload batch
      const { session_id } = await sessionService.ensureSession();
      // Upload all files to S3 in parallel and collect results
      const uploadResults = await Promise.all(selectedFiles.map(file =>
        s3UploadService.uploadVideo(
          file,
          (progress) => setUploadProgress(prev => ({ ...prev, [file.name]: progress.percentage })),
          { session_id }
        )
      ));

      // Persist per-file results in state for UI
      const resultsMap: { [key: string]: UploadResult } = {};
      uploadResults.forEach((res, idx) => { resultsMap[selectedFiles[idx].name] = res; });
      setUploadResults(prev => ({ ...prev, ...resultsMap }));

      // Filter successes for analysis
      const successful = uploadResults
        .map((r, idx) => ({ r, idx }))
        .filter(x => x.r.success);

      if (successful.length === 0) {
        console.error('All uploads failed; aborting analysis');
        setIsUploading(false);
        return;
      }

      // Build batch analyze request
      const analyzePayload = successful.map(x => ({
        bucket: x.r.bucket,
        key: x.r.key,
        tool: 'analyze_video_complete',
        session_id
      }));

      // Call batch analyze once for all videos
      const batch = await apiService.analyzeVideos(analyzePayload, session_id);

      // Extract job IDs (fallback placeholders if missing)
      const jobIds: string[] = (batch.success && batch.job_ids && batch.job_ids.length > 0)
        ? batch.job_ids
        : successful.map((_, i) => `fallback-${Date.now()}-${i}`);

      // Map filenames to job IDs for local display
      const nameToJob: { [key: string]: string } = {};
      successful.forEach((x, i) => {
        const name = selectedFiles[x.idx].name;
        nameToJob[name] = jobIds[i] || `fallback-${Date.now()}-${i}`;
      });
      setAnalysisJobs(prev => ({ ...prev, ...nameToJob }));

      const localUploadResults = successful.map(x => uploadResults[x.idx]).filter(Boolean) as UploadResult[];

      // Navigate to chat with all job IDs
      navigate('/chat', { 
        state: { 
          jobIds: jobIds,
          uploadResults: localUploadResults,
          uploadedFiles: selectedFiles,
          isFromUpload: true,
          session_id
        }
      });
      
    } catch (error) {
      console.error('Upload process failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Linker lila Balken */}
      <div className="purple-bar"></div>
      
      {/* Hamburger Menü */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="hamburger-menu"
      >
        <div className="hamburger-lines">
          <div></div>
          <div></div>
          <div></div>
        </div>
      </button>

      <NavigationMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Proovid Logo Header */}
      <div className="upload-logo-header">
        <img 
          src={proovidLogo} 
          alt="Proovid Logo" 
          className="upload-logo"
        />
      </div>

      {/* Main Content */}
      <div className="upload-main-content">
        <h1 className="upload-main-title">Lass uns dein Daten vergleichen und überprüfen...</h1>

        {/* Cloud Upload Area - wie im Mockup */}
        <div className="upload-container-mockup">
          <motion.div
            className={`upload-zone-mockup ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="cloud-upload-icon">
              <svg width="80" height="60" viewBox="0 0 80 60" className="cloud-svg">
                <path d="M60 40H20c-6.6 0-12-5.4-12-12s5.4-12 12-12c1.1-6.6 6.8-12 13.6-12 5.5 0 10.3 3.2 12.6 7.8C47.4 10.3 49.1 10 51 10c8.3 0 15 6.7 15 15 0 0.6-0.1 1.2-0.2 1.8C69.1 27.8 72 31.4 72 36c0 4.4-3.6 8-8 8h-4z" fill="#7c3aed"/>
              </svg>
              <div className="plus-icon">+</div>
            </div>
            <p className="upload-text">Lade deine Daten hoch...</p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden-file-input"
            />
          </motion.div>

          {/* Selected Files List */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="files-list"
              >
                <h3 className="files-list-title">Selected Files ({selectedFiles.length})</h3>
                
                {selectedFiles.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="file-item"
                  >
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                    
                    {uploadProgress[file.name] !== undefined ? (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">{uploadProgress[file.name]}%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => removeFile(index)}
                        className="remove-file-btn"
                        disabled={isUploading}
                      >
                        ✕
                      </button>
                    )}
                  </motion.div>
                ))}
                
                {/* Upload Button */}
                <motion.button
                  onClick={handleUpload}
                  disabled={isUploading || selectedFiles.length === 0}
                  className="upload-submit-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} Files`}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="logout-btn"
      >
        Logout
      </button>
    </div>
  );
};

export default FileUploadScreen;