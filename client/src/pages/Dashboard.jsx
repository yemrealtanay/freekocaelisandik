import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Users, UserCheck, ShieldAlert, Award, Percent } from 'lucide-react';
import { getRoleLabel } from '../components/MemberTable';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.users.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('İstatistikler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>İstatistikler yükleniyor...</div>;
  }

  if (errorMsg) {
    return <div style={{ padding: '32px', color: 'var(--danger)' }}>{errorMsg}</div>;
  }

  if (!stats) return null;

  const totalAssigned = 
    (stats.roleBreakdown.SANDIK_GOREVLISI || 0) +
    (stats.roleBreakdown.SANDIK_SORUMLUSU || 0) +
    (stats.roleBreakdown.MUSAHIT || 0) +
    (stats.roleBreakdown.YEDEK || 0);

  const assignmentRate = stats.totalMembers > 0 
    ? Math.round((totalAssigned / stats.totalMembers) * 100) 
    : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h2 className="page-title">Genel Bakış</h2>
          <span className="page-subtitle">Kocaeli genelindeki üye ve kullanıcı durum bilgileri</span>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Toplam Üye Sayısı</span>
          <span className="stat-value">{stats.totalMembers}</span>
          <div className="stat-icon-wrapper">
            <Users size={32} />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Toplam Görevli Sayısı</span>
          <span className="stat-value">{totalAssigned}</span>
          <div className="stat-icon-wrapper">
            <UserCheck size={32} />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Aktif Kullanıcı (Sorumlu)</span>
          <span className="stat-value">{stats.totalUsers}</span>
          <div className="stat-icon-wrapper">
            <ShieldAlert size={32} />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Görevlendirme Oranı</span>
          <span className="stat-value">%{assignmentRate}</span>
          <div className="stat-icon-wrapper">
            <Percent size={32} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px', alignItems: 'start' }}>
        
        {/* District Table */}
        <div className="table-container" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text-main)' }}>İlçelere Göre Üye Dağılımı</h3>
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px' }}>İlçe Adı</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Üye Sayısı</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Sorumlu Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {stats.districtsData.map((d) => (
                <tr key={d.district}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{d.district}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{d.membersCount}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{d.usersCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Roles Panel */}
        <div className="table-container" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text-main)' }}>Görev Dağılımı</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(stats.roleBreakdown).map((roleKey) => {
              const count = stats.roleBreakdown[roleKey] || 0;
              const percent = stats.totalMembers > 0 ? Math.round((count / stats.totalMembers) * 100) : 0;
              return (
                <div key={roleKey} style={{ 
                  backgroundColor: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className={`role-badge ${roleKey}`}>
                      {getRoleLabel(roleKey)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>%{percent} oranında</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
