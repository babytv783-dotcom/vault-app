import React, { useState, useEffect, useRef } from 'react';
import { api } from './api.js';

export default function ChatView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.getChatHistory().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const { reply, notices } = await api.sendChat(text);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, notices }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Something went wrong: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="main">
      <div className="topbar">
        <div className="topbar-title">Chat</div>
        <div className="topbar-sub">remembers everything</div>
      </div>
      <div className="view">
        <div className="view-inner">
          {messages.length === 0 && (
            <div className="empty-state" style={{ height: '60vh' }}>
              <i className="ti ti-message-circle"></i>
              <div>Tell it about an account, or ask it something.</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              <div className="msg-avatar">{m.role === 'user' ? 'YOU' : 'AI'}</div>
              <div>
                <div className="msg-name">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                <div className="msg-body">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>
      <form className="chat-input-bar" onSubmit={handleSend}>
        <div className="chat-input-wrap">
          <input
            type="text"
            placeholder="Tell the assistant something, or ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="send-btn" disabled={sending || !input.trim()}>
            <i className="ti ti-arrow-up"></i>
          </button>
        </div>
      </form>
    </div>
  );
}
