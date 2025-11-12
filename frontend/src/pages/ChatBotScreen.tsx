import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { apiService } from '../services/api-service';
import type { JobStatus, UserJob } from '../services/api-service';
import type { UploadResult } from '../services/s3-upload';
import './ChatBotScreen.css';

interface ChatBotScreenProps {
  onLogout: () => void;
}

interface LocationState {
  jobIds: string[];
  uploadResults: UploadResult[];
  completedJobs?: UserJob[];
  uploadedFiles?: File[];
  isFromUpload?: boolean;
}

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

const ChatBotScreen: React.FC<ChatBotScreenProps> = ({ onLogout: _ }) => {
  // 🎨 Modern chat design with avatars and gradients - Build v2.0
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [jobStatuses, setJobStatuses] = useState<{ [jobId: string]: JobStatus }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get data passed from previous screen
  const state = location.state as LocationState;
  const uploadResults = state?.uploadResults || [];
  const uploadedFiles = state?.uploadedFiles || [];
  const jobIds = state?.jobIds || [];
  const isFromUpload = state?.isFromUpload || false;
  
  // State for completed jobs (updated by polling)
  const [completedJobs, setCompletedJobs] = useState<UserJob[]>(state?.completedJobs || []);
  
  // Panel should be open by default
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Debug logging (only on mount, not every render)
  useEffect(() => {
    console.log('[ChatBot] Initial state:', {
      completedJobs,
      uploadResults,
      uploadedFiles,
      jobIds,
      isFromUpload
    });
  }, []); // Empty deps = runs once on mount

  useEffect(() => {
    // Add welcome message based on context
    const welcomeMessage: Message = {
      id: 'welcome',
      text: isFromUpload 
        ? `Great! I've received ${uploadedFiles.length} video${uploadedFiles.length !== 1 ? 's' : ''} for analysis. The analysis is starting in the background. You can already start asking questions, and I'll provide updates as the analysis progresses!\n\nExample questions:\n• What's the current status of my analysis?\n• Tell me about video analysis in general\n• What will you be looking for in my videos?`
        : completedJobs.length > 0 
          ? `Welcome! I've analyzed ${completedJobs.length} video${completedJobs.length !== 1 ? 's' : ''} for you. You can ask me questions about the analysis results, such as:\n\n• What objects were detected in the videos?\n• Were there any black frames found?\n• What text was extracted from the videos?\n• Can you summarize the analysis results?`
          : `Welcome to Proovid AI Chat! Upload some videos first to get started with analysis.`,
      isBot: true,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage]);
    
    if (!isFromUpload && completedJobs.length === 0 && jobIds.length === 0) {
      // No jobs at all, redirect to upload after delay
      setTimeout(() => {
        navigate('/upload');
      }, 3000);
    }
  }, [completedJobs.length, uploadedFiles.length, isFromUpload, jobIds.length, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time job status polling for production
  useEffect(() => {
    if (!jobIds.length) return;

    let isActive = true;
    let errorCount = 0;
    const maxErrors = 5;

    const pollJobStatus = async () => {
      try {
        // Use getMyJobs instead of getJobStatus to get full job info including s3_key
        const result = await apiService.getMyJobs();
        
        if (!isActive) return;
        
        // Reset error count on success
        errorCount = 0;
        
        if (result.jobs && result.jobs.length > 0) {
          // Filter to only our job IDs
          const ourJobs = result.jobs.filter((job: UserJob) => jobIds.includes(job.job_id));
          
          const statusMap: { [jobId: string]: JobStatus } = {};
          
          ourJobs.forEach((job: UserJob) => {
            statusMap[job.job_id] = {
              job_id: job.job_id,
              status: job.status as any, // UserJob.status is string, JobStatus expects specific values
              result: job.result || ''
            };
          });
          
          setJobStatuses(statusMap);
          
          // Check if all jobs are completed
          const allCompleted = ourJobs.every((job: UserJob) => 
            job.status === 'completed' || job.status === 'failed'
          );
          
          // Update completedJobs state with ANY jobs that have s3_key (even if still processing)
          const jobsWithVideo = ourJobs.filter((job: UserJob) => job.s3_key);
          if (jobsWithVideo.length > 0) {
            console.log('[ChatBot] Setting completedJobs (jobs with s3_key):', jobsWithVideo);
            setCompletedJobs(jobsWithVideo);
          }
          
          if (allCompleted) {
            // Add completion message
            const completionMessage: Message = {
              id: `completion-${Date.now()}`,
              text: `🎉 All video analyses are complete! You can now ask specific questions about the results.`,
              isBot: true,
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, completionMessage]);
            isActive = false; // Stop polling
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`Error polling job status (${errorCount}/${maxErrors}):`, error);
        
        // Stop polling after too many errors
        if (errorCount >= maxErrors) {
          console.warn('Too many polling errors, stopping job status updates');
          isActive = false;
        }
      }
    };

    // Initial status check
    pollJobStatus();

    // Poll every 10 seconds (reduced frequency)
    const interval = setInterval(() => {
      if (isActive) {
        pollJobStatus();
      }
    }, 10000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [jobIds]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Send message to API with session_id (first job ID) for context
      const session_id = jobIds.length > 0 ? jobIds[0] : undefined;
      const response = await apiService.chat({
        message: inputMessage,
        conversation_id: conversationId,
        session_id: session_id
      });

      if (response.success) {
        // Add bot response
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.response || 'I apologize, but I couldn\'t generate a proper response.',
          isBot: true,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, botMessage]);
        
        // Update conversation ID
        if (response.conversation_id) {
          setConversationId(response.conversation_id);
        }
      } else {
        // Error message
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `Sorry, I encountered an error: ${response.error}`,
          isBot: true,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I\'m having trouble connecting. Please try again.',
        isBot: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Purple navigation bar - repositioned */}
      <div className="chat-header">
        <div className="header-content">
          <img 
            src={proovidLogo} 
            alt="Proovid Logo" 
            className="header-logo"
          />
          <h1 className="header-title">Proovid AI Chat</h1>
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

      <div className="flex h-[calc(100vh-4rem)] relative">
        {/* Panel Toggle Button */}
        <motion.button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="fixed top-20 left-2 z-30 bg-purple-600 text-white p-2 rounded-r-lg shadow-lg hover:bg-purple-700 transition-colors"
          initial={{ x: isPanelOpen ? 318 : 2 }}
          animate={{ x: isPanelOpen ? 318 : 2 }}
          transition={{ duration: 0.3 }}
        >
          {isPanelOpen ? '←' : '→'}
        </motion.button>

        {/* Left Panel - File Structure (Sliding) - Dark Theme */}
        <motion.div 
          className="file-explorer-sidebar"
          initial={{ x: isPanelOpen ? 0 : -320, width: 320 }}
          animate={{ x: isPanelOpen ? 0 : -320, width: 320 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="file-explorer-header">
            <h2 className="file-explorer-title">📁 Files & Analysis</h2>
            <p className="file-explorer-subtitle">
              {uploadedFiles.length > 0 ? `${uploadedFiles.length} files uploaded` : `${completedJobs.length} analysis completed`}
            </p>
          </div>
          
          <div className="file-explorer-content">
            {/* Show uploaded files first */}
        {uploadedFiles.length > 0 && (
          <div className="mb-6 file-section">
                <h3 className="file-section-title">📂 Uploaded Files</h3>
                <div className="file-list">
                  {uploadedFiles.map((file, index) => {
                    const jobId = jobIds[index];
                    const status = jobStatuses[jobId];
                    const statusKey = (status?.status || 'pending').toLowerCase();
                    const statusClass = statusKey === 'done' ? 'completed' : statusKey;
                    const statusLabel = (status?.status || 'pending').toUpperCase();
                    
                    return (
                      <motion.div
                        key={`file-${index}`}
                        className="file-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <div className="file-item-content">
                          <div className="file-item-header vertical">
                            <h4 className="file-item-name">🎬 {file.name}</h4>
                            <div className="file-item-sub">
                              <span className={`file-status ${statusClass}`}>{statusLabel}</span>
                            </div>
                          </div>
                          
                          <div className="file-item-details">
                            <p>📦 {Math.round(file.size / 1024 / 1024 * 100) / 100} MB</p>
                            {jobId && <p className="file-item-job">ID: {jobId.slice(0, 8)}...</p>}
                          </div>
                        </div>

                        {/* Progress indicator for running jobs */}
                        {(statusKey === 'running' || statusKey === 'processing') && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-yellow-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show completed analyses */}
            {completedJobs.length > 0 && (
              <div className="file-section">
                <h3 className="file-section-title">📊 Analysis Results</h3>
                <div className="file-list">
                  {completedJobs.map((job, index) => {
                    const matchingUpload = (uploadResults || []).find(u => u.key === job.s3_key) || (uploadResults || [])[index];
                    const fileName = job.filename || (job.s3_key ? job.s3_key.split('/').pop() : `Analysis ${index + 1}`);
                    const status = job.status || 'pending';
                    const statusKey = (status || 'pending').toLowerCase();
                    const statusClass = statusKey === 'done' ? 'completed' : statusKey;
                    const isRunning = statusKey === 'running' || statusKey === 'processing';
                    const isCompleted = statusKey === 'completed' || statusKey === 'done';
                    
                    return (
                      <motion.div
                        key={job.job_id}
                        className="file-item"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <div className="file-item-content">
                          <div className="file-item-header vertical">
                            <h4 className="file-item-name">
                              {isCompleted ? '✅' : isRunning ? '⏳' : statusKey === 'failed' ? '❌' : '📊'} {fileName}
                            </h4>
                            <div className="file-item-sub">
                              <span className={`file-status ${statusClass}`}>{status.toUpperCase()}</span>
                            </div>
                          </div>
                          
                          <div className="file-item-details">
                            <p className="file-item-job">ID: {job.job_id.slice(0, 12)}...</p>
                            {matchingUpload && (
                              <>
                                <p className="file-item-detail"><strong>Bucket:</strong> <span className="break-all">{matchingUpload.bucket}</span></p>
                                <p className="file-item-detail"><strong>Key:</strong> <span className="break-all">{matchingUpload.key}</span></p>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Progress indicator for running jobs */}
                        {isRunning && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-yellow-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                            </div>
                          </div>
                        )}
                        
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {uploadedFiles.length === 0 && completedJobs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No files uploaded yet.</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Upload Videos
                </button>
              </div>
            )}
            
            {/* Info text at bottom */}
            <div className="file-explorer-info">
              <p className="info-text">
                💡 Upload videos to analyze content, detect objects, extract text, and more.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Chat Interface */}
        <motion.div 
          className="flex flex-col w-full bg-gradient-to-b from-gray-50 to-white"
          style={{ paddingLeft: isPanelOpen ? '320px' : '0px' }}
          transition={{ duration: 0.3 }}
        >
          {/* Chat Messages */}
          <div className="chat-messages-container">
            {/* Large Logo in Center - always visible */}
            <div className="center-logo-container">
              <img 
                src={proovidLogo} 
                alt="Proovid AI" 
                className="center-logo"
              />
            </div>
            
            <div className="chat-messages">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`message-wrapper ${message.isBot ? 'bot' : 'user'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={`message-content ${message.isBot ? 'bot' : 'user'}`}>
                    {/* Avatar */}
                    <div className={`message-avatar ${message.isBot ? 'bot' : 'user'}`}>
                      {message.isBot ? '🤖' : '👤'}
                    </div>
                    
                    {/* Message Content */}
                    <div className="message-bubble-wrapper">
                      <div className={`message-bubble ${message.isBot ? 'bot' : 'user'}`}>
                        <p className={`message-text ${message.isBot ? 'bot' : 'user'}`}>
                          {/* Filter out debug information */}
                          {message.text.split('🎯 **PROFESSIONAL RAG CHATBOT:**')[0].trim()}
                        </p>
                      </div>
                      <div className={`message-meta ${message.isBot ? 'bot' : 'user'}`}>
                        <span className="sender">
                          {message.isBot ? 'Proovid AI' : 'You'}
                        </span>
                        <span className="dot">•</span>
                        <span className="time">{formatTime(message.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                className="typing-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="message-avatar bot">
                  🤖
                </div>
                <div className="message-bubble-wrapper">
                  <div className="typing-bubble">
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                  <p className="typing-text">Proovid AI is thinking...</p>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div className="message-input-container">
            <div className="message-input-wrapper">
              <div className="message-input-group">
                <div className="message-input-field">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here..."
                    className="message-input"
                    rows={1}
                    style={{ minHeight: '56px', maxHeight: '120px' }}
                    disabled={isTyping}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="send-button"
                >
                  {isTyping ? (
                    <div className="spinner"></div>
                  ) : (
                    '➤'
                  )}
                </button>
                
                {/* Director's Chair Floating Button - Navigate to Video Compare */}
                <button
                  onClick={() => navigate('/video-compare', { 
                    state: { 
                      completedJobs,
                      uploadResults,
                      uploadedFiles,
                      jobIds 
                    } 
                  })}
                  className="director-chair-fab"
                  title="Video Compare"
                >
                  🎬
                </button>
              </div>
              <p className="input-hint">
                Press <kbd>Enter</kbd> to send • <kbd>Shift+Enter</kbd> for new line
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChatBotScreen;