import React from 'react';
import { LogOut, MapPin, User, Menu } from 'lucide-react';

export default function Header({ user, onLogout, onToggleSidebar, activeTab, onTabChange }) {
  if (!user) return null;
  const isAdmin = user.role === 'ADMIN';

  return (
    <header className="header">
      {/* Mobile sidebar toggle button for Admin */}
      {isAdmin && (
        <button 
          className="sidebar-toggle-btn" 
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            marginRight: '12px'
          }}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Header title & brand */}
      <div className="header-title-fallback" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="logo-badge" style={{ backgroundColor: 'var(--primary)' }}>G</span>
        <span style={{ fontWeight: 700 }}>Gölcük Saha</span>
      </div>

      {/* Non-admin desktop tabs */}
      {!isAdmin && onTabChange && (
        <div className="view-switcher hide-on-mobile" style={{ marginLeft: '20px' }}>
          <button 
            className={`view-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => onTabChange('members')}
          >
            Üye Listesi
          </button>
          <button 
            className={`view-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            Mahalle İstatistikleri
          </button>
        </div>
      )}

      <div className="header-user-info">
        <div className="user-meta">
          <div className="user-name">{user.name}</div>
          <div className="user-role-district">
            {user.role === 'ADMIN' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Genel Yönetici
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} style={{ color: 'var(--primary)' }} />
                {user.neighborhood ? `${user.neighborhood} Sorumlusu` : `${user.district || 'Gölcük'} Sorumlusu`}
              </span>
            )}
          </div>
        </div>
        
        <button className="btn btn-secondary" onClick={onLogout} style={{ padding: '8px 12px', fontSize: '13px' }}>
          <LogOut size={14} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </header>
  );
}
