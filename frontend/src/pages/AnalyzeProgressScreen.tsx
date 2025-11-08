import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { apiService } from '../services/api-service';
import type { JobStatus } from '../services/api-service';
import type { UploadResult } from '../services/s3-upload';

interface AnalyzeProgressScreenProps {
  onLogout: () => void;
}

interface LocationState {
  jobIds: string[];
  uploadResults: UploadResult[];
}

const AnalyzeProgressScreen: React.FC<AnalyzeProgressScreenProps> = ({ onLogout: _ }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<{ [jobId: string]: JobStatus }>({});
  const [isPolling, setIsPolling] = useState(true);
  const [allCompleted, setAllCompleted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get data passed from upload screen
  const state = location.state as LocationState;
  const jobIds = state?.jobIds || [];
  const uploadResults = state?.uploadResults || [];

  useEffect(() => {
    if (jobIds.length === 0) {
      // No jobs to track, redirect back to upload
      navigate('/upload');
      return;
    }

    // Start polling job statuses
    const pollStatuses = async () => {
      if (!isPolling) return;

      try {
        const result = await apiService.getJobStatus(jobIds);
        
        if (result.success) {
          const statusMap: { [jobId: string]: JobStatus } = {};
          
          result.statuses.forEach(status => {
            statusMap[status.job_id] = status;
          });
          
          setJobStatuses(statusMap);
          
          // Check if all jobs are completed
          const completed = result.statuses.every(status => 
            status.status === 'completed' || status.status === 'failed'
          );
          
          if (completed) {
            setAllCompleted(true);
            setIsPolling(false);
            
            // Auto-navigate to chat after a short delay
            setTimeout(() => {
              navigate('/chat', { 
                state: { 
                  jobIds, 
                  uploadResults,
                  completedJobs: result.statuses.filter(s => s.status === 'completed')
                }
              });
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error polling job statuses:', error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatuses, 2000);
    
    // Initial poll
    pollStatuses();

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [jobIds, isPolling, navigate, uploadResults]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981'; // green
      case 'failed': return '#EF4444'; // red
      case 'running': return '#F59E0B'; // orange
      case 'pending': return '#6B7280'; // gray
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Waiting to start...';
      case 'running': return 'Analyzing video...';
      case 'completed': return 'Analysis complete!';
      case 'failed': return 'Analysis failed';
      case 'not_found': return 'Job not found';
      default: return 'Unknown status';
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'pending': return 10;
      case 'running': return 65;
      case 'completed': return 100;
      case 'failed': return 100;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Orange bar */}
      <div className="orange-bar"></div>
      
      {/* Hamburger Menu */}
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

      {/* Navigation Menu */}
      <NavigationMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img 
            src={proovidLogo} 
            alt="Proovid Logo" 
            className="w-32 h-32 mx-auto mb-4 rounded-lg shadow-lg"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Video Analysis in Progress
          </h1>
          <p className="text-gray-600">
            Your videos are being analyzed. This process may take a few minutes.
          </p>
        </motion.div>

        {/* Progress Section */}
        <motion.div 
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Analysis Status
            </h2>
            
            {jobIds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No analysis jobs found.</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Return to Upload
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobIds.map((jobId, index) => {
                  const status = jobStatuses[jobId];
                  const statusText = status ? getStatusText(status.status) : 'Loading...';
                  const progress = status ? getProgressPercentage(status.status) : 0;
                  const color = status ? getStatusColor(status.status) : '#6B7280';
                  
                  return (
                    <motion.div
                      key={jobId}
                      className="border border-gray-200 rounded-lg p-4"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Analysis Job {index + 1}
                          </h3>
                          <p className="text-sm text-gray-600">ID: {jobId}</p>
                        </div>
                        <div className="text-right">
                          <span 
                            className="text-sm font-medium"
                            style={{ color }}
                          >
                            {statusText}
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <motion.div
                          className="h-2 rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            
            {/* Loading Animation */}
            {isPolling && !allCompleted && (
              <motion.div 
                className="flex items-center justify-center mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="ml-3 text-gray-600">Analyzing videos...</span>
              </motion.div>
            )}
            
            {/* Completion Message */}
            {allCompleted && (
              <motion.div
                className="text-center mt-6 p-4 bg-green-50 rounded-lg border border-green-200"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-green-600 text-lg font-medium mb-2">
                  ✅ All analyses completed!
                </div>
                <p className="text-green-700 text-sm mb-3">
                  Redirecting to chat interface...
                </p>
                <button
                  onClick={() => navigate('/chat', { 
                    state: { 
                      jobIds, 
                      uploadResults,
                      completedJobs: Object.values(jobStatuses).filter(s => s.status === 'completed')
                    }
                  })}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Go to Chat Now
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>


    </div>
  );
};

export default AnalyzeProgressScreen;