import React, { useEffect, useState } from "react";
import { useAuth } from "./Login";
import { useTranslation } from 'react-i18next';
import Spinner from "./Spinner";

export default function S3Files({ onAnalyze, panelOpen, setPanelOpen }) {
  const [expanded, setExpanded] = useState({});
  const [selectedFolder, setSelectedFolder] = useState(() => {
    // Load selected folder from localStorage on component mount
    return localStorage.getItem('s3Files_selectedFolder') || '';
  }); // Currently selected folder in tree
  const [allFolders, setAllFolders] = useState({ children: {}, files: [] }); // Complete folder tree
  const { authenticatedFetch } = useAuth();
  const { t } = useTranslation();
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
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
    
    // Create folder structure from S3 directory objects
    files.forEach(file => {
      if (isDirectory(file)) {
        // This is a folder
        const folderPath = file.key.endsWith('/') ? file.key.slice(0, -1) : file.key;
        const parts = folderPath.split('/').filter(Boolean);
        
        // Build nested folder structure
        let node = root;
        let currentPath = '';
        
        parts.forEach((part, index) => {
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
      }
    });
    
    // Assign files to their appropriate folders based on their path
    files.forEach(file => {
      if (!isDirectory(file)) {
        const parts = file.key.split('/').filter(Boolean);
        
        if (parts.length === 1) {
          // File in root
          root.files.push(file);
        } else {
          // File in a folder - find the correct folder node
          let node = root;
          
          // Navigate to the parent folder
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (node.children && node.children[part]) {
              node = node.children[part];
            } else {
              // Create missing folder structure
              if (!node.children[part]) {
                let folderPath = parts.slice(0, i + 1).join('/');
                node.children[part] = {
                  children: {},
                  files: [],
                  path: folderPath,
                  name: part,
                  isFolder: true
                };
              }
              node = node.children[part];
            }
          }
          
          // Add file to the folder
          if (node) {
            node.files.push(file);
          }
        }
      }
    });
    
    return root;
  }

  // Get ALL files and folders recursively to build complete tree
  async function loadAllFoldersRecursively() {
    try {
      
      // Start with root
      const allFiles = [];
      const foldersToCheck = [''];
      const processedFolders = new Set();
      
      while (foldersToCheck.length > 0) {
        const currentPrefix = foldersToCheck.shift();
        
        if (processedFolders.has(currentPrefix)) continue;
        processedFolders.add(currentPrefix);
        
        try {
          const url = `${apiBase}/list-videos?prefix=${encodeURIComponent(currentPrefix)}`;
          const res = await authenticatedFetch(url);
          if (!res.ok) continue;
          
          const data = await res.json();
          const folderFiles = Array.isArray(data) ? data : data.files || [];
          
          // Add all files to our collection
          folderFiles.forEach(file => {
            if (!allFiles.find(existing => existing.key === file.key)) {
              allFiles.push(file);
              
              // If this is a directory or file in a subfolder, discover new folders
              if (file.key.includes('/')) {
                const pathParts = file.key.split('/');
                
                // Add all parent folder paths to check
                for (let i = 1; i < pathParts.length; i++) {
                  const folderPath = pathParts.slice(0, i).join('/') + '/';
                  if (!processedFolders.has(folderPath) && !foldersToCheck.includes(folderPath)) {
                    foldersToCheck.push(folderPath);
                  }
                }
              }
            }
          });
          
        } catch (err) {
          // Error loading prefix - continue with next
        }
      }
      
      return buildTree(allFiles);
    } catch (err) {
      console.error("❌ Error loading all folders recursively:", err);
      return { children: {}, files: [] };
    }
  }

  // Handle folder click - this should update the prefix and fetch new files
  function handleFolderClick(folderPath) {
    setSelectedFolder(folderPath);
    // Save selected folder to localStorage
    localStorage.setItem('s3Files_selectedFolder', folderPath);
    setPrefix(folderPath + '/');
    fetchFiles(folderPath + '/');
    
    // Expand the folder tree to show the selected path
    expandFolderPath(folderPath);
  }

  // Function to expand the folder tree to show a specific path
  function expandFolderPath(folderPath) {
    if (!folderPath) return;
    
    // Split the path into segments
    const pathSegments = folderPath.split('/');
    const newExpanded = { ...expanded };
    
    // Expand each parent folder
    for (let i = 1; i <= pathSegments.length; i++) {
      const parentPath = pathSegments.slice(0, i).join('/');
      if (parentPath) {
        newExpanded[parentPath] = true;
      }
    }
    
    setExpanded(newExpanded);
  }

  // Function to refresh complete folder structure
  async function refreshCompleteStructure() {
    setLoading(true);
    
    try {
      // Reload all folders
      const newFolderStructure = await loadAllFoldersRecursively();
      setAllFolders(newFolderStructure);
      
      // Reload current folder files
      const currentPrefix = selectedFolder ? selectedFolder + '/' : '';
      await fetchFiles(currentPrefix);
      
      // Re-expand the current path
      if (selectedFolder) {
        expandFolderPath(selectedFolder);
      }
      
    } catch (err) {
      console.error('❌ Error refreshing structure:', err);
    } finally {
      setLoading(false);
    }
  }

  // Get files for the current selected folder
  function getCurrentFolderFiles(treeData, selectedFolder) {
    // Use ALL files from the current API response (including directories)
    const allApiFiles = files;
    
    // If we're in root (no selected folder), show root files
    if (!selectedFolder) {
      // For root, only show files that don't have "/" in their path
      const rootFiles = allApiFiles.filter(file => {
        const filePath = file.key;
        const isRootFile = !filePath.includes('/');
        return isRootFile;
      });
      return rootFiles;
    }
    
    // For folder navigation, show files AND subfolders that belong to this exact folder
    const expectedPrefix = selectedFolder + '/';
    
    // Get files that belong directly to this folder (not in subfolders)
    const currentFolderFiles = allApiFiles.filter(file => {
      const filePath = file.key;
      // File must start with the folder prefix and not be in a subfolder
      if (!filePath.startsWith(expectedPrefix)) return false;
      
      const relativePath = filePath.substring(expectedPrefix.length);
      const belongsToFolder = !relativePath.includes('/') && relativePath.length > 0;
      return belongsToFolder;
    });
    
    // Get subfolders by looking for files that have additional path segments
    const subfolderPaths = new Set();
    allApiFiles.forEach(file => {
      const filePath = file.key;
      if (filePath.startsWith(expectedPrefix)) {
        const relativePath = filePath.substring(expectedPrefix.length);
        const pathParts = relativePath.split('/');
        if (pathParts.length > 1 && pathParts[0]) {
          // This file is in a subfolder
          subfolderPaths.add(pathParts[0]);
        }
      }
    });
    
    // Convert subfolder paths to folder objects
    const subfolders = Array.from(subfolderPaths).map(folderName => ({
      key: expectedPrefix + folderName,
      name: folderName,
      is_directory: true,
      size: 0,
      last_modified: null
    }));
    
    // Return subfolders first, then files (like Windows Explorer)
    return [...subfolders, ...currentFolderFiles];
  }

  // Render folder tree (left pane) - now using complete tree data
  function renderFolderTree(node, parentKey = "", level = 0) {
    if (!node || !node.children || Object.keys(node.children).length === 0) {
      if (level === 0) {
        return (
          <div style={{ 
            color: 'white', 
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
          
          // Check if this folder has subfolders - now we have complete data
          const hasSubfolders = value.children && Object.keys(value.children).length > 0;
          
          // Simple logic: show plus if there are actual subfolders in the complete tree
          const mightHaveContent = hasSubfolders;
          
          return (
            <div key={folderPath}>
              <div 
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "3px 6px",
                  marginLeft: level * 12,
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#3498db" : "transparent",
                  borderRadius: "3px",
                  fontSize: "13px",
                  minHeight: "20px",
                  color: "white"
                }}
                onClick={() => {
                  // Only select the folder, don't expand/collapse
                  handleFolderClick(folderPath);
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#34495e";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {mightHaveContent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
                    }}
                    style={{
                      background: "none",
                      border: "1px solid #fff",
                      cursor: "pointer",
                      padding: "0",
                      marginRight: "6px",
                      fontSize: "10px",
                      color: "white",
                      width: "14px",
                      height: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "2px"
                    }}
                  >
                    {isOpen ? "−" : "+"}
                  </button>
                )}
                
                {!mightHaveContent && (
                  <div style={{ width: "20px" }}></div>
                )}
                
                <span style={{ 
                  fontSize: "14px", 
                  marginRight: "6px"
                }}>
                  📁
                </span>
                
                <span style={{ 
                  fontWeight: "normal",
                  color: "white",
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
          color: 'white', 
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
      const isFolder = isDirectory(file);
      
      let fileType = "File";
      let fileIcon = "📄";
      
      if (isFolder) {
        fileType = "Folder";
        fileIcon = "📁";
      } else if (isVideoFile(file.key)) {
        fileType = "Video File";
        fileIcon = "🎬";
      } else if (file.key.endsWith('.zip')) {
        fileType = "ZIP Archive";
        fileIcon = "📦";
      } else if (file.key.endsWith('.mp3') || file.key.endsWith('.wav')) {
        fileType = "Audio File";
        fileIcon = "🎵";
      } else if (file.key.endsWith('.txt') || file.key.endsWith('.log')) {
        fileType = "Text Document";
        fileIcon = "📝";
      } else if (file.key.endsWith('.pdf')) {
        fileType = "PDF Document";
        fileIcon = "📕";
      } else if (file.key.endsWith('.jpg') || file.key.endsWith('.png') || file.key.endsWith('.gif')) {
        fileType = "Image";
        fileIcon = "�️";
      }
      
      // Extract clean name from the key
      let displayName;
      if (isFolder) {
        displayName = file.name || file.key.replace(/\/$/, '').split('/').pop();
      } else {
        displayName = file.key.split('/').pop();
      }
      
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
            backgroundColor: isFileSelected ? "#3498db" : "transparent",
            borderBottom: "1px solid #34495e",
            fontSize: "13px",
            color: "white"
          }}
          onClick={() => {
            if (isFolder) {
              // Navigate to this folder
              const folderPath = file.key.endsWith('/') ? file.key.slice(0, -1) : file.key;
              handleFolderClick(folderPath);
            } else {
              // Select this file
              toggleSelect(file.key);
            }
          }}
          onMouseEnter={(e) => {
            if (!isFileSelected) {
              e.currentTarget.style.backgroundColor = "#34495e";
            }
          }}
          onMouseLeave={(e) => {
            if (!isFileSelected) {
              e.currentTarget.style.backgroundColor = "transparent";
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
              fontWeight: isFolder ? "500" : "normal",
              color: isFolder ? "#87CEEB" : "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {displayName}
            </span>
          </div>
          
          <div style={{ 
            color: "white",
            fontSize: "12px",
            textAlign: "left"
          }}>
            {!isFolder && file.last_modified ? new Date(file.last_modified).toLocaleDateString() : ""}
          </div>
          
          <div style={{ 
            color: "white",
            fontSize: "12px",
            textAlign: "left"
          }}>
            {fileType}
          </div>
          
          <div style={{ 
            color: "white",
            fontSize: "12px",
            textAlign: "right"
          }}>
            {!isFolder && file.size ? `${(file.size / 1024).toFixed(0)} KB` : ""}
          </div>
        </div>
      );
    });
  }

  async function fetchFiles(prefixOverride) {
    setLoading(true);
    setError(null);
    
    // CRITICAL: Clear the old files immediately to prevent showing cached data
    setFiles([]);
    
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
      
      const freshFiles = Array.isArray(data) ? data : data.files || [];
      
      // Debug: Log ALL file types to understand what's in this folder
      const allFilesByType = freshFiles.reduce((acc, file) => {
        const extension = file.key.split('.').pop()?.toLowerCase() || 'no-extension';
        acc[extension] = (acc[extension] || 0) + 1;
        return acc;
      }, {});
      
      // Set the fresh files - this will trigger a re-render with correct data
      setFiles(freshFiles);
    } catch (err) {
      console.error("fetchFiles error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // Load everything on component mount
  useEffect(() => {
    // Set loading true at start
    setLoading(true);
    
    // Load ALL folders recursively for complete tree (only once)
    loadAllFoldersRecursively().then(folderData => {
      setAllFolders(folderData);
      setLoading(false); // Done loading folder structure
    }).catch(error => {
      console.error("Error loading folders:", error);
      setLoading(false); // Also stop loading on error
    });
    
    // Load saved folder and fetch initial files
    const savedFolder = localStorage.getItem('s3Files_selectedFolder');
    if (savedFolder) {
      setPrefix(savedFolder + '/');
      fetchFiles(savedFolder + '/');
      // Expand the path in the tree
      expandFolderPath(savedFolder);
    } else {
      // Load root files
      fetchFiles('');
    }
  }, []); // Run only once on mount

  // Optional: Auto-refresh every 5 minutes (can be disabled)
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    const intervalId = setInterval(() => {
      refreshCompleteStructure();
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

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
      "labels": "rekognition_detect_labels",
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
          "labels": "Label-Erkennung",
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
        <button 
          onClick={refreshCompleteStructure}
          style={{ backgroundColor: "#4CAF50", color: "white" }}
          title="Aktualisiert die komplette Ordnerstruktur"
        >
          🔄 Struktur
        </button>
      </div>

      {loading && <div>{t('loading')}</div>}
      {error && <div style={{ color: "tomato" }}>{t('error')}: {error}</div>}

      {/* Action buttons */}
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        marginTop: "12px", 
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: "white" }}>
          {t('filesSelected', { count: selected.size })}:
        </span>
        
        <button 
          onClick={() => handleAnalyze(Array.from(selected).map(key => files.find(f => f.key === key)).filter(Boolean), "complete")}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#3498db" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          🎬 {t('completeAnalysis')}
        </button>
        
        <button 
          onClick={() => handleAnalyze(Array.from(selected).map(key => files.find(f => f.key === key)).filter(Boolean), "blackframe")}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#e74c3c" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          ⚫ {t('blackframeAnalysis')}
        </button>
        
        <button 
          onClick={() => handleAnalyze(Array.from(selected).map(key => files.find(f => f.key === key)).filter(Boolean), "text")}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#f39c12" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          📝 {t('textAnalysis')}
        </button>
        
        <button 
          onClick={() => handleAnalyze(Array.from(selected).map(key => files.find(f => f.key === key)).filter(Boolean), "labels")}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#9b59b6" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          🏷️ Label-Erkennung
        </button>
        
        <button 
          onClick={() => handleUnzip(Array.from(selected).map(key => files.find(f => f.key === key)).filter(Boolean))}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#27ae60" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          📦 {t('unzipFiles')}
        </button>
        
        <button 
          onClick={() => setSelected(new Set())}
          disabled={selected.size === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: selected.size > 0 ? "#95a5a6" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          ❌ {t('clearSelection')}
        </button>
        
        <button 
          onClick={() => {
            const allVideoFiles = files.filter(f => !isDirectory(f));
            setSelected(new Set(allVideoFiles.map(f => f.key)));
          }}
          disabled={files.length === 0}
          style={{
            padding: "6px 12px",
            backgroundColor: files.length > 0 ? "#9b59b6" : "#bdc3c7",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: files.length > 0 ? "pointer" : "not-allowed",
            fontSize: "12px"
          }}
        >
          ✅ {t('selectAll')}
        </button>
      </div>

      {/* Two-pane file explorer layout */}
      <div style={{ 
        marginTop: "16px",
        backgroundColor: "#2c3e50", 
        borderRadius: "4px",
        border: "1px solid #34495e",
        minHeight: "400px",
        overflow: "hidden",
        fontFamily: "Segoe UI, Arial, sans-serif",
        display: "flex"
      }}>
        {/* Left Pane - Folder Tree */}
        <div style={{
          width: "250px",
          borderRight: "1px solid #34495e",
          backgroundColor: "#34495e"
        }}>
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid #34495e",
            fontSize: "12px",
            fontWeight: "600",
            color: "white",
            backgroundColor: "#34495e"
          }}>
            📁 Folders
          </div>
          {/* Home Button */}
          <div style={{ 
            padding: "4px 8px",
            borderBottom: "1px solid #34495e",
            backgroundColor: "#2c3e50"
          }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                border: "none",
                backgroundColor: selectedFolder === '' ? "#3498db" : "transparent",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                borderRadius: "3px",
                width: "100%",
                textAlign: "left"
              }}
              onClick={() => {
                setSelectedFolder('');
                localStorage.removeItem('s3Files_selectedFolder');
                setPrefix('');
                fetchFiles('');
              }}
            >
              🏠 Root
            </button>
          </div>
          <div style={{ 
            padding: "8px",
            maxHeight: "500px",
            overflowY: "auto",
            backgroundColor: "#2c3e50"
          }}>
            {loading ? (
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                height: "200px",
                color: "white"
              }}>
                <div className="lds-dual-ring"></div>
              </div>
            ) : (
              renderFolderTree(allFolders)
            )}
          </div>
        </div>
        
        {/* Right Pane - File List */}
        <div style={{ flex: 1 }}>
          {/* Column Headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 150px 100px 80px",
            backgroundColor: "#34495e",
            borderBottom: "1px solid #34495e",
            padding: "8px",
            fontSize: "12px",
            fontWeight: "600",
            color: "white"
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
            backgroundColor: "#2c3e50"
          }}>
            {(() => {
              const currentFiles = getCurrentFolderFiles(allFolders, selectedFolder);
              
              // Show a helpful message if no folder is selected but files exist
              if (!selectedFolder && files.length > 0) {
                const rootFiles = files.filter(file => !isDirectory(file));
                const videoFiles = rootFiles.filter(file => isVideoFile(file.key));
                
                return (
                  <div>
                    <div style={{
                      padding: "8px 12px",
                      backgroundColor: "#34495e",
                      borderBottom: "1px solid #34495e",
                      fontSize: "12px",
                      color: "white"
                    }}>
                      📁 Root Directory - {rootFiles.length} files ({videoFiles.length} videos)
                    </div>
                    {renderFileList(currentFiles)}
                  </div>
                );
              }
              
              return renderFileList(currentFiles);
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}