import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import VideoChat from './pages/VideoChat';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<VideoChat />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;