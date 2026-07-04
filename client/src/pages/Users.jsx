import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, ToggleLeft, ToggleRight, Trash2, X, Shield, MapPin, Check, AlertCircle } from 'lucide-react';

const DISTRICTS = [
  'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'Gölcük', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

export default function UsersList({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Mobile/Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState('users');
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'users') {
      fetchUsers();
    } else {
      fetchLogs();
    }
  }, [activeSubTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setErrorMsg('');
    try {
      const data = await api.users.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('İşlem logları yüklenemedi.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('tr-TR');
  };

  const getActionTypeLabel = (type) => {
    switch (type) {
      case 'MEMBER_CREATE': return 'Üye Ekleme';
      case 'MEMBER_UPDATE': return 'Üye Güncelleme';
      case 'MEMBER_DELETE': return 'Üye Silme';
      case 'EXCEL_UPLOAD': return 'Excel Yükleme';
      case 'USER_CREATE': return 'Kullanıcı Ekleme';
      case 'USER_STATUS_CHANGE': return 'Kullanıcı Durumu';
      case 'USER_DELETE': return 'Kullanıcı Silme';
      default: return type;
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      setErrorMsg('Kendi hesabınızı pasifleştiremezsiniz.');
      return;
    }
    
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.users.toggleStatus(user.id, user.status);
      setSuccessMsg(`${user.name} kullanıcısının durumu güncellendi.`);
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Durum değiştirilemedi.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser.id) {
      setErrorMsg('Kendi hesabınızı silemezsiniz.');
      return;
    }

    if (!window.confirm(`${user.name} kullanıcısını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.users.delete(user.id);
      setSuccessMsg('Kullanıcı başarıyla silindi.');
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Kullanıcı silinemedi.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMsg('Tüm alanları doldurmanız gerekmektedir.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.users.create({
        name,
        email,
        password,
        role,
        district: role === 'ADMIN' ? null : district
      });
      setSuccessMsg('Kullanıcı başarıyla oluşturuldu.');
      setModalOpen(false);
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setRole('USER');
      setDistrict(DISTRICTS[0]);
      
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Kullanıcı oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h2 className="page-title">{activeSubTab === 'users' ? 'Kullanıcılar' : 'İşlem Günlükleri'}</h2>
          <span className="page-subtitle">
            {activeSubTab === 'users' 
              ? 'İlçe sorumluları ve yöneticiler' 
              : 'Sistem genelinde yapılan tüm kritik işlemlerin güvenlik kayıtları'}
          </span>
        </div>
        {activeSubTab === 'users' && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            <span>Yeni Kullanıcı Ekle</span>
          </button>
        )}
      </div>

      {/* Sub-tab Switcher */}
      <div className="view-switcher" style={{ marginBottom: '24px', width: 'fit-content' }}>
        <button 
          className={`view-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('users')}
        >
          Kullanıcı Yönetimi
        </button>
        <button 
          className={`view-btn ${activeSubTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('logs')}
        >
          İşlem Günlükleri (Audit)
        </button>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      {activeSubTab === 'users' ? (
        loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Email</th>
                  <th>İlçe</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name} {u.id === currentUser.id && <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 'normal' }}>(Siz)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.role === 'ADMIN' ? (
                        <span style={{ color: 'var(--text-dim)' }}>&mdash; (tüm ilçeler)</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                          {u.district}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                        {u.role === 'ADMIN' ? (
                          <>
                            <Shield size={12} style={{ color: 'var(--primary)' }} />
                            Yönetici
                          </>
                        ) : (
                          'Kullanıcı'
                        )}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-dim)', 
                        fontWeight: 600,
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ 
                          width: '6px', 
                          height: '6px', 
                          borderRadius: '50%', 
                          backgroundColor: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-dim)' 
                        }} />
                        {u.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className={`btn ${u.status === 'ACTIVE' ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.id === currentUser.id}
                        >
                          {u.status === 'ACTIVE' ? 'Pasife Al' : 'Aktif Et'}
                        </button>
                        <button 
                          className="btn btn-danger"
                          style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.id === currentUser.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        loadingLogs ? (
          <div style={{ color: 'var(--text-muted)' }}>Yükleniyor...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kullanıcı</th>
                  <th>E-posta</th>
                  <th>İşlem Türü</th>
                  <th>Açıklama</th>
                  <th>IP Adresi</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      İşlem kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDateTime(log.created_at)}</td>
                      <td style={{ fontWeight: 600 }}>{log.user_name}</td>
                      <td>{log.user_email}</td>
                      <td>
                        <span className={`role-badge ${log.action_type}`}>
                          {getActionTypeLabel(log.action_type)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.4' }}>{log.details}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* User Creation Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Yeni Kullanıcı Ekle</h3>
              <button className="drawer-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Ad Soyad</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ahmet Yılmaz"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>E-posta</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="ahmet@kocaeli-org.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Şifre</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Şifre belirleyin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Kullanıcı Rolü</label>
                  <select 
                    className="form-control"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="USER">İlçe Sorumlusu (Kullanıcı)</option>
                    <option value="ADMIN">Genel Yönetici (Admin)</option>
                  </select>
                </div>

                {role === 'USER' && (
                  <div className="form-group">
                    <label>Görevli Olduğu İlçe</label>
                    <select
                      className="form-control"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    >
                      {DISTRICTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
