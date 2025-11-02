import React, { useState, useEffect } from 'react';
import { useAuth } from './Login';
import { useTranslation } from 'react-i18next';

const ResultsPage = ({ jobId, onBack }) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authenticatedFetch } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchResults = async () => {
      const apiBase = import.meta.env.VITE_API_URL || "";
      
      try {
        const response = await authenticatedFetch(`${apiBase}/jobs/${jobId}/results`);
        
        if (!response.ok) {
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Job not completed yet");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setResults(data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchResults();
    }
  }, [jobId, authenticatedFetch]);

  const renderPieChart = (blackframes, totalFrames) => {
    if (!blackframes || !totalFrames) return null;
    
    const percentage = (blackframes / totalFrames) * 100;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
        <div style={{ position: 'relative' }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e9ecef"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#dc3545"
              strokeWidth="10"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
              {blackframes}
            </div>
            <div style={{ fontSize: '10px', color: '#6c757d' }}>
              {t('resultsPage.blackframes.ofFrames', { total: totalFrames })}
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
            {percentage.toFixed(1)}%
          </div>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>
            {t('resultsPage.blackframes.pieChartLabel')}
          </div>
        </div>
      </div>
    );
  };

  const renderBlackframesList = (blackframes, analysisResults) => {
    // Try to get blackframe data from multiple sources
    let blackframeData = [];
    
    // First, try the analysis_results structure (most reliable)
    if (analysisResults?.blackframes?.black_frames) {
      blackframeData = analysisResults.blackframes.black_frames;
    }
    // Fallback to original structure
    else if (blackframes?.frames) {
      blackframeData = blackframes.frames;
    }
    
    if (!blackframeData || blackframeData.length === 0) {
      return <div style={{ color: '#888' }}>{t('resultsPage.blackframes.noBlackframesFound')}</div>;
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>
          {t('resultsPage.blackframes.detailsTitle')} ({blackframeData.length} {t('resultsPage.blackframes.detailsCount')})
        </h4>
        <div style={{ 
          maxHeight: '400px', 
          overflowY: 'auto',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          padding: '15px'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: '#495057' }}>{t('resultsPage.blackframes.frameNumber')}</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#495057' }}>{t('resultsPage.blackframes.timeSeconds')}</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#495057' }}>{t('resultsPage.blackframes.brightness')}</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#495057' }}>{t('resultsPage.blackframes.status')}</th>
              </tr>
            </thead>
            <tbody>
              {blackframeData.map((frame, index) => {
                const frameNumber = frame.frame !== null ? frame.frame : index;
                const brightness = frame.brightness || 0;
                const brightnessScaled = brightness * 255; // Convert to 0-255 scale
                
                return (
                  <tr key={index} style={{ 
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                  }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#dc3545' }}>
                      #{frameNumber}
                    </td>
                    <td style={{ padding: '8px', color: '#6c757d' }}>
                      {frame.timestamp ? frame.timestamp.toFixed(2) : t('resultsPage.textDetection.notAvailable')}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '60px',
                          height: '8px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(brightnessScaled / 255) * 100}%`,
                            height: '100%',
                            backgroundColor: brightnessScaled < 5 ? '#dc3545' : brightnessScaled < 20 ? '#ffc107' : '#28a745'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6c757d', minWidth: '45px' }}>
                          {brightnessScaled.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        backgroundColor: brightnessScaled < 5 ? '#dc3545' : '#6c757d',
                        color: 'white'
                      }}>
                        {brightnessScaled < 5 ? t('resultsPage.blackframes.fullBlack') : t('resultsPage.blackframes.dark')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTextDetections = (textDetection, analysisResults) => {
    // Try to get text detections from multiple sources
    let textDetections = [];
    
    // First, try the analysis_results structure (most reliable)
    if (analysisResults?.text_detection?.text_detections) {
      textDetections = analysisResults.text_detection.text_detections;
    }
    // Fallback to original structure
    else if (textDetection?.texts?.filter(t => t.text && t.text.trim())) {
      textDetections = textDetection.texts.filter(t => t.text && t.text.trim());
    }
    
    if (!textDetections || textDetections.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '30px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            {t('resultsPage.textDetection.noTextsDetected')}
          </div>
          <div style={{ fontSize: '14px' }}>
            {t('resultsPage.textDetection.noTextsMessage')}
            <br />
            {t('resultsPage.textDetection.noTextsReasons')}
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>{t('resultsPage.textDetection.detectedTexts')} ({textDetections.length})</h4>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {textDetections.map((text, index) => (
            <div key={index} style={{
              padding: '15px',
              margin: '10px 0',
              backgroundColor: '#ffffff',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              borderLeft: '4px solid #007bff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '8px',
                gap: '10px'
              }}>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  wordBreak: 'break-word',
                  flex: 1
                }}>
                  "{text.text}"
                </span>
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: text.confidence > 90 ? '#d4edda' : text.confidence > 70 ? '#fff3cd' : '#f8d7da',
                  color: text.confidence > 90 ? '#155724' : text.confidence > 70 ? '#856404' : '#721c24',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}>
                  {Math.round(text.confidence || 0)}%
                </span>
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6c757d',
                display: 'flex',
                gap: '15px',
                flexWrap: 'wrap'
              }}>
                <span>{t('resultsPage.textDetection.time', { time: text.timestamp ? text.timestamp.toFixed(2) : t('resultsPage.textDetection.notAvailable') })}</span>
                <span>{t('resultsPage.textDetection.frame', { frame: text.frame || t('resultsPage.textDetection.notAvailable') })}</span>
                <span>{t('resultsPage.textDetection.position', { position: text.bbox || text.boundingBox ? t('resultsPage.textDetection.available') : t('resultsPage.textDetection.notAvailable') })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '4px solid #e9ecef', 
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ color: '#6c757d', fontSize: '16px' }}>
          {t('resultsPage.loadingResults')}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8d7da',
        borderRadius: '8px',
        border: '1px solid #f1aeb5'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h3 style={{ color: '#721c24', marginBottom: '15px' }}>
          {t('resultsPage.errorTitle')}
        </h3>
        <p style={{ color: '#721c24', marginBottom: '20px' }}>
          {error}
        </p>
        <button 
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {t('resultsPage.backToDashboard')}
        </button>
      </div>
    );
  }

  if (!results) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffeaa7'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
        <h3 style={{ color: '#856404', marginBottom: '15px' }}>
          {t('resultsPage.noResults')}
        </h3>
        <p style={{ color: '#856404' }}>
          {t('resultsPage.noResultsMessage')}
        </p>
      </div>
    );
  }

  const { blackframes, text_detection, video_info, analysis_results } = results;
  const totalFrames = blackframes?.total_frames || 
                      analysis_results?.blackframes?.video_metadata?.total_frames || 
                      results?.analysis_results?.blackframes?.video_metadata?.total_frames || 100;
  const blackframeCount = blackframes?.count || 
                          analysis_results?.blackframes?.blackframes_detected || 
                          results?.analysis_results?.blackframes?.blackframes_detected || 0;
  const textDetectionCount = text_detection?.count || 
                             analysis_results?.text_detection?.count || 
                             results?.analysis_results?.text_detection?.count || 0;

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: '#2c3e50', 
        color: '#ffffff',
        padding: '20px', 
        borderRadius: '12px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {t('resultsPage.title')}
          </h2>
          <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '14px' }}>
            {t('resultsPage.jobIdShort')} {jobId?.substring(0, 8)}...
          </p>
        </div>
        <button 
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#ffffff',
            color: '#2c3e50',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {t('back')}
        </button>
      </div>

      {/* Video Information */}
      <div style={{ 
        backgroundColor: '#2c3e50', 
        color: '#ffffff',
        padding: '30px', 
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px', marginRight: '12px' }}>🎬</span>
          <h3 style={{ 
            margin: 0, 
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {t('resultsPage.videoInfo.title')}
          </h3>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px',
          color: '#ffffff'
        }}>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '5px' }}>{t('resultsPage.videoInfo.filename')}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {results?.analysis_results?.video_info?.key || 
               video_info?.filename || 
               video_info?.key || 
               'BlackframeVideo.mp4'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '5px' }}>{t('resultsPage.videoInfo.totalFrames')}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {totalFrames} {t('resultsPage.videoInfo.frames')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '5px' }}>{t('resultsPage.videoInfo.estimatedDuration')}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {video_info?.duration ? `${video_info.duration.toFixed(2)}s` : 
               totalFrames ? `~${(totalFrames / 30).toFixed(1)}s` : t('resultsPage.textDetection.notAvailable')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '5px' }}>{t('resultsPage.videoInfo.s3Bucket')}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {results?.analysis_results?.video_info?.bucket || t('resultsPage.textDetection.notAvailable')}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Summary */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        padding: '30px', 
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px', marginRight: '12px' }}>📊</span>
          <h3 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {t('resultsPage.analysisSummary.title')}
          </h3>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '30px',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#dc3545', marginBottom: '5px' }}>
              {blackframeCount}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>{t('resultsPage.analysisSummary.blackframesFound')}</div>
          </div>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#007bff', marginBottom: '5px' }}>
              {textDetectionCount}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>{t('resultsPage.analysisSummary.textsDetected')}</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745', marginBottom: '5px' }}>
              {t(`resultsPage.analysisSummary.${results?.summary?.analysis_type || analysis_results?.analysis_type || 'complete'}`)}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>{t('resultsPage.analysisSummary.analysisType')}</div>
          </div>
        </div>

        {/* Pie Chart */}
        {renderPieChart(blackframeCount, totalFrames)}
      </div>

      {/* Blackframes Details */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        padding: '30px', 
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px', marginRight: '12px' }}>🎞️</span>
          <h3 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {t('resultsPage.blackframes.title')}
          </h3>
        </div>
        
        {renderBlackframesList(blackframes, analysis_results)}
      </div>

      {/* Text Detection */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        padding: '30px', 
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px', marginRight: '12px' }}>🔤</span>
          <h3 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            {t('resultsPage.textDetection.title')}
          </h3>
        </div>
        
        {renderTextDetections(text_detection, analysis_results)}
      </div>

      {/* Raw Data */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}>
        <details>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            color: '#495057',
            marginBottom: '15px'
          }}>
            {t('resultsPage.rawDataShow')}
          </summary>
          <pre style={{ 
            backgroundColor: '#2d2d30', 
            color: '#ffffff', 
            padding: '20px', 
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            lineHeight: '1.4'
          }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default ResultsPage;
