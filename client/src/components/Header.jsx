import React from 'react';
import { LogOut, MapPin, User } from 'lucide-react';

export default function Header({ user, onLogout }) {
  if (!user) return null;

  return (
    <header className="header">
      {/* Fallback header title if sidebar is not active */}
      <div className="header-title-fallback">
        <span className="logo-badge">K</span>
        <span>Kocaeli Üye Yönetim Sistemi</span>
      </div>

      <div className="header-user-info">
        <div className="user-meta">
          <div className="user-name">{user.name}</div>
          <div className="user-role-district">
            {user.role === 'ADMIN' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Yönetici (Tüm İlçeler)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {user.district} &middot; Sorumlu
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
