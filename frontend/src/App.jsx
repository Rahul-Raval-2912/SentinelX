import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IncidentForm from './components/IncidentForm';
import ReportStatus from './components/ReportStatus';
import './App.css';

function App() {
  const [currentReport, setCurrentReport] = useState(null);

  const handleReportSubmit = async (payload) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setCurrentReport({
        reportId: result.reportId,
        contentHash: payload.contentHash,
        ethTxHash: payload.ethTxHash
      });
    } catch (error) {
      console.error('Report submission failed:', error);
      throw error;
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Secure Incident Reporter
            </h1>
            <p className="text-gray-600 mt-1">
              End-to-end encrypted reporting with GPU-accelerated redaction
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/" 
              element={
                currentReport ? 
                <Navigate to="/status" replace /> : 
                <IncidentForm onSubmit={handleReportSubmit} />
              } 
            />
            <Route 
              path="/status" 
              element={
                currentReport ? 
                <ReportStatus {...currentReport} /> : 
                <Navigate to="/" replace />
              } 
            />
          </Routes>
        </main>

        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
            <p>Powered by Akash Network • Ethereum Proof-of-Integrity • End-to-End Encryption</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;