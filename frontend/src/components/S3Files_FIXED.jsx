import React, { useEffect, useState } from "react";
import { useAuth } from "./Login";
import { useTranslation } from 'react-i18next';

export default function S3Files({ onAnalyze, panelOpen, setPanelOpen }) {
  const [expanded, setExpanded] = useState({});
  const [selectedFolder, setSelectedFolder] = useState(''); // Currently selected folder in tree
  const { authenticatedFetch } = useAuth();
  const { t } = useTranslation();
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // Helper: Check if file is a video
  function isVideoFile(key) {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    return videoExtensions.some(ext => key.toLowerCase().endsWith(ext));
  }

  // Helper: Check if file is a ZIP file
  function isZipFile(key) {
    return key.toLowerCase().endsWith('.zip');
  }

  // Helper: Check if item is a directory
  function isDirectory(file) {
    return file.is_directory === true || file.key.endsWith('/');
  }

  // Build a tree structure for folders and separate file list
  function buildTree(files) {
    const root = { children: {}, files: [] };
    const allFolders = new Set();
    
    // First pass: collect all folder paths
    files.forEach(file => {
      const parts = file.key.split('/').filter(Boolean);
      let currentPath = '';
      
      // Add all parent folders to the set
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? '/' : '') + parts[i];
        allFolders.add(currentPath);
      }
    });
    
    // Second pass: build folder tree
    allFolders.forEach(folderPath => {
      const parts = folderPath.split('/');
      let node = root;
      let currentPath = '';
      
      parts.forEach((part, idx) => {
        currentPath += (currentPath ? '/' : '') + part;
        if (!node.children[part]) {
          node.children[part] = { 
            children: {}, 
            files: [], 
            path: currentPath,
            name: part,
            isFolder: true
          };
        }
        node = node.children[part];
      });
    });
    
    // Third pass: assign files to their respective folders
    files.forEach(file => {
      const parts = file.key.split('/').filter(Boolean);
      if (parts.length === 1) {
        // File in root
        root.files.push(file);
      } else {
        // File in a folder
        const folderPath = parts.slice(0, -1).join('/');
        let node = root;
        parts.slice(0, -1).forEach(part => {
          node = node.children[part];
        });
        if (node) {
          node.files.push(file);
        }
      }
    });
    
    return root;
  }

  // Get files for the current selected folder
  function getCurrentFolderFiles(treeData, selectedFolder) {
    if (!selectedFolder) {
      return treeData.files || [];
    }
    
    const parts = selectedFolder.split('/').filter(Boolean);
    let node = treeData;
    
    for (const part of parts) {
      if (node.children && node.children[part]) {
        node = node.children[part];
      } else {
        return [];
      }
    }
    
    return node.files || [];
  }

  // Render folder tree (left pane)
  function renderFolderTree(node, parentKey = "", level = 0) {
    if (!node || !node.children || Object.keys(node.children).length === 0) {
      if (level === 0) {
        return (
          <div style={{ 
            color: '#7f8c8d', 
            fontStyle: 'italic', 
            padding: '12px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            No folders found
          </div>
        );
      }
      return null;
    }
    
    return (
      <div>
        {Object.entries(node.children).map(([name, value]) => {
          const folderPath = value.path;
          const isOpen = !!expanded[folderPath];
          const isSelected = selectedFolder === folderPath;
          const hasSubfolders = value.children && Object.keys(value.children).length > 0;
          
          return (
            <div key={folderPath}>
              <div 
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "3px 6px",
                  marginLeft: level * 12,
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                  borderRadius: "3px",
                  fontSize: "13px",
                  minHeight: "20px"
                }}
                onClick={() => {
                  setSelectedFolder(folderPath);
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.target.style.backgroundColor = "#f5f5f5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.target.style.backgroundColor = "transparent";
                  }
                }}
              >
                {hasSubfolders && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0",
                      marginRight: "4px",
                      fontSize: "10px",
                      color: "#666",
                      width: "12px",
                      height: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {isOpen ? "▼" : "▶"}
                  </button>
                )}
                
                {!hasSubfolders && (
                  <div style={{ width: "16px" }}></div>
                )}
                
                <span style={{ 
                  fontSize: "14px", 
                  marginRight: "6px"
                }}>
                  📁
                </span>
                
                <span style={{ 
                  fontWeight: "normal",
                  color: "#000",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1
                }}>
                  {name}
                </span>
              </div>
              
              {isOpen && hasSubfolders && (
                <div>
                  {renderFolderTree(value, folderPath, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Render file list (right pane)
  function renderFileList(files) {
    if (!files || files.length === 0) {
      return (
        <div style={{ 
          color: '#7f8c8d', 
          fontStyle: 'italic', 
          padding: '20px',
          textAlign: 'center'
        }}>
          No files in this folder
        </div>
      );
    }
    
    return files.map((file) => {
      const isFileSelected = selected.has(file.key);
      let fileType = "File";
      
      if (isVideoFile(file.key)) {
        fileType = "Video File";
      } else if (file.key.endsWith('.zip')) {
        fileType = "ZIP Archive";
      } else if (file.key.endsWith('.mp3') || file.key.endsWith('.wav')) {
        fileType = "Audio File";
      } else if (file.key.endsWith('.txt') || file.key.endsWith('.log')) {
        fileType = "Text Document";
      } else if (file.key.endsWith('.pdf')) {
        fileType = "PDF Document";
      } else if (file.key.endsWith('.jpg') || file.key.endsWith('.png') || file.key.endsWith('.gif')) {
        fileType = "Image";
      }
      
      let fileIcon = "📄";
      if (isVideoFile(file.key)) {
        fileIcon = "🎬";
      } else if (file.key.endsWith('.zip')) {
        fileIcon = "📦";
      } else if (file.key.endsWith('.mp3') || file.key.endsWith('.wav')) {
        fileIcon = "🎵";
      } else if (file.key.endsWith('.txt') || file.key.endsWith('.log')) {
        fileIcon = "📝";
      } else if (file.key.endsWith('.pdf')) {
        fileIcon = "📕";
      } else if (file.key.endsWith('.jpg') || file.key.endsWith('.png') || file.key.endsWith('.gif')) {
        fileIcon = "🖼️";
      }
      
      const fileName = file.key.split('/').pop();
      
      return (
        <div 
          key={file.key}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 150px 100px 80px",
            alignItems: "center",
            padding: "4px 8px",
            minHeight: "28px",
            cursor: "pointer",
            backgroundColor: isFileSelected ? "#e3f2fd" : "transparent",
            borderBottom: "1px solid #f0f0f0",
            fontSize: "13px"
          }}
          onClick={() => toggleSelect(file.key)}
          onMouseEnter={(e) => {
            if (!isFileSelected) {
              e.target.style.backgroundColor = "#f5f5f5";
            }
          }}
          onMouseLeave={(e) => {
            if (!isFileSelected) {
              e.target.style.backgroundColor = "transparent";
            }
          }}
        >
          <div style={{ 
            display: "flex", 
            alignItems: "center",
            overflow: "hidden"
          }}>
            <span style={{ 
              fontSize: "16px", 
              marginRight: "8px"
            }}>
              {fileIcon}
            </span>
            
            <span style={{ 
              fontWeight: "normal",
              color: "#000",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {fileName}
            </span>
          </div>
          
          <div style={{ 
            color: "#666",
            fontSize: "12px",
            textAlign: "left"
          }}>
            {file.last_modified ? new Date(file.last_modified).toLocaleDateString() : ""}
          </div>
          
          <div style={{ 
            color: "#666",
            fontSize: "12px",
            textAlign: "left"
          }}>
            {fileType}
          </div>
          
          <div style={{ 
            color: "#666",
            fontSize: "12px",
            textAlign: "right"
          }}>
            {file.size ? `${(file.size / 1024).toFixed(0)} KB` : ""}
          </div>
        </div>
      );
    });
  }

  async function fetchFiles(prefixOverride) {
    setLoading(true);
    setError(null);
    try {
      const currentPrefix = prefixOverride !== undefined ? prefixOverride : prefix;
      const url = `${apiBase}/list-videos?prefix=${encodeURIComponent(currentPrefix)}`;
      
      const res = await authenticatedFetch(url);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("🔍 DEBUG: API Error:", errorText);
        throw new Error(errorText);
      }
      
      const data = await res.json();
      
      const files = Array.isArray(data) ? data : data.files || [];
      setFiles(files);
    } catch (err) {
      console.error("fetchFiles error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchFiles(); }, [prefix]);

  function toggleSelect(key) {
    setSelected(s => {
      const copy = new Set(s);
      if (copy.has(key)) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  }

  async function handleAnalyze(list, analysisType = "complete") {
    const videoList = list.filter(f => isVideoFile(f.key));
    if (videoList.length === 0) {
      alert(t('noVideoFilesToAnalyze'));
      return;
    }

    const toolMap = {
      "blackframe": "detect_blackframes",
      "text": "rekognition_detect_text", 
      "complete": "analyze_video_complete"
    };

    const tool = toolMap[analysisType] || "analyze_video_complete";

    if (onAnalyze) {
      const videosWithTool = videoList.map(v => ({ 
        bucket: v.bucket, 
        key: v.key, 
        tool: tool
      }));
      return onAnalyze(videosWithTool);
    }

    const requestBody = { 
      videos: videoList.map(v => ({ 
        bucket: v.bucket, 
        key: v.key, 
        tool: tool
      })) 
    };

    try {
      const res = await authenticatedFetch(`${apiBase}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const jobIds = data.jobs ? data.jobs.map(job => job.job_id) : [];
      if (jobIds.length > 0) {
        const analysisNames = {
          "blackframe": t('blackframeAnalysis'),
          "text": t('textAnalysis'),
          "complete": t('completeAnalysis')
        };
        alert(`${analysisNames[analysisType]} ${t('startedFor')} ${videoList.length} ${t('videos')}!\nJob IDs: ${jobIds.join(", ")}`);
      } else {
        alert(t('analysisStartedNoJobIds'));
      }
    } catch (err) {
      console.error("Analyse-Fehler:", err);
      alert(t('analysisFailed') + ": " + err);
    }
  }

  async function handleUnzip(list) {
    const zipList = list.filter(f => isZipFile(f.key));
    if (zipList.length === 0) {
      alert(t('noZipFilesToUnpack'));
      return;
    }

    const requestBody = zipList.map(f => ({
      bucket: f.bucket,
      key: f.key
    }));
    try {
      const res = await authenticatedFetch(`${apiBase}/unzip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const jobIds = data.job_ids || [];
      if (jobIds.length > 0) {
        alert(`ZIP-Entpackung gestartet für ${zipList.length} Datei(en)!\nJob IDs: ${jobIds.join(", ")}`);
      } else {
        alert("ZIP-Entpackung gestartet, aber keine Job IDs erhalten.");
      }
    } catch (err) {
      console.error("Entpack-Fehler:", err);
      alert("ZIP-Entpackung fehlgeschlagen: " + err);
    }
  }

  return (
    <div className="s3panel" style={{ width: "100%" }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "16px",
        backgroundColor: "#2c3e50", 
        color: "white", 
        padding: "15px 20px", 
        borderRadius: "8px"
      }}>
        <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>
          📁 {t('s3Videos')}
        </h3>
        <button 
          onClick={() => setPanelOpen(o => !o)}
          style={{
            padding: "8px 16px",
            backgroundColor: panelOpen ? "#e74c3c" : "#27ae60",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {panelOpen ? `📊 ${t('showAnalyses')}` : `📁 ${t('showS3Files')}`}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input 
          value={prefix} 
          onChange={e => setPrefix(e.target.value)} 
          placeholder={t('enterPrefix')} 
          style={{ flex: 1 }} 
        />
        <button onClick={() => fetchFiles()}>{t('refresh')}</button>
        {prefix && (
          <button 
            onClick={() => {
              const parts = prefix.split('/').filter(p => p);
              if (parts.length > 1) {
                setPrefix(parts.slice(0, -1).join('/') + '/');
              } else {
                setPrefix('');
              }
            }}
            style={{ backgroundColor: "#ff9800", color: "white" }}
          >
            ← {t('back')}
          </button>
        )}
      </div>

      {loading && <div>{t('loading')}</div>}
      {error && <div style={{ color: "tomato" }}>{t('error')}: {error}</div>}

      {/* Two-pane file explorer layout */}
      <div style={{ 
        marginTop: "16px",
        backgroundColor: "#ffffff", 
        borderRadius: "4px",
        border: "1px solid #d0d7de",
        minHeight: "400px",
        overflow: "hidden",
        fontFamily: "Segoe UI, Arial, sans-serif",
        display: "flex"
      }}>
        {/* Left Pane - Folder Tree */}
        <div style={{
          width: "250px",
          borderRight: "1px solid #d0d7de",
          backgroundColor: "#f6f8fa"
        }}>
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid #d0d7de",
            fontSize: "12px",
            fontWeight: "600",
            color: "#656d76",
            backgroundColor: "#f6f8fa"
          }}>
            📁 Folders
          </div>
          <div style={{ 
            padding: "8px",
            maxHeight: "500px",
            overflowY: "auto",
            backgroundColor: "#ffffff"
          }}>
            {(() => {
              const treeData = buildTree(files);
              return renderFolderTree(treeData);
            })()}
          </div>
        </div>
        
        {/* Right Pane - File List */}
        <div style={{ flex: 1 }}>
          {/* Column Headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 150px 100px 80px",
            backgroundColor: "#f6f8fa",
            borderBottom: "1px solid #d0d7de",
            padding: "8px",
            fontSize: "12px",
            fontWeight: "600",
            color: "#656d76"
          }}>
            <div style={{ paddingLeft: "8px" }}>Name</div>
            <div>Date modified</div>
            <div>Type</div>
            <div style={{ textAlign: "right", paddingRight: "8px" }}>Size</div>
          </div>
          
          {/* File List Content */}
          <div style={{ 
            maxHeight: "500px",
            overflowY: "auto",
            backgroundColor: "#ffffff"
          }}>
            {(() => {
              const treeData = buildTree(files);
              const currentFiles = getCurrentFolderFiles(treeData, selectedFolder);
              return renderFileList(currentFiles);
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}