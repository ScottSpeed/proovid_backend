import React, { useEffect, useState } from 'react'

// Kleiner Spinner für einzelne Jobs
function SmallSpinner() {
  return (
    <span className="job-spinner" title="Wird analysiert...">
      <svg width="18" height="18" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#6ee7b7" strokeWidth="5" strokeDasharray="31.4 31.4" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>
    </span>
  )
}

export default function JobList({ jobs, panelOpen, onUpdate }) {
  if (!panelOpen) return null;
  const [statuses, setStatuses] = useState({})
  const [open, setOpen] = useState({})
  const API = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    if (!jobs || jobs.length === 0) return
    let cancelled = false

    async function pollStatus() {
      const jobIds = jobs.map(j => j.job_id)
      try {
        const res = await fetch(`${API}/job-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_ids: jobIds })
        })
        const data = await res.json()
        if (!cancelled && data.statuses) {
          const map = {}
          data.statuses.forEach(s => { map[s.job_id] = s })
          setStatuses(map)
          if (onUpdate) onUpdate(map)
        }
      } catch (e) {}
    }

    pollStatus()
    const interval = setInterval(pollStatus, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [jobs, onUpdate])

  if (!jobs || jobs.length === 0) return null

  function toggleOpen(job_id) {
    setOpen(prev => ({ ...prev, [job_id]: !prev[job_id] }))
  }

  function formatResult(result) {
    let obj
    try {
      obj = typeof result === "string" ? JSON.parse(result) : result
    } catch {
      // Versuch, einfache Hochkommas zu ersetzen
      try {
        obj = JSON.parse(result.replace(/'/g, '"'))
      } catch {
        return <pre>{result}</pre>
      }
    }

    // Zeige Tool-Status und Text-Content schön an
    return (
      <div>
        {obj.status && <div><b>Status:</b> {obj.status}</div>}
        {obj.toolUseId && <div><b>Tool-ID:</b> {obj.toolUseId}</div>}
        {Array.isArray(obj.content) && obj.content.length > 0 && (
          <div style={{marginTop:8}}>
            <b>Erkannte Texte:</b>
            <ul>
              {obj.content.map((c, i) =>
                c.text.split('\n').map((line, j) =>
                  line.trim() && <li key={i + '-' + j}>{line}</li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (!jobs || jobs.length === 0) return null

  return (
    <div>
      {panelOpen && (
        <div
          className="job-list-panel"
          style={{
            width: 500,
            maxHeight: 400,
            overflowY: "auto",
            border: "1px solid #333",
            borderRadius: 8,
            padding: 16,
            background: "#222",      // <-- dunkel
            color: "#eee"            // <-- helle Schrift
          }}
        >
          <h4>Analysen</h4>
          <ul>
            {jobs.map(job => {
              const s = statuses[job.job_id] || {}
              return (
                <li key={job.job_id} className="job-row">
                  <span className="job-filename">{job.video?.key || job.job_id}</span>
                  {s.status === 'running' && <SmallSpinner />}
                  {s.status === 'done' && <span style={{color:'#6ee7b7'}}>✅</span>}
                  {s.status === 'error' && <span style={{color:'tomato'}}>❌</span>}
                  <span className="job-status">{s.status}</span>
                  {s.result && (
                    <>
                      <button
                        className="fancy-btn job-toggle-btn"
                        onClick={() => setOpen(prev => ({ ...prev, [job.job_id]: !prev[job.job_id] }))}
                        style={{marginLeft: 8}}
                      >
                        {open[job.job_id] ? 'Ergebnis ausblenden' : 'Ergebnis anzeigen'}
                      </button>
                      {open[job.job_id] && (
                        <div className="job-result">{formatResult(s.result)}</div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}