import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationMenu from '../components/NavigationMenu';
import proovidLogo from '../assets/proovid-03.jpg';
import { apiService } from '../services/api-service';
import type { JobStatus } from '../services/api-service';
import type { UploadResult } from '../services/s3-upload';
import './ChatBotScreen.css';

interface ChatBotScreenProps {
  onLogout: () => void;
}

interface LocationState {
  jobIds: string[];
  uploadResults: UploadResult[];
  completedJobs?: JobStatus[];
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
  const completedJobs = state?.completedJobs || [];
  const uploadResults = state?.uploadResults || [];
  const uploadedFiles = state?.uploadedFiles || [];
  const jobIds = state?.jobIds || [];
  const isFromUpload = state?.isFromUpload || false;
  
  // Panel should be open by default
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Debug logging
  console.log('ChatBot received state:', {
    completedJobs,
    uploadResults,
    uploadedFiles,
    jobIds,
    isFromUpload,
    fullState: state
  });

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
        const result = await apiService.getJobStatus(jobIds);
        
        if (!isActive) return;
        
        // Reset error count on success
        errorCount = 0;
        
        if (result.success && result.statuses.length > 0) {
          const statusMap: { [jobId: string]: JobStatus } = {};
          
          result.statuses.forEach(status => {
            statusMap[status.job_id] = status;
          });
          
          setJobStatuses(statusMap);
          
          // Check if all jobs are completed
          const allCompleted = result.statuses.every(status => 
            status.status === 'completed' || status.status === 'failed'
          );
          
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
      // Send message to API
      const response = await apiService.chat({
        message: inputMessage,
        conversation_id: conversationId
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
        
        <div className="header-actions">
          {/* Director's Chair Icon - Navigate to Video Compare */}
          <button
            onClick={() => navigate('/video-compare')}
            className="director-chair-button"
            title="Video Compare"
          >
            🎬
          </button>
          
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

        {/* Left Panel - File Structure (Sliding) */}
        <motion.div 
          className="bg-white border-r border-gray-200 flex flex-col absolute left-0 top-0 h-full z-20 shadow-lg"
          initial={{ x: isPanelOpen ? 0 : -320, width: 320 }}
          animate={{ x: isPanelOpen ? 0 : -320, width: 320 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Files & Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              {uploadedFiles.length > 0 ? `${uploadedFiles.length} files uploaded` : `${completedJobs.length} analysis completed`}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* Show uploaded files first */}
            {uploadedFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => {
                    const jobId = jobIds[index];
                    const status = jobStatuses[jobId];
                    
                    return (
                      <motion.div
                        key={`file-${index}`}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm truncate">
                            {file.name}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            status?.status === 'completed' ? 'bg-green-100 text-green-800' :
                            status?.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                            status?.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status?.status || 'pending'}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          <p><strong>Size:</strong> {Math.round(file.size / 1024 / 1024 * 100) / 100} MB</p>
                          {jobId && <p><strong>Job ID:</strong> {jobId}</p>}
                        </div>

                        {/* Progress indicator for running jobs */}
                        {status?.status === 'running' && (
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
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Completed Analyses</h3>
                <div className="space-y-3">
                  {completedJobs.map((job, index) => (
                    <motion.div
                      key={job.job_id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">
                          Analysis {index + 1}
                        </h4>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                          Completed
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><strong>Job ID:</strong> {job.job_id}</p>
                        {uploadResults[index] && (
                          <>
                            <p><strong>Bucket:</strong> {uploadResults[index].bucket}</p>
                            <p><strong>Key:</strong> {uploadResults[index].key}</p>
                          </>
                        )}
                      </div>
                      
                      {job.result && (
                        <div className="mt-2 p-2 bg-white rounded text-xs">
                          <p className="text-gray-700 line-clamp-3">
                            {typeof job.result === 'string' 
                              ? job.result.slice(0, 100) + (job.result.length > 100 ? '...' : '')
                              : JSON.stringify(job.result).slice(0, 100) + '...'
                            }
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
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