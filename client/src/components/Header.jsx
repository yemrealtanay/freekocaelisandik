import React from 'react';
import { LogOut, MapPin, Menu } from 'lucide-react';

export default function Header({ user, onLogout, onToggleSidebar, activeTab, onTabChange }) {
  if (!user) return null;
  const isAdmin = user.role === 'ADMIN';

  const roleLabel = isAdmin
    ? 'Genel Yönetici'
    : user.neighborhood
      ? `${user.neighborhood} Sorumlusu`
      : `${user.district || 'Gölcük'} Sorumlusu`;

  return (
    <header className="header">
      <div className="header-left">
        {/* Mobile sidebar toggle button for Admin (hidden on desktop) */}
        {isAdmin && (
          <button className="icon-btn sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Menüyü aç">
            <Menu size={20} />
          </button>
        )}

        {/* Header brand (shown when sidebar is not visible) */}
        <div className={`header-brand ${isAdmin ? 'mobile-only' : ''}`}>
          <span className="logo-badge" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>G</span>
          <span className="header-brand-text">Gölcük Saha</span>
        </div>

        {/* Non-admin desktop tabs */}
        {!isAdmin && onTabChange && (
          <div className="view-switcher hide-on-mobile" style={{ marginLeft: '12px' }}>
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
      </div>

      <div className="header-user-info">
        <div className="user-meta">
          <div className="user-name">{user.name}</div>
          <div className="user-role-district">
            {!isAdmin && <MapPin size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
            <span>{roleLabel}</span>
          </div>
        </div>

        {/* Logout lives in the bottom nav on mobile */}
        <button className="btn btn-secondary hide-on-mobile" onClick={onLogout} style={{ padding: '8px 12px', fontSize: '13px' }}>
          <LogOut size={14} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </header>
  );
}
