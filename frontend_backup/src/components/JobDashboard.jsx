import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useAuth } from "./Login";
import ResultsPage from "./ResultsPage";
import { useTranslation } from 'react-i18next';

// Helper function to extract filename from job
const getJobFilename = (job) => {
  // Extract filename logic
  const videoInfo = job.latest_doc?.video_info;
  if (videoInfo) {
    if (videoInfo.filename) return videoInfo.filename;
    if (videoInfo.key) return videoInfo.key;
    if (videoInfo.name) return videoInfo.name;
  }
  
  let video = job.latest_doc?.video || job.video;
  if (typeof video === 'string') {
    try {
      const parsed = JSON.parse(video);
      if (parsed && typeof parsed === 'object') {
        video = parsed;
      }
    } catch (e) {
      return video;
    }
  }
  
  if (typeof video === 'object' && video) {
    if (video.key) return video.key;
    if (video.name) return video.name;
    if (video.filename) return video.filename;
  }
  
  const s3Key = job.latest_doc?.s3_key || job.s3_key;
  if (s3Key) return s3Key;
  
  const result = job.result;
  if (result) {
    try {
      const resultData = typeof result === 'string' ? JSON.parse(result) : result;
      if (resultData.s3_location) {
        const s3Path = resultData.s3_location.replace('s3://', '');
        const pathParts = s3Path.split('/');
        if (pathParts.length > 1) {
          return pathParts.slice(1).join('/');
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  return job.key || "-";
};

// Memoized Job Row Component to prevent unnecessary re-renders
const JobRow = memo(({ job, onSelectJob, onRestartJob, onDeleteJob }) => {
  const { t } = useTranslation();
  const isJobCompleted = job.status === 'done' || job.status === 'completed';
  const hasS3Result = isJobCompleted && job.result && 
    ((typeof job.result === 'string' && job.result.includes('s3_location')) ||
     (typeof job.result === 'object' && job.result.s3_location));
  
  const rowStyle = hasS3Result ? {
    backgroundColor: "#27ae60",
    borderLeft: "4px solid #2ecc71"
  } : {
    backgroundColor: "#34495e"
  };

  const cellStyle = {
    padding: "12px", 
    border: "1px solid #2c3e50",
    verticalAlign: 'middle',
    color: '#ecf0f1'
  };

  return (
    <tr style={rowStyle}>
      <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: '12px', fontWeight: 'bold' }}>
        <span title={job.job_id}>
          {job.job_id ? String(job.job_id).substr(0, 8) + "..." : "-"}
        </span>
      </td>
      <td style={cellStyle}>
        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getJobFilename(job)}
        </div>
      </td>
      <td style={cellStyle}>
        <span style={{ 
          padding: "4px 8px", 
          borderRadius: "12px", 
          fontSize: "12px",
          fontWeight: 'bold',
          backgroundColor: isJobCompleted ? '#d4edda' : 
                           job.status === 'error' ? '#f8d7da' : 
                           job.status === 'running' ? '#fff3cd' : '#e2e3e5',
          color: isJobCompleted ? '#155724' : 
                 job.status === 'error' ? '#721c24' : 
                 job.status === 'running' ? '#856404' : '#383d41'
        }}>
          {job.status === 'done' || job.status === 'completed' ? `✅ ${t('completed')}` :
           job.status === 'error' ? `❌ ${t('failed')}` :
           job.status === 'running' ? `🔄 ${t('processing')}` : 
           String(job.status || t('unknownStatus'))}
        </span>
      </td>
      <td style={{ ...cellStyle, fontSize: "13px", color: '#bdc3c7' }}>
        {(() => {
          if (job.created_at) {
            try {
              const date = new Date(job.created_at * 1000);
              
              // Format date and time based on locale
              const isEnglish = t('dateFormat') === 'MM/DD/YYYY';
              const locale = isEnglish ? 'en-US' : 'de-DE';
              
              const dateStr = date.toLocaleDateString(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              });
              
              const timeStr = date.toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: isEnglish
              });
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontWeight: 'bold' }}>{dateStr}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>{timeStr}</div>
                </div>
              );
            } catch (e) {
              console.error('Error parsing created_at:', e);
            }
          }
          return t('recently');
        })()}
      </td>
      <td style={cellStyle}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {isJobCompleted && (
            <button
              onClick={() => onSelectJob(job.job_id)}
              style={{
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                padding: "6px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: '500'
              }}
              title="Detaillierte Ergebnisse anzeigen"
            >
              📊 Anzeigen
            </button>
          )}
          <button
            onClick={() => onRestartJob(job.job_id)}
            style={{
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontWeight: '500'
            }}
            title="Job neu starten"
          >
            🔄 Restart
          </button>
          <button
            onClick={() => onDeleteJob(job.job_id)}
            style={{
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontWeight: '500'
            }}
            title="Job löschen"
          >
            🗑️ Löschen
          </button>
        </div>
      </td>
    </tr>
  );
});

JobRow.displayName = 'JobRow';

export default function JobDashboard() {
  const { authenticatedFetch } = useAuth();
  const { t } = useTranslation();
  const apiBase = import.meta.env.VITE_API_URL || "";
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Stable comparison function to prevent unnecessary re-renders
  const areJobsEqual = useCallback((oldJobs, newJobs) => {
    if (!Array.isArray(oldJobs) || !Array.isArray(newJobs)) return false;
    if (oldJobs.length !== newJobs.length) return false;
    
    for (let i = 0; i < oldJobs.length; i++) {
      const oldJob = oldJobs[i];
      const newJob = newJobs[i];
      
      if (!oldJob || !newJob) return false;
      
      if (oldJob.job_id !== newJob.job_id ||
          oldJob.status !== newJob.status ||
          oldJob.created_at !== newJob.created_at) {
        return false;
      }
    }
    return true;
  }, []);

  const fetchJobs = useCallback(async () => {
    // Don't set loading if we already have jobs (silent refresh)
    const hasJobs = jobs.length > 0;
    if (!hasJobs) {
      setLoading(true);
    }
    
    try {
      const res = await authenticatedFetch(`${apiBase}/jobs`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newJobs = data.jobs || data || [];
      
      // Only update state if jobs actually changed
      setJobs(prevJobs => {
        if (areJobsEqual(prevJobs, newJobs)) {
          return prevJobs; // Return same reference to prevent re-render
        }
        return newJobs;
      });
    } catch (err) {
      console.error("fetchJobs error", err);
    } finally {
      if (!hasJobs) {
        setLoading(false);
      }
    }
  }, [authenticatedFetch, apiBase, areJobsEqual, jobs.length]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, sortBy, sortOrder]);

  // Memoized filtered and sorted jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = [...jobs]; // Create a copy to avoid mutations
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => {
        if (statusFilter === 'completed') return job.status === 'done' || job.status === 'completed';
        if (statusFilter === 'running') return job.status === 'running';
        if (statusFilter === 'error') return job.status === 'error';
        return true;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(job => {
        const filename = getJobFilename(job).toLowerCase();
        const jobId = (job.job_id || '').toLowerCase();
        return filename.includes(searchLower) || jobId.includes(searchLower);
      });
    }
    
    // Sort jobs
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'created_at':
          aVal = a.created_at || 0;
          bVal = b.created_at || 0;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'filename':
          aVal = getJobFilename(a);
          bVal = getJobFilename(b);
          break;
        default:
          aVal = a[sortBy] || '';
          bVal = b[sortBy] || '';
      }
      
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });
    
    return filtered;
  }, [jobs, statusFilter, searchTerm, sortBy, sortOrder]);

  // Pagination calculations
  const totalJobs = filteredAndSortedJobs.length;
  const totalPages = Math.ceil(totalJobs / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedJobs = filteredAndSortedJobs.slice(startIndex, startIndex + itemsPerPage);

  async function deleteJob(jobId) {
    if (!confirm(`Job ${jobId.substring(0, 8)}... wirklich löschen?`)) return;
    
    try {
      const res = await authenticatedFetch(`${apiBase}/jobs/${jobId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Job gelöscht!");
      fetchJobs();
    } catch (err) {
      console.error("deleteJob error", err);
      alert("Fehler beim Löschen: " + err.message);
    }
  }

  async function restartJob(jobId) {
    if (!confirm(`Job ${jobId.substring(0, 8)}... neu starten?`)) return;
    
    try {
      const res = await authenticatedFetch(`${apiBase}/jobs/${jobId}/restart`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Job neu gestartet!");
      fetchJobs();
    } catch (err) {
      console.error("restartJob error", err);
      alert("Fehler beim Neustarten: " + err.message);
    }
  }

  async function deleteAllJobs() {
    if (!confirm("Wirklich ALLE sichtbaren Jobs löschen? Diese Aktion kann nicht rückgängig gemacht werden!")) return;
    
    const deletePromises = filteredAndSortedJobs.map(job => 
      authenticatedFetch(`${apiBase}/jobs/${job.job_id}`, { method: "DELETE" })
        .catch(err => console.error(`Failed to delete job ${job.job_id}:`, err))
    );
    
    try {
      await Promise.all(deletePromises);
      alert(`${filteredAndSortedJobs.length} Jobs gelöscht!`);
      fetchJobs();
    } catch (err) {
      console.error("deleteAllJobs error", err);
      alert("Fehler beim Löschen einiger Jobs: " + err.message);
    }
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↗️' : '↘️';
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Increased to 5 seconds to reduce load
    return () => clearInterval(interval);
  }, [fetchJobs]);

  if (selectedJobId) {
    return (
      <ResultsPage 
        jobId={selectedJobId} 
        onBack={() => setSelectedJobId(null)} 
      />
    );
  }

  return (
    <div className="job-dashboard">
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
          📊 {t('dashboard')}
        </h1>
        <p style={{
          color: '#bdc3c7',
          fontSize: '16px',
          margin: 0
        }}>
          {t('dashboardOverview')} ({totalJobs} {t('jobs')})
        </p>
      </div>

      {/* Filters and Controls */}
      <div style={{
        backgroundColor: '#34495e',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <input
            type="text"
            placeholder={`🔍 ${t('searchFilenameOrJobId')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #2c3e50',
              backgroundColor: '#2c3e50',
              color: 'white',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #2c3e50',
              backgroundColor: '#2c3e50',
              color: 'white',
              fontSize: '14px'
            }}
          >
            <option value="all">Alle Status</option>
            <option value="completed">✅ Fertig</option>
            <option value="running">🔄 Laufend</option>
            <option value="error">❌ Fehler</option>
          </select>
        </div>

        {/* Items per Page */}
        <div style={{ minWidth: '120px' }}>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #2c3e50',
              backgroundColor: '#2c3e50',
              color: 'white',
              fontSize: '14px'
            }}
          >
            <option value={10}>10 pro Seite</option>
            <option value={20}>20 pro Seite</option>
            <option value={50}>50 pro Seite</option>
            <option value={100}>100 pro Seite</option>
          </select>
        </div>

        {/* Delete All Button */}
        <button
          onClick={deleteAllJobs}
          disabled={filteredAndSortedJobs.length === 0}
          style={{
            backgroundColor: filteredAndSortedJobs.length === 0 ? "#7f8c8d" : "#e74c3c",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: filteredAndSortedJobs.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: '160px',
            justifyContent: 'center'
          }}
        >
          🗑️ Alle löschen ({filteredAndSortedJobs.length})
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#bdc3c7',
          backgroundColor: '#34495e',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          🔄 Aktualisiere Jobs...
        </div>
      )}

      {/* Jobs Table */}
      <div style={{ 
        backgroundColor: '#2c3e50', 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        border: '1px solid #34495e'
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#34495e", color: "white" }}>
              <th 
                style={{ 
                  padding: "12px", 
                  border: "1px solid #2c3e50", 
                  textAlign: "left", 
                  fontWeight: "bold",
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('job_id')}
              >
                {t('jobId')} {getSortIcon('job_id')}
              </th>
              <th 
                style={{ 
                  padding: "12px", 
                  border: "1px solid #2c3e50", 
                  textAlign: "left", 
                  fontWeight: "bold",
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('filename')}
              >
                {t('fileName')} {getSortIcon('filename')}
              </th>
              <th 
                style={{ 
                  padding: "12px", 
                  border: "1px solid #2c3e50", 
                  textAlign: "left", 
                  fontWeight: "bold",
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('status')}
              >
                {t('status')} {getSortIcon('status')}
              </th>
              <th 
                style={{ 
                  padding: "12px", 
                  border: "1px solid #2c3e50", 
                  textAlign: "left", 
                  fontWeight: "bold",
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('created_at')}
              >
                {t('created')} {getSortIcon('created_at')}
              </th>
              <th style={{ 
                padding: "12px", 
                border: "1px solid #2c3e50", 
                textAlign: "left", 
                fontWeight: "bold"
              }}>
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedJobs.map(job => (
              <JobRow
                key={job.job_id}
                job={job}
                onSelectJob={setSelectedJobId}
                onRestartJob={restartJob}
                onDeleteJob={deleteJob}
              />
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {paginatedJobs.length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#bdc3c7',
            backgroundColor: '#34495e'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#ecf0f1' }}>Keine Jobs gefunden</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Versuchen Sie andere Filter oder Suchbegriffe'
                : 'Starten Sie eine Videoanalyse, um Jobs zu sehen'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          backgroundColor: '#34495e',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#7f8c8d' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            «
          </button>
          
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#7f8c8d' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            ‹
          </button>

          <div style={{ 
            display: 'flex', 
            gap: '4px',
            alignItems: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {(() => {
              const pages = [];
              const showEllipsis = totalPages > 7;
              
              if (!showEllipsis) {
                // Show all pages if 7 or fewer
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: i === currentPage ? '#e74c3c' : '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      {i}
                    </button>
                  );
                }
              } else {
                // Show pages with ellipsis for many pages
                const startPages = Math.min(3, currentPage);
                const endPages = Math.max(totalPages - 2, currentPage);
                
                for (let i = 1; i <= startPages; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: i === currentPage ? '#e74c3c' : '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      {i}
                    </button>
                  );
                }
                
                if (currentPage > 4) {
                  pages.push(<span key="ellipsis1" style={{ color: '#bdc3c7', padding: '0 8px' }}>...</span>);
                }
                
                if (currentPage > 3 && currentPage < totalPages - 2) {
                  pages.push(
                    <button
                      key={currentPage}
                      onClick={() => setCurrentPage(currentPage)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      {currentPage}
                    </button>
                  );
                }
                
                if (currentPage < totalPages - 3) {
                  pages.push(<span key="ellipsis2" style={{ color: '#bdc3c7', padding: '0 8px' }}>...</span>);
                }
                
                for (let i = endPages; i <= totalPages; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: i === currentPage ? '#e74c3c' : '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '40px'
                      }}
                    >
                      {i}
                    </button>
                  );
                }
              }
              
              return pages;
            })()}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#7f8c8d' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            ›
          </button>
          
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#7f8c8d' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            »
          </button>

          <div style={{ 
            marginLeft: '20px',
            color: '#bdc3c7',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            Seite {currentPage} von {totalPages} 
            <span style={{ color: '#95a5a6' }}>•</span>
            {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalJobs)} von {totalJobs} Jobs
          </div>
        </div>
      )}
    </div>
  );
}