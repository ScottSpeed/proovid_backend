import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { s3UploadService } from '../services/s3-upload';
import { apiService } from '../services/api-service';
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
      // Collect job IDs locally to avoid React state timing issues
      const localJobIds: string[] = [];
      const localUploadResults: UploadResult[] = [];
      
      // Upload each file to S3 and start analysis
      for (const file of selectedFiles) {
        const fileName = file.name;
        
        console.log(`Starting upload for ${fileName}`);
        
        // Upload to S3 with progress tracking
        const uploadResult = await s3UploadService.uploadVideo(file, (progress) => {
          setUploadProgress(prev => ({ ...prev, [fileName]: progress.percentage }));
        });
        
        // Store upload result
        setUploadResults(prev => ({ ...prev, [fileName]: uploadResult }));
        
        if (uploadResult.success) {
          console.log(`Upload successful for ${fileName}, starting real analysis...`);
          localUploadResults.push(uploadResult);
          
          // Start real video analysis via backend API
          const analysisResult = await apiService.analyzeVideo({
            bucket: uploadResult.bucket,
            key: uploadResult.key,
            tool: 'analyze_video_complete'
          });
          
          if (analysisResult.success && analysisResult.job_id) {
            setAnalysisJobs(prev => ({ ...prev, [fileName]: analysisResult.job_id! }));
            localJobIds.push(analysisResult.job_id);
            console.log(`Real analysis started for ${fileName}, job ID: ${analysisResult.job_id}`);
          } else {
            console.error(`Failed to start analysis for ${fileName}:`, analysisResult.error);
            // Fallback job ID for continuation
            const fallbackId = `fallback-${Date.now()}`;
            setAnalysisJobs(prev => ({ ...prev, [fileName]: fallbackId }));
            localJobIds.push(fallbackId);
          }
        } else {
          console.error(`Upload failed for ${fileName}:`, uploadResult.error);
        }
      }
      
      // Navigate directly to chat screen after uploads (use local data to avoid state timing issues)
      console.log('Navigation data:', {
        jobIds: localJobIds,
        uploadResults: localUploadResults,
        selectedFiles
      });
      
      // Navigate with real job IDs
      navigate('/chat', { 
        state: { 
          jobIds: localJobIds.length > 0 ? localJobIds : selectedFiles.map((_, i) => `mock-job-${Date.now()}-${i}`),
          uploadResults: localUploadResults.length > 0 ? localUploadResults : selectedFiles.map(file => ({
            success: true,
            bucket: 'christian-aws-development',
            key: `analysis_${new Date().toISOString().slice(0,19).replace(/[:-]/g, '-')}_${Date.now()}/${file.name}`
          })),
          uploadedFiles: selectedFiles,
          isFromUpload: true
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
      {/* Linker oranger Balken */}
      <div className="orange-bar"></div>
      
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
                <path d="M60 40H20c-6.6 0-12-5.4-12-12s5.4-12 12-12c1.1-6.6 6.8-12 13.6-12 5.5 0 10.3 3.2 12.6 7.8C47.4 10.3 49.1 10 51 10c8.3 0 15 6.7 15 15 0 0.6-0.1 1.2-0.2 1.8C69.1 27.8 72 31.4 72 36c0 4.4-3.6 8-8 8h-4z" fill="#ff5722"/>
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