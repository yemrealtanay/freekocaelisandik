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
import { LayoutDashboard, Users, UserCheck, FileSpreadsheet, LogOut } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation active tab: 'dashboard', 'members', 'users', 'upload'
  const [activeTab, setActiveTab] = useState('members');
  
  // Filter drilldown from dashboard to members
  const [targetNeighborhood, setTargetNeighborhood] = useState(null);
  const [targetStance, setTargetStance] = useState(null);

  // Active background upload ID tracker
  const [activeUploadId, setActiveUploadId] = useState(null);
  
  // Mobile sidebar visibility state (for Admins)
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

  const handleNavigateToMembers = (neighborhood, stance) => {
    setTargetNeighborhood(neighborhood);
    setTargetStance(stance);
    setActiveTab('members');
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
      {/* Desktop & Mobile Sidebar - Admin only */}
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
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        {/* Render active tabs/screens */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            currentUser={currentUser} 
            onNavigateToMembers={handleNavigateToMembers} 
          />
        )}
        
        {activeTab === 'members' && (
          <MembersPage 
            currentUser={currentUser} 
            initialNeighborhood={targetNeighborhood}
            initialStance={targetStance}
          />
        )}

        {isAdmin && activeTab === 'users' && (
          <UsersList currentUser={currentUser} />
        )}

        {isAdmin && activeTab === 'upload' && (
          <UploadPage onUploadStart={(id) => setActiveUploadId(id)} />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Rock-solid for phone usage) */}
      <div className="mobile-bottom-nav">
        <button 
          className={`mobile-nav-item ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => {
            setTargetNeighborhood(null);
            setTargetStance(null);
            setActiveTab('members');
          }}
        >
          <UserCheck size={20} />
          <span>Üyeler</span>
        </button>

        <button 
          className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Genel Bakış</span>
        </button>

        {isAdmin && (
          <>
            <button 
              className={`mobile-nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={20} />
              <span>Sorumlular</span>
            </button>
            <button 
              className={`mobile-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <FileSpreadsheet size={20} />
              <span>Excel</span>
            </button>
          </>
        )}

        <button 
          className="mobile-nav-item"
          onClick={handleLogout}
        >
          <LogOut size={20} style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)' }}>Çıkış</span>
        </button>
      </div>

      {/* Floating progress indicator for active uploads */}
      {activeUploadId && (
        <AsyncUploadStatus 
          uploadId={activeUploadId}
          onComplete={(status) => {
            console.log(`Excel background job finished with status: ${status}`);
          }}
          onDismiss={() => setActiveUploadId(null)}
        />
      )}
    </div>
  );
}
