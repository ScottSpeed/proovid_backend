import React, { useRef, useEffect } from 'react'

export default function Chat({ messages }) {
  const endRef = useRef()
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages])
  return (
    <div className="chat">
      {messages.map((m, i) => (
        <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'agent'}`}>
          <pre>{m.text}</pre>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}