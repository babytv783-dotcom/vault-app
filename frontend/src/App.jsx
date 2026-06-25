import React, { useState, useEffect } from 'react';
import { getToken, clearToken, api } from './api.js';
import Login from './Login.jsx';
import Sidebar from './Sidebar.jsx';
import ChatView from './ChatView.jsx';
import TableScreen from './TableScreen.jsx';
import NotesScreen from './NotesScreen.jsx';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [screens, setScreens] = useState([]);
  const [activeView, setActiveView] = useState('chat'); // 'chat' or a screen id
  const [activeScreen, setActiveScreen] = useState(null);

  useEffect(() => {
    if (loggedIn) {
      api.getScreens().then(setScreens).catch(() => {});
    }
  }, [loggedIn]);

  function handleSelectScreen(screen) {
    setActiveView(screen.id);
    setActiveScreen(screen);
  }

  async function handleCreateScreen(name, type) {
    const screen = await api.createScreen(name, type);
    setScreens((prev) => [...prev, screen]);
    handleSelectScreen(screen);
  }

  async function handleDeleteScreen(id) {
    await api.deleteScreen(id);
    setScreens((prev) => prev.filter((s) => s.id !== id));
    if (activeView === id) {
      setActiveView('chat');
      setActiveScreen(null);
    }
  }

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app">
      <Sidebar
        screens={screens}
        activeView={activeView}
        onSelectChat={() => setActiveView('chat')}
        onSelectScreen={handleSelectScreen}
        onCreateScreen={handleCreateScreen}
        onDeleteScreen={handleDeleteScreen}
        onLogout={handleLogout}
      />
      {activeView === 'chat' && <ChatView />}
      {activeView !== 'chat' && activeScreen?.type === 'table' && <TableScreen screen={activeScreen} />}
      {activeView !== 'chat' && activeScreen?.type === 'notes' && <NotesScreen screen={activeScreen} />}
    </div>
  );
}
