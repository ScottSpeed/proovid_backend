import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation & General
      "welcome": "Welcome",
      "dashboard": "Dashboard",
      "loading": "Loading...",
      "error": "Error",
      "success": "Success",
      "warning": "Warning",
      "info": "Info",
      "confirm": "Confirm",
      "cancel": "Cancel",
      "save": "Save",
      "delete": "Delete",
      "edit": "Edit",
      "close": "Close",
      "back": "Back",
      "next": "Next",
      "previous": "Previous",
      "search": "Search",
      "filter": "Filter",
      "sort": "Sort",
      "refresh": "Refresh",
      
      // Authentication
      "login": "Login",
      "logout": "Logout",
      "username": "Username",
      "password": "Password",
      "email": "Email",
      "forgotPassword": "Forgot Password?",
      "rememberMe": "Remember Me",
      "signIn": "Sign In",
      "signUp": "Sign Up",
      "createAccount": "Create Account",
      
      // File Management
      "files": "Files",
      "upload": "Upload",
      "download": "Download",
      "fileName": "File Name",
      "fileSize": "File Size",
      "dateModified": "Date Modified",
      "fileType": "File Type",
      "selectFile": "Select File",
      "selectFiles": "Select Files",
      "selectAll": "Select All",
      "deselectAll": "Deselect All",
      "noFilesSelected": "No files selected",
      "filesSelected": "{{count}} files selected",
      "uploadFile": "Upload File",
      "uploadFiles": "Upload Files",
      "dragDropFiles": "Drag & drop files here, or click to select",
      "fileUploaded": "File uploaded successfully",
      "uploadFailed": "Upload failed",
      "deleteFile": "Delete File",
      "deleteFiles": "Delete Files",
      "confirmDeleteFile": "Are you sure you want to delete this file?",
      "confirmDeleteFiles": "Are you sure you want to delete {{count}} files?",
      "fileDeleted": "File deleted successfully",
      "filesDeleted": "Files deleted successfully",
      "deleteFailed": "Delete failed",
      
      // Video Analysis
      "videoAnalysis": "Video Analysis",
      "analyzeVideo": "Analyze Video",
      "analyzeVideos": "Analyze Videos",
      "analyzeSelectedVideos": "Analyze Selected Videos",
      "videoAnalyzed": "Video analyzed successfully",
      "analysisInProgress": "Analysis in progress...",
      "analysisFailed": "Analysis failed",
      "analysisResults": "Analysis Results",
      "noAnalysisResults": "No analysis results available",
      "analysisHistory": "Analysis History",
      "analysisStatus": "Analysis Status",
      "pending": "Pending",
      "processing": "Processing",
      "completed": "Completed",
      "failed": "Failed",
      "duration": "Duration",
      "resolution": "Resolution",
      "frameRate": "Frame Rate",
      "bitrate": "Bitrate",
      "codec": "Codec",
      
      // Analysis Types
      "blackframeAnalysis": "Blackframe Analysis",
      "textAnalysis": "Text Analysis", 
      "completeAnalysis": "Complete Analysis",
      "noVideoFilesToAnalyze": "No video files found for analysis!",
      "startedFor": "started for",
      "videos": "video(s)",
      "analysisStartedNoJobIds": "Analysis started but no Job IDs received.",
      
      // ZIP Processing
      "zipProcessing": "ZIP Processing",
      "unzipFile": "Unzip File",
      "unzipFiles": "Unzip Files",
      "unzipSelectedFiles": "Unzip Selected Files",
      "zipFileDetected": "ZIP file detected",
      "zipFilesDetected": "ZIP files detected",
      "unzipInProgress": "Unzipping in progress...",
      "unzipCompleted": "Unzipping completed successfully",
      "unzipFailed": "Unzipping failed",
      "extractedFiles": "Extracted Files",
      "noZipFiles": "No ZIP files available",
      "zipProcessingHistory": "ZIP Processing History",
      "noZipFilesToUnpack": "No ZIP files found for unpacking!",
      "zipUnpackingStarted": "ZIP unpacking started for",
      "zipUnpackingStartedNoJobIds": "ZIP unpacking started but no Job IDs received.",
      "files": "file(s)",
      "s3Videos": "S3 Videos",
      "showAnalyses": "Show Analyses",
      "showS3Files": "Show S3 Files",
      "enterPrefix": "Enter prefix (e.g. G26M/)",
      "blackframe": "Blackframe",
      "noVideoFilesFound": "No video files found!",
      "selectedVideos": "Selected Videos",
      "noVideoFilesSelected": "No video files selected",
      "selectedZipFiles": "Selected ZIP Files", 
      "noZipFilesSelected": "No ZIP files selected",
      "unknownStatus": "unknown",
      "ago": "ago",
      "min": "min",
      "hours": "h", 
      "days": "d",
      "dashboardOverview": "Overview of all video analyses and jobs",
      "jobs": "Jobs",
      "searchFilenameOrJobId": "Search by filename or Job ID",
      "status": "Status",
      "created": "Created",
      "actions": "Actions",
      "recently": "Recently",
      
      // Job Status
      "jobStatus": "Job Status",
      "jobHistory": "Job History",
      "jobId": "Job ID",
      "jobType": "Job Type",
      "startTime": "Start Time",
      "endTime": "End Time",
      "executionTime": "Execution Time",
      "jobDetails": "Job Details",
      "viewJob": "View Job",
      "retryJob": "Retry Job",
      "cancelJob": "Cancel Job",
      
      // Settings
      "settings": "Settings",
      "preferences": "Preferences",
      "language": "Language",
      "theme": "Theme",
      "notifications": "Notifications",
      "privacy": "Privacy",
      "security": "Security",
      "account": "Account",
      "profile": "Profile",
      
      // Language Switcher
      "languageSwitch": "Language",
      "german": "Deutsch",
      "english": "English",
      "switchToGerman": "Switch to German",
      "switchToEnglish": "Switch to English",
      
      // Error Messages
      "errorOccurred": "An error occurred",
      "networkError": "Network error",
      "serverError": "Server error",
      "unauthorizedError": "Unauthorized access",
      "forbiddenError": "Access forbidden",
      "notFoundError": "Not found",
      "validationError": "Validation error",
      "timeoutError": "Request timeout",
      "unknownError": "Unknown error",
      
      // Success Messages
      "operationSuccessful": "Operation completed successfully",
      "saveSuccessful": "Saved successfully",
      "updateSuccessful": "Updated successfully",
      "deleteSuccessful": "Deleted successfully",
      "uploadSuccessful": "Uploaded successfully",
      
      // Validation Messages
      "fieldRequired": "This field is required",
      "invalidEmail": "Invalid email address",
      "passwordTooShort": "Password is too short",
      "passwordsNotMatch": "Passwords do not match",
      "invalidFileType": "Invalid file type",
      "fileTooLarge": "File is too large",
      "maxFilesExceeded": "Maximum number of files exceeded",
      
      // Date/Time
      "today": "Today",
      "yesterday": "Yesterday",
      "thisWeek": "This Week",
      "lastWeek": "Last Week",
      "thisMonth": "This Month",
      "lastMonth": "Last Month",
      "dateFormat": "MM/DD/YYYY",
      "timeFormat": "HH:mm",
      "dateTimeFormat": "MM/DD/YYYY HH:mm",
      
      // Pagination
      "page": "Page",
      "of": "of",
      "itemsPerPage": "Items per page",
      "showing": "Showing",
      "to": "to",
      "entries": "entries",
      "noData": "No data available",
      "noResults": "No results found",
      
      // Actions
      "view": "View",
      "download": "Download",
      "share": "Share",
      "copy": "Copy",
      "paste": "Paste",
      "cut": "Cut",
      "undo": "Undo",
      "redo": "Redo",
      "print": "Print",
      "export": "Export",
      "import": "Import",
      
      // Video Player
      "videoPlayer": "Video Player",
      "selectVideo": "Select Video",
      "noVideoSelected": "No video selected",
      "playTwoVideos": "Play two videos simultaneously and compare them",
      "video1": "Video 1",
      "video2": "Video 2",
      "play": "Play",
      "pause": "Pause", 
      "stop": "Stop",
      "volume": "Volume",
      "noFilesFound": "No files found",
      "folder": "Folder",
      "pleaseWait": "Please wait...",
      "bucket": "Bucket",
      "key": "Key",
      
      // Results Page
      "resultsPage": {
        "title": "Analysis Results",
        "loadingResults": "Analysis results are loading...",
        "errorLoadingResults": "Error loading results",
        "backToDashboard": "← Back to Dashboard",
        "noResultsAvailable": "No results available",
        "noResultsMessage": "No analysis results are available for this job yet.",
        "rawDataShow": "🔧 Show raw data",
        "jobIdShort": "Job ID:",
        
        // Video Information
        "videoInfo": {
          "title": "🎬 Video Information",
          "filename": "Filename",
          "totalFrames": "Total Frames", 
          "estimatedDuration": "Duration (estimated)",
          "duration": "Duration",
          "s3Bucket": "S3 Bucket",
          "frames": "Frames"
        },
        
        // Analysis Summary
        "analysisSummary": {
          "title": "📊 Analysis Summary",
          "blackframesFound": "Blackframes found",
          "textsDetected": "Texts detected",
          "analysisType": "Analysis Type",
          "complete": "complete",
          "partial": "partial",
          "blackframes_only": "blackframes only"
        },
        
        // Blackframes Analysis
        "blackframes": {
          "title": "🎞️ Blackframes Analysis", 
          "pieChartLabel": "Blackframes found",
          "detailsTitle": "📋 Blackframes Details",
          "detailsCount": "Frames",
          "noBlackframesFound": "No blackframes found",
          "frameNumber": "Frame",
          "timeSeconds": "Time (s)",
          "brightness": "Brightness",
          "status": "Status",
          "fullBlack": "FULL BLACK",
          "dark": "DARK",
          "ofFrames": "of {{total}}"
        },
        
        // Text Detection
        "textDetection": {
          "title": "🔤 Text Recognition",
          "detectedTexts": "📝 Detected Texts",
          "noTextsDetected": "No texts detected",
          "noTextsMessage": "No readable texts were found in this video.",
          "noTextsReasons": "Possible reasons: Poor quality, no texts in video, or short display duration.",
          "confidence": "{{confidence}}%",
          "time": "⏱ Time: {{time}}s",
          "frame": "🎬 Frame: {{frame}}",
          "position": "📍 Position: {{position}}",
          "available": "Available",
          "notAvailable": "N/A"
        },
        
        // Error States
        "errorTitle": "⚠️ Error loading results",
        "noResults": "📊 No results available"
      }
    }
  },
  de: {
    translation: {
      // Navigation & General
      "welcome": "Willkommen",
      "dashboard": "Dashboard",
      "loading": "Laden...",
      "error": "Fehler",
      "success": "Erfolg",
      "warning": "Warnung",
      "info": "Info",
      "confirm": "Bestätigen",
      "cancel": "Abbrechen",
      "save": "Speichern",
      "delete": "Löschen",
      "edit": "Bearbeiten",
      "close": "Schließen",
      "back": "Zurück",
      "next": "Weiter",
      "previous": "Vorherige",
      "search": "Suchen",
      "filter": "Filter",
      "sort": "Sortieren",
      "refresh": "Aktualisieren",
      
      // Authentication
      "login": "Anmelden",
      "logout": "Abmelden",
      "username": "Benutzername",
      "password": "Passwort",
      "email": "E-Mail",
      "forgotPassword": "Passwort vergessen?",
      "rememberMe": "Angemeldet bleiben",
      "signIn": "Anmelden",
      "signUp": "Registrieren",
      "createAccount": "Konto erstellen",
      
      // File Management
      "files": "Dateien",
      "upload": "Hochladen",
      "download": "Herunterladen",
      "fileName": "Dateiname",
      "fileSize": "Dateigröße",
      "dateModified": "Änderungsdatum",
      "fileType": "Dateityp",
      "selectFile": "Datei auswählen",
      "selectFiles": "Dateien auswählen",
      "selectAll": "Alle auswählen",
      "deselectAll": "Alle abwählen",
      "noFilesSelected": "Keine Dateien ausgewählt",
      "filesSelected": "{{count}} Dateien ausgewählt",
      "uploadFile": "Datei hochladen",
      "uploadFiles": "Dateien hochladen",
      "dragDropFiles": "Dateien hierher ziehen oder klicken zum Auswählen",
      "fileUploaded": "Datei erfolgreich hochgeladen",
      "uploadFailed": "Upload fehlgeschlagen",
      "deleteFile": "Datei löschen",
      "deleteFiles": "Dateien löschen",
      "confirmDeleteFile": "Sind Sie sicher, dass Sie diese Datei löschen möchten?",
      "confirmDeleteFiles": "Sind Sie sicher, dass Sie {{count}} Dateien löschen möchten?",
      "fileDeleted": "Datei erfolgreich gelöscht",
      "filesDeleted": "Dateien erfolgreich gelöscht",
      "deleteFailed": "Löschen fehlgeschlagen",
      
      // Video Analysis
      "videoAnalysis": "Video-Analyse",
      "analyzeVideo": "Video analysieren",
      "analyzeVideos": "Videos analysieren",
      "analyzeSelectedVideos": "Ausgewählte Videos analysieren",
      "videoAnalyzed": "Video erfolgreich analysiert",
      "analysisInProgress": "Analyse läuft...",
      "analysisFailed": "Analyse fehlgeschlagen",
      "analysisResults": "Analyseergebnisse",
      "noAnalysisResults": "Keine Analyseergebnisse verfügbar",
      "analysisHistory": "Analyse-Verlauf",
      "analysisStatus": "Analyse-Status",
      "pending": "Ausstehend",
      "processing": "Verarbeitung",
      "completed": "Abgeschlossen",
      "failed": "Fehlgeschlagen",
      "duration": "Dauer",
      "resolution": "Auflösung",
      "frameRate": "Bildrate",
      "bitrate": "Bitrate",
      "codec": "Codec",
      
      // Analysis Types
      "blackframeAnalysis": "Blackframe-Analyse",
      "textAnalysis": "Text-Analyse", 
      "completeAnalysis": "Vollständige Analyse",
      "noVideoFilesToAnalyze": "Keine Video-Dateien zum Analysieren gefunden!",
      "startedFor": "gestartet für",
      "videos": "Video(s)",
      "analysisStartedNoJobIds": "Analyse gestartet, aber keine Job IDs erhalten.",
      
      // ZIP Processing
      "zipProcessing": "ZIP-Verarbeitung",
      "unzipFile": "Datei entpacken",
      "unzipFiles": "Dateien entpacken",
      "unzipSelectedFiles": "Ausgewählte Dateien entpacken",
      "zipFileDetected": "ZIP-Datei erkannt",
      "zipFilesDetected": "ZIP-Dateien erkannt",
      "unzipInProgress": "Entpacken läuft...",
      "unzipCompleted": "Entpacken erfolgreich abgeschlossen",
      "unzipFailed": "Entpacken fehlgeschlagen",
      "extractedFiles": "Entpackte Dateien",
      "noZipFiles": "Keine ZIP-Dateien verfügbar",
      "zipProcessingHistory": "ZIP-Verarbeitungs-Verlauf",
      "noZipFilesToUnpack": "Keine ZIP-Dateien zum Entpacken gefunden!",
      "zipUnpackingStarted": "ZIP-Entpackung gestartet für",
      "zipUnpackingStartedNoJobIds": "ZIP-Entpackung gestartet, aber keine Job IDs erhalten.",
      "files": "Datei(en)",
      "s3Videos": "S3 Videos",
      "showAnalyses": "Analysen anzeigen", 
      "showS3Files": "S3 Files anzeigen",
      "enterPrefix": "Prefix eingeben (z.B. G26M/)",
      "blackframe": "Blackframe", 
      "noVideoFilesFound": "Keine Video-Dateien gefunden!",
      "selectedVideos": "Ausgewählte Videos",
      "noVideoFilesSelected": "Keine Video-Dateien ausgewählt",
      "selectedZipFiles": "Ausgewählte ZIP-Dateien", 
      "noZipFilesSelected": "Keine ZIP-Dateien ausgewählt",
      "unknownStatus": "unbekannt",
      "ago": "vor",
      "min": "Min",
      "hours": "h", 
      "days": "d",
      "dashboardOverview": "Übersicht über alle Video-Analysen und Jobs",
      "jobs": "Jobs", 
      "searchFilenameOrJobId": "Suche nach Dateiname oder Job ID",
      "status": "Status",
      "created": "Erstellt",
      "actions": "Aktionen",
      "recently": "vor kurzem",      // Job Status
      "jobStatus": "Job-Status",
      "jobHistory": "Job-Verlauf",
      "jobId": "Job-ID",
      "jobType": "Job-Typ",
      "startTime": "Startzeit",
      "endTime": "Endzeit",
      "executionTime": "Ausführungszeit",
      "jobDetails": "Job-Details",
      "viewJob": "Job anzeigen",
      "retryJob": "Job wiederholen",
      "cancelJob": "Job abbrechen",
      
      // Settings
      "settings": "Einstellungen",
      "preferences": "Einstellungen",
      "language": "Sprache",
      "theme": "Design",
      "notifications": "Benachrichtigungen",
      "privacy": "Datenschutz",
      "security": "Sicherheit",
      "account": "Konto",
      "profile": "Profil",
      
      // Language Switcher
      "languageSwitch": "Sprache",
      "german": "Deutsch",
      "english": "English",
      "switchToGerman": "Zu Deutsch wechseln",
      "switchToEnglish": "Zu Englisch wechseln",
      
      // Error Messages
      "errorOccurred": "Ein Fehler ist aufgetreten",
      "networkError": "Netzwerkfehler",
      "serverError": "Serverfehler",
      "unauthorizedError": "Nicht autorisiert",
      "forbiddenError": "Zugriff verweigert",
      "notFoundError": "Nicht gefunden",
      "validationError": "Validierungsfehler",
      "timeoutError": "Zeitüberschreitung",
      "unknownError": "Unbekannter Fehler",
      
      // Success Messages
      "operationSuccessful": "Vorgang erfolgreich abgeschlossen",
      "saveSuccessful": "Erfolgreich gespeichert",
      "updateSuccessful": "Erfolgreich aktualisiert",
      "deleteSuccessful": "Erfolgreich gelöscht",
      "uploadSuccessful": "Erfolgreich hochgeladen",
      
      // Validation Messages
      "fieldRequired": "Dieses Feld ist erforderlich",
      "invalidEmail": "Ungültige E-Mail-Adresse",
      "passwordTooShort": "Passwort ist zu kurz",
      "passwordsNotMatch": "Passwörter stimmen nicht überein",
      "invalidFileType": "Ungültiger Dateityp",
      "fileTooLarge": "Datei ist zu groß",
      "maxFilesExceeded": "Maximale Anzahl von Dateien überschritten",
      
      // Date/Time
      "today": "Heute",
      "yesterday": "Gestern",
      "thisWeek": "Diese Woche",
      "lastWeek": "Letzte Woche",
      "thisMonth": "Dieser Monat",
      "lastMonth": "Letzter Monat",
      "dateFormat": "DD.MM.YYYY",
      "timeFormat": "HH:mm",
      "dateTimeFormat": "DD.MM.YYYY HH:mm",
      
      // Pagination
      "page": "Seite",
      "of": "von",
      "itemsPerPage": "Einträge pro Seite",
      "showing": "Anzeige",
      "to": "bis",
      "entries": "Einträge",
      "noData": "Keine Daten verfügbar",
      "noResults": "Keine Ergebnisse gefunden",
      
      // Actions
      "view": "Anzeigen",
      "download": "Herunterladen",
      "share": "Teilen",
      "copy": "Kopieren",
      "paste": "Einfügen",
      "cut": "Ausschneiden",
      "undo": "Rückgängig",
      "redo": "Wiederholen",
      "print": "Drucken",
      "export": "Exportieren",
      "import": "Importieren",
      
      // Video Player
      "videoPlayer": "Video Player",
      "selectVideo": "Video wählen",
      "noVideoSelected": "Kein Video ausgewählt",
      "playTwoVideos": "Spielen Sie zwei Videos gleichzeitig ab und vergleichen Sie diese",
      "video1": "Video 1",
      "video2": "Video 2",
      "play": "Play",
      "pause": "Pause", 
      "stop": "Stop",
      "volume": "Lautstärke",
      "noFilesFound": "Keine Dateien gefunden",
      "folder": "Ordner",
      "pleaseWait": "Bitte warten...",
      "bucket": "Bucket",
      "key": "Key",
      
      // Results Page
      "resultsPage": {
        "title": "Analyseergebnisse",
        "loadingResults": "Analyseergebnisse werden geladen...",
        "errorLoadingResults": "Fehler beim Laden der Ergebnisse",
        "backToDashboard": "← Zurück zum Dashboard",
        "noResultsAvailable": "Keine Ergebnisse verfügbar",
        "noResultsMessage": "Für diesen Job sind noch keine Analyseergebnisse verfügbar.",
        "rawDataShow": "🔧 Rohdaten anzeigen",
        "jobIdShort": "Job ID:",
        
        // Video Information
        "videoInfo": {
          "title": "🎬 Video Information",
          "filename": "Dateiname",
          "totalFrames": "Gesamte Frames", 
          "estimatedDuration": "Dauer (geschätzt)",
          "duration": "Dauer",
          "s3Bucket": "S3 Bucket",
          "frames": "Frames"
        },
        
        // Analysis Summary
        "analysisSummary": {
          "title": "📊 Analyse-Zusammenfassung",
          "blackframesFound": "Blackframes gefunden",
          "textsDetected": "Texte erkannt",
          "analysisType": "Analyse-Typ",
          "complete": "vollständig",
          "partial": "teilweise",
          "blackframes_only": "Nur blackframes"
        },
        
        // Blackframes Analysis
        "blackframes": {
          "title": "🎞️ Blackframes Analyse", 
          "pieChartLabel": "Blackframes gefunden",
          "detailsTitle": "📋 Blackframes Details",
          "detailsCount": "Frames",
          "noBlackframesFound": "Keine Blackframes gefunden",
          "frameNumber": "Frame",
          "timeSeconds": "Zeit (s)",
          "brightness": "Helligkeit",
          "status": "Status",
          "fullBlack": "VOLLSCHWARZ",
          "dark": "DUNKEL",
          "ofFrames": "von {{total}}"
        },
        
        // Text Detection
        "textDetection": {
          "title": "🔤 Text Erkennung",
          "detectedTexts": "📝 Erkannte Texte",
          "noTextsDetected": "Keine Texte erkannt",
          "noTextsMessage": "In diesem Video wurden keine lesbaren Texte gefunden.",
          "noTextsReasons": "Mögliche Gründe: Schlechte Qualität, keine Texte im Video, oder kurze Anzeigedauer.",
          "confidence": "{{confidence}}%",
          "time": "⏱ Zeit: {{time}}s",
          "frame": "🎬 Frame: {{frame}}",
          "position": "📍 Position: {{position}}",
          "available": "Verfügbar",
          "notAvailable": "N/A"
        },
        
        // Error States
        "errorTitle": "⚠️ Fehler beim Laden der Ergebnisse",
        "noResults": "📊 Keine Ergebnisse verfügbar"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'de', // Default to German
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false // React already does escaping
    }
  });

export default i18n;