import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Users, PhoneCall, CheckCircle2, AlertCircle, TrendingUp, UserCheck, Clock, MapPin, ExternalLink, RefreshCw } from 'lucide-react';

const PREDEFINED_DISTRICTS = [
  'Gölcük', 'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

export default function Dashboard({ currentUser, onNavigateToMembers }) {
  const isAdmin = currentUser?.role === 'ADMIN';
  const [selectedDistrict, setSelectedDistrict] = useState(
    currentUser?.district || 'Gölcük'
  );
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchStats();
  }, [selectedDistrict]);

  const fetchStats = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.users.getDashboardStats(selectedDistrict);
      setStats(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Saha istatistikleri yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        İstatistikler yükleniyor...
      </div>
    );
  }

  if (errorMsg && !stats) {
    return (
      <div className="page-container" style={{ padding: '24px' }}>
        <div className="toast-msg error">{errorMsg}</div>
        <button className="btn btn-secondary" onClick={fetchStats} style={{ marginTop: '12px' }}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  const totalMembers = stats?.totalMembers || 0;
  const contactedMembers = stats?.contactedMembers || 0;
  const notContactedMembers = stats?.notContactedMembers || 0;
  const contactRate = stats?.contactRate || 0;

  const stance = stats?.stanceBreakdown || {
    DESTEKLIYOR: 0,
    KARARSIZ: 0,
    MESAFELI: 0,
    BELIRTILMEDI: 0
  };

  const getPercent = (count) => {
    if (!totalMembers || totalMembers === 0) return 0;
    return Math.round((count / totalMembers) * 100);
  };

  const destekPercent = getPercent(stance.DESTEKLIYOR);
  const kararsizPercent = getPercent(stance.KARARSIZ);
  const mesafeliPercent = getPercent(stance.MESAFELI);
  const belirtilmediPercent = getPercent(stance.BELIRTILMEDI);

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-area">
          <div className="page-title">
            <span>Saha ve Seçmen Genel Bakışı</span>
            {isAdmin ? (
              <select
                className="district-select-dropdown"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {PREDEFINED_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="district-badge">
                {currentUser?.neighborhood ? `${currentUser.neighborhood}` : `${selectedDistrict}`}
              </span>
            )}
          </div>
          <span className="page-subtitle">
            {currentUser?.neighborhood 
              ? `${currentUser.neighborhood} Mahallesi saha görüşmeleri ve seçmen intiba istatistikleri`
              : 'Gölcük saha görüşmeleri, seçmen eğilimi ve mahalle sorumlusu performansı'}
          </span>
        </div>

        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchStats} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="btn-label">Yenile</span>
          </button>
        </div>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}

      {/* Main KPI Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Toplam Kayıtlı Üye</span>
          <span className="stat-value">{totalMembers.toLocaleString('tr-TR')}</span>
          <div className="stat-icon-wrapper">
            <Users size={28} />
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Görüşülen Seçmen</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
              %{contactRate}
            </span>
          </div>
          <span className="stat-value" style={{ color: 'var(--success)' }}>
            {contactedMembers.toLocaleString('tr-TR')}
          </span>
          <div className="stat-icon-wrapper">
            <PhoneCall size={28} style={{ color: 'var(--success)' }} />
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">Henüz Görüşülmeyen</span>
          <span className="stat-value" style={{ color: 'var(--text-muted)' }}>
            {notContactedMembers.toLocaleString('tr-TR')}
          </span>
          <div className="stat-icon-wrapper">
            <Clock size={28} style={{ color: 'var(--text-dim)' }} />
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <span className="stat-label">Destekleyen Oranı</span>
          <span className="stat-value" style={{ color: '#3b82f6' }}>
            %{destekPercent}
          </span>
          <div className="stat-icon-wrapper">
            <TrendingUp size={28} style={{ color: '#3b82f6' }} />
          </div>
        </div>
      </div>

      {/* Voter Stance Breakdown Bar & Cards */}
      <div className="table-container panel" style={{ marginBottom: '24px' }}>
        <div className="section-head">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Seçmen İntibası ve Eğilim Dağılımı</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Görüşme yapılan üyelerin siyasi tercihi ve saha intiba analizleri
            </p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="distribution-bar" style={{ height: '24px', borderRadius: '8px', marginBottom: '16px' }}>
          <div 
            className="distribution-segment DESTEKLIYOR" 
            style={{ width: `${destekPercent}%` }} 
            title={`Destekliyor: ${stance.DESTEKLIYOR} kişi (%${destekPercent})`}
          />
          <div 
            className="distribution-segment KARARSIZ" 
            style={{ width: `${kararsizPercent}%` }} 
            title={`Kararsız: ${stance.KARARSIZ} kişi (%${kararsizPercent})`}
          />
          <div 
            className="distribution-segment MESAFELI" 
            style={{ width: `${mesafeliPercent}%` }} 
            title={`Mesafeli: ${stance.MESAFELI} kişi (%${mesafeliPercent})`}
          />
          <div 
            className="distribution-segment BELIRTILMEDI" 
            style={{ width: `${belirtilmediPercent}%` }} 
            title={`Henüz Görüşülmedi: ${stance.BELIRTILMEDI} kişi (%${belirtilmediPercent})`}
          />
        </div>

        {/* 4 Stance Quick Filter Cards */}
        <div className="stance-summary-grid">
          
          <div 
            style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px',
              cursor: onNavigateToMembers ? 'pointer' : 'default'
            }}
            onClick={() => onNavigateToMembers && onNavigateToMembers('TUM', 'DESTEKLIYOR')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>🟢 Destekliyor</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>%{destekPercent}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
              {stance.DESTEKLIYOR.toLocaleString('tr-TR')}
            </div>
          </div>

          <div 
            style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.08)', 
              border: '1px solid rgba(245, 158, 11, 0.25)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px',
              cursor: onNavigateToMembers ? 'pointer' : 'default'
            }}
            onClick={() => onNavigateToMembers && onNavigateToMembers('TUM', 'KARARSIZ')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>🟡 Kararsız</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>%{kararsizPercent}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
              {stance.KARARSIZ.toLocaleString('tr-TR')}
            </div>
          </div>

          <div 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.08)', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px',
              cursor: onNavigateToMembers ? 'pointer' : 'default'
            }}
            onClick={() => onNavigateToMembers && onNavigateToMembers('TUM', 'MESAFELI')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>🔴 Mesafeli</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>%{mesafeliPercent}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
              {stance.MESAFELI.toLocaleString('tr-TR')}
            </div>
          </div>

          <div 
            style={{ 
              backgroundColor: 'rgba(100, 116, 139, 0.08)', 
              border: '1px solid rgba(100, 116, 139, 0.25)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px',
              cursor: onNavigateToMembers ? 'pointer' : 'default'
            }}
            onClick={() => onNavigateToMembers && onNavigateToMembers('TUM', 'BELIRTILMEDI')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>⚪ Henüz Görüşülmedi</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>%{belirtilmediPercent}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
              {stance.BELIRTILMEDI.toLocaleString('tr-TR')}
            </div>
          </div>

        </div>
      </div>

      {/* Two Detailed Tables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Table 1: Mahallelere Göre Dağılım */}
        <div className="table-container panel">
          <div className="section-head">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {stats?.isNeighborhoodScoped ? `${stats.neighborhood} Mahallesi Saha Dağılımı` : 'Mahallelere Göre Saha Dağılımı'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {stats?.isNeighborhoodScoped 
                  ? 'Kendi mahallenize ait kayıtlı üye sayıları ve intiba durumları' 
                  : 'Mahalle bazında üye sayıları ve intiba dağılım detayları'}
              </p>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {stats?.isNeighborhoodScoped ? 'Sorumlu Olduğunuz Mahalle' : `${stats?.neighborhoodsData?.length || 0} Mahalle`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table responsive-table rt-3 table-wide">
              <thead>
                <tr>
                  <th>Mahalle Adı</th>
                  <th style={{ textAlign: 'right' }}>Toplam Üye</th>
                  <th style={{ textAlign: 'right' }}>Görüşülen</th>
                  <th style={{ textAlign: 'right' }}>Oran</th>
                  <th style={{ textAlign: 'right' }}>🟢 Destek</th>
                  <th style={{ textAlign: 'right' }}>🟡 Kararsız</th>
                  <th style={{ textAlign: 'right' }}>🔴 Mesafeli</th>
                  <th style={{ textAlign: 'right' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {(!stats?.neighborhoodsData || stats.neighborhoodsData.length === 0) ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Kayıtlı mahalle verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  stats.neighborhoodsData.map((row) => {
                    const rate = row.total_members > 0 
                      ? Math.round((row.contacted_count / row.total_members) * 100) 
                      : 0;

                    return (
                      <tr key={row.neighborhood}>
                        <td className="cell-primary" style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={13} style={{ color: 'var(--primary)' }} />
                            {row.neighborhood}
                          </span>
                        </td>
                        <td data-label="Toplam Üye" style={{ textAlign: 'right', fontWeight: 600 }}>{row.total_members}</td>
                        <td data-label="Görüşülen" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                          {row.contacted_count}
                        </td>
                        <td data-label="Oran" style={{ textAlign: 'right' }}>
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: 700, 
                            color: rate > 50 ? 'var(--success)' : rate > 20 ? 'var(--warning)' : 'var(--text-muted)' 
                          }}>
                            %{rate}
                          </span>
                        </td>
                        <td data-label="🟢 Destek" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          {row.destekliyor_count || 0}
                        </td>
                        <td data-label="🟡 Kararsız" style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                          {row.kararsiz_count || 0}
                        </td>
                        <td data-label="🔴 Mesafeli" style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                          {row.mesafeli_count || 0}
                        </td>
                        <td className="cell-actions" style={{ textAlign: 'right' }}>
                          {onNavigateToMembers && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => onNavigateToMembers(row.neighborhood, 'TUM')}
                            >
                              Listele
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Mahalle Sorumluları Saha Performansı */}
        <div className="table-container panel">
          <div className="section-head">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {isAdmin ? 'Mahalle Sorumluları Görüşme Performansı (Tüm Mahalleler)' : 'Kişisel Saha İletişim Performansınız'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {isAdmin 
                  ? 'Hangi mahalle sorumlusunun kaç görüşme yaptığı ve son aktiflik zamanı'
                  : 'Yaptığınız toplam görüşme sayısı, ulaştığınız tekil üye ve son faaliyet tarihiniz'}
              </p>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {isAdmin ? `${stats?.representativeStats?.length || 0} Sorumlu` : 'Saha İstatistiği'}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table responsive-table rt-3 table-wide">
              <thead>
                <tr>
                  <th>Sorumlu Adı</th>
                  <th>E-posta</th>
                  <th>Sorumlu Olduğu Mahalle</th>
                  <th style={{ textAlign: 'right' }}>Toplam Görüşme</th>
                  <th style={{ textAlign: 'right' }}>Görüşülen Farklı Üye</th>
                  <th style={{ textAlign: 'right' }}>Son Faaliyet Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {(!stats?.representativeStats || stats.representativeStats.length === 0) ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Kayıtlı saha sorumlusu bulunamadı.
                    </td>
                  </tr>
                ) : (
                  stats.representativeStats.map((rep) => (
                    <tr key={rep.user_id}>
                      <td className="cell-primary" style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--bg-app)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--primary)'
                          }}>
                            {rep.user_name ? rep.user_name[0].toUpperCase() : 'U'}
                          </div>
                          <span>{rep.user_name}</span>
                        </div>
                      </td>
                      <td className="cell-full" data-label="E-posta" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{rep.user_email}</td>
                      <td className="cell-full" data-label="Mahalle">
                        {rep.user_neighborhood ? (
                          <span className="neighborhood-badge">
                            <MapPin size={11} />
                            {rep.user_neighborhood}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                            {rep.user_role === 'ADMIN' ? 'Genel Yönetici' : `${rep.user_district || 'Gölcük'} (Tüm)`}
                          </span>
                        )}
                      </td>
                      <td data-label="Görüşme" style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'var(--primary)' }}>
                        {rep.total_interactions || 0}
                      </td>
                      <td data-label="Farklı Üye" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                        {rep.unique_members_contacted || 0}
                      </td>
                      <td data-label="Son Faaliyet" style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {rep.last_active_date ? new Date(rep.last_active_date).toLocaleDateString('tr-TR') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
