import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './Login';
import { useTranslation } from 'react-i18next';

export default function VideoChatBot() {
  const { authenticatedFetch } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    
    try {
      // Load chat suggestions
      const suggestionsRes = await authenticatedFetch(`${apiBase}/chat/suggestions`);
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData.suggestions || []);
      }

      // Load vector DB stats
      const statsRes = await authenticatedFetch(`${apiBase}/vector-db/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const sendMessage = async (message = inputMessage) => {
    if (!message.trim()) return;

    const userMessage = { type: 'user', content: message, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    const apiBase = import.meta.env.VITE_API_URL || "/api";
    
    try {
      const response = await authenticatedFetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: message,
          context_limit: 5 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      const botMessage = {
        type: 'bot',
        content: data.response,
        matchedVideos: data.matched_videos || [],
        contextUsed: data.context_used || 0,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        type: 'bot',
        content: `❌ Fehler: ${error.message}`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '80vh',
      backgroundColor: '#34495e',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#2c3e50', 
        borderBottom: '1px solid #4a5f7a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#ecf0f1' }}>🤖 Video AI ChatBot</h3>
          {stats && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#bdc3c7' }}>
              📊 {stats.total_videos} Videos analysiert | 🗄️ {stats.database_type} | 🧠 {stats.llm_provider}
            </p>
          )}
        </div>
        
        <button
          onClick={clearChat}
          style={{
            padding: '8px 12px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🗑️ Chat leeren
        </button>
      </div>

      {/* Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px',
        backgroundColor: '#34495e'
      }}>
        {messages.length === 0 && suggestions.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ color: '#ecf0f1', marginBottom: '12px' }}>💡 Beispiel-Fragen:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestions.slice(0, 6).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(suggestion)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: '16px',
              display: 'flex',
              flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '16px',
                backgroundColor: message.type === 'user' 
                  ? '#3498db' 
                  : message.isError 
                    ? '#e74c3c' 
                    : '#4a5f7a',
                color: '#ecf0f1',
                marginLeft: message.type === 'user' ? '0' : '8px',
                marginRight: message.type === 'user' ? '8px' : '0'
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                {message.content}
              </div>
              
              {message.matchedVideos && message.matchedVideos.length > 0 && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  backgroundColor: 'rgba(0,0,0,0.2)', 
                  borderRadius: '8px' 
                }}>
                  <h5 style={{ margin: '0 0 8px 0', color: '#f39c12' }}>
                    🎥 Gefundene Videos ({message.matchedVideos.length}):
                  </h5>
                  {message.matchedVideos.map((video, vIndex) => (
                    <div key={vIndex} style={{ 
                      marginBottom: '8px', 
                      padding: '8px', 
                      backgroundColor: 'rgba(0,0,0,0.1)', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#3498db' }}>
                        📁 {video.video_key}
                      </div>
                      <div style={{ color: '#bdc3c7', marginTop: '4px' }}>
                        🔍 Ähnlichkeit: {(video.similarity_score * 100).toFixed(1)}% |
                        🏷️ {video.semantic_tags ? video.semantic_tags.slice(0, 5).join(', ') : 'Keine Labels'}
                      </div>
                      <div style={{ color: '#95a5a6', fontSize: '10px', marginTop: '2px' }}>
                        ID: {video.job_id.substring(0, 8)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ 
                fontSize: '10px', 
                color: '#95a5a6', 
                marginTop: '8px',
                textAlign: message.type === 'user' ? 'right' : 'left'
              }}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            color: '#95a5a6',
            marginLeft: '8px'
          }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              border: '2px solid #3498db',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '8px'
            }} />
            KI analysiert Videos...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#2c3e50', 
        borderTop: '1px solid #4a5f7a'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Fragen Sie mich über Ihre Videos... (z.B. 'Zeig mir Videos mit Autos')"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #4a5f7a',
              borderRadius: '8px',
              backgroundColor: '#34495e',
              color: '#ecf0f1',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
              fontSize: '14px'
            }}
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            style={{
              padding: '12px 20px',
              backgroundColor: isLoading || !inputMessage.trim() ? '#7f8c8d' : '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              minWidth: '80px'
            }}
          >
            {isLoading ? '...' : '📤'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}