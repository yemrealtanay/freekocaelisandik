import React, { useState } from 'react';
import { LayoutDashboard, Users, UserCheck, FileSpreadsheet, Database } from 'lucide-react';
import { api } from '../utils/api';

export default function Sidebar({ activeTab, onTabChange }) {
  const [downloading, setDownloading] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'users', label: 'Kullanıcılar', icon: Users },
    { id: 'members', label: 'Üyeler', icon: UserCheck },
    { id: 'upload', label: 'Excel Yükle', icon: FileSpreadsheet }
  ];

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const blob = await api.users.downloadDatabase();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `sandik_db_yedek_${dateStr}.sqlite`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Yedek alınırken hata oluştu.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo-area">
        <span className="logo-badge">I</span>
        <div className="logo-text">
          <strong>Intra-K</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>İç İletişim Portalı</div>
        </div>
      </div>
      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <div
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <IconComponent size={18} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* Backup Database Button */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button 
          className="btn btn-secondary" 
          style={{ 
            width: '100%', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '12px', 
            padding: '10px',
            color: 'var(--text-main)',
            borderColor: 'var(--border-color)'
          }} 
          onClick={handleDownloadBackup}
          disabled={downloading}
        >
          <Database size={14} style={{ color: 'var(--primary)' }} />
          <span>{downloading ? 'Yedekleniyor...' : 'Veritabanı Yedekle'}</span>
        </button>
      </div>
    </aside>
  );
}
