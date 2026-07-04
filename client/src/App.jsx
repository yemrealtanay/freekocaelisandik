import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersList from './pages/Users';
import MembersPage from './pages/Members';
import UploadPage from './pages/Upload';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AsyncUploadStatus from './components/AsyncUploadStatus';
import { api } from './utils/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation active tab (used for Admins only)
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Active background upload ID tracker
  const [activeUploadId, setActiveUploadId] = useState(null);
  
  // Mobile sidebar visibility state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setLoading(true);
    try {
      const user = await api.auth.me();
      setCurrentUser(user);
      // For Admin, default to dashboard. For regular User, they only have the members list view
      if (user.role === 'ADMIN') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('members');
      }
    } catch (err) {
      console.log('No active session / auth expired.');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('members');
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
    setActiveUploadId(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#090b0f',
        color: '#f3f4f6',
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px'
      }}>
        Sistem yükleniyor...
      </div>
    );
  }

  // Auth Guard
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className={`app-layout ${!isAdmin ? 'no-sidebar' : ''}`}>
      {/* Sidebar - Admin only */}
      {isAdmin && (
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            setActiveTab(tab);
            setMobileSidebarOpen(false);
          }} 
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Container */}
      <div className="main-content">
        <Header 
          user={currentUser} 
          onLogout={handleLogout} 
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
        />
        
        {/* Render active tabs/screens */}
        {isAdmin ? (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'users' && <UsersList currentUser={currentUser} />}
            {activeTab === 'members' && <MembersPage currentUser={currentUser} />}
            {activeTab === 'upload' && (
              <UploadPage onUploadStart={(id) => setActiveUploadId(id)} />
            )}
          </>
        ) : (
          <MembersPage currentUser={currentUser} />
        )}
      </div>

      {/* Floating progress indicator for active uploads */}
      {activeUploadId && (
        <AsyncUploadStatus 
          uploadId={activeUploadId}
          onComplete={(status) => {
            // Once excel import completes, we trigger a refresh.
            // If the user is currently on the members view, they will see imported records.
            // We can refresh the page or rely on components handling the mount updates.
            console.log(`Excel background job finished with status: ${status}`);
          }}
          onDismiss={() => setActiveUploadId(null)}
        />
      )}
    </div>
  );
}
