import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import NeighborhoodPicker, { NeighborhoodChips } from '../components/NeighborhoodPicker';
import { Plus, Trash2, X, Shield, MapPin } from 'lucide-react';

const DISTRICTS = [
  'Gölcük', 'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası',
  'Gebze', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
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

  // Modal states (editingUser = null → create mode, otherwise assignment edit mode)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [district, setDistrict] = useState('Gölcük');
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState([]);
  const [loadingNeighborhoodOptions, setLoadingNeighborhoodOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'users') {
      fetchUsers();
    } else {
      fetchLogs();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (modalOpen && district) {
      fetchDistrictNeighborhoods(district);
    }
  }, [modalOpen, district]);

  const fetchDistrictNeighborhoods = async (dist) => {
    setLoadingNeighborhoodOptions(true);
    try {
      const data = await api.members.getNeighborhoods(dist);
      setNeighborhoodOptions(data);
    } catch (e) {
      console.error('Mahalleler yüklenemedi:', e);
      setNeighborhoodOptions([]);
    } finally {
      setLoadingNeighborhoodOptions(false);
    }
  };

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
      case 'USER_UPDATE': return 'Mahalle Ataması';
      case 'USER_STATUS_CHANGE': return 'Kullanıcı Durumu';
      case 'USER_DELETE': return 'Kullanıcı Silme';
      default: return type;
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('USER');
    setDistrict('Gölcük');
    setSelectedNeighborhoods([]);
    setModalOpen(true);
  };

  const openAssignmentModal = (user) => {
    setEditingUser(user);
    setDistrict(user.district || 'Gölcük');
    setSelectedNeighborhoods(user.neighborhoods || []);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingUser && (!name || !email || !password)) {
      setErrorMsg('Lütfen ad soyad, e-posta ve şifre alanlarını doldurun.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (editingUser) {
        await api.users.updateAssignment(editingUser.id, {
          district,
          neighborhoods: selectedNeighborhoods
        });
        setSuccessMsg(`${editingUser.name} için mahalle ataması güncellendi.`);
      } else {
        await api.users.create({
          name,
          email,
          password,
          role,
          district: role === 'ADMIN' ? null : district,
          neighborhoods: role === 'ADMIN' ? [] : selectedNeighborhoods
        });
        setSuccessMsg('Mahalle sorumlusu / kullanıcı başarıyla oluşturuldu.');
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || (editingUser ? 'Mahalle ataması güncellenemedi.' : 'Kullanıcı oluşturulamadı.'));
    } finally {
      setSubmitting(false);
    }
  };

  const showAssignmentFields = editingUser || role === 'USER';

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h2 className="page-title">{activeSubTab === 'users' ? 'Kullanıcı & Mahalle Sorumluları' : 'İşlem Günlükleri'}</h2>
          <span className="page-subtitle">
            {activeSubTab === 'users'
              ? 'Saha sorumluları, mahalle temsilcileri ve sistem yöneticileri'
              : 'Sistem genelinde yapılan tüm saha ve üye güncellemelerinin denetim kayıtları'}
          </span>
        </div>
        {activeSubTab === 'users' && (
          <button className="btn btn-primary hide-on-mobile" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Yeni Sorumlu Ekle</span>
          </button>
        )}
      </div>

      {/* Mobile floating action button */}
      {activeSubTab === 'users' && (
        <button className="fab" onClick={openCreateModal} aria-label="Yeni Sorumlu Ekle">
          <Plus size={24} />
        </button>
      )}

      {/* Sub-tab Switcher */}
      <div className="view-switcher subtab-switcher">
        <button
          className={`view-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('users')}
        >
          Sorumlu ve Kullanıcılar
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
          <div style={{ color: 'var(--text-muted)', padding: '24px' }}>Yükleniyor...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table responsive-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Sorumluluk Alanı</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-primary" style={{ fontWeight: 600 }}>
                      {u.name} {u.id === currentUser.id && <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 'normal' }}>(Siz)</span>}
                    </td>
                    <td className="cell-full" data-label="E-posta">{u.email}</td>
                    <td className="cell-full" data-label="Sorumluluk Alanı">
                      {u.role === 'ADMIN' ? (
                        <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>&mdash; (Tüm İl ve İlçeler)</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <MapPin size={12} style={{ color: 'var(--primary)' }} />
                            {u.district || 'Gölcük'}
                            {(!u.neighborhoods || u.neighborhoods.length === 0) && (
                              <span style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 400 }}>(Tüm Mahalleler)</span>
                            )}
                          </span>
                          <NeighborhoodChips neighborhoods={u.neighborhoods} />
                        </div>
                      )}
                    </td>
                    <td data-label="Rol">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        {u.role === 'ADMIN' ? (
                          <>
                            <Shield size={13} style={{ color: 'var(--primary)' }} />
                            <strong>Genel Yönetici</strong>
                          </>
                        ) : (
                          <span>Mahalle Sorumlusu</span>
                        )}
                      </span>
                    </td>
                    <td data-label="Durum">
                      <span style={{
                        color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-dim)',
                        fontWeight: 600,
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-dim)'
                        }} />
                        {u.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="cell-actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {u.role === 'USER' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => openAssignmentModal(u)}
                            title="Mahalle Ataması"
                          >
                            <MapPin size={13} />
                            <span>Mahalleler</span>
                          </button>
                        )}
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
                          style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.id === currentUser.id}
                          title="Kullanıcıyı Sil"
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
          <div style={{ color: 'var(--text-muted)', padding: '24px' }}>Yükleniyor...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table responsive-table">
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
                      <td data-label="Tarih" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDateTime(log.created_at)}</td>
                      <td className="cell-primary" style={{ fontWeight: 600 }}>{log.user_name}</td>
                      <td className="cell-full" data-label="E-posta">{log.user_email}</td>
                      <td data-label="İşlem Türü">
                        <span className={`role-badge ${log.action_type}`}>
                          {getActionTypeLabel(log.action_type)}
                        </span>
                      </td>
                      <td className="cell-full" data-label="Açıklama" style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.4' }}>{log.details}</td>
                      <td data-label="IP Adresi" style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{log.ip_address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* User Creation / Neighborhood Assignment Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="sheet-handle" />
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                {editingUser ? 'Mahalle Ataması' : 'Yeni Sorumlu Ekle'}
              </h3>
              <button className="drawer-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {editingUser ? (
                  <div className="assignment-target">
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{editingUser.name}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{editingUser.email}</div>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Ad Soyad <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                      <label>E-posta (Giriş için) <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="ahmet@kocaeli-saha.local"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Şifre <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Şifre belirleyin"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
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
                        <option value="USER">Mahalle Sorumlusu (Saha Kullanıcısı)</option>
                        <option value="ADMIN">Genel Yönetici (Admin)</option>
                      </select>
                    </div>
                  </>
                )}

                {showAssignmentFields && (
                  <>
                    <div className="form-group">
                      <label>Görevli Olduğu İlçe</label>
                      <select
                        className="form-control"
                        value={district}
                        onChange={(e) => {
                          setDistrict(e.target.value);
                          setSelectedNeighborhoods([]);
                        }}
                      >
                        {DISTRICTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Sorumlu Olduğu Mahalleler</label>
                      <NeighborhoodPicker
                        options={neighborhoodOptions}
                        value={selectedNeighborhoods}
                        onChange={setSelectedNeighborhoods}
                        loading={loadingNeighborhoodOptions}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', display: 'block' }}>
                        Sorumlu sadece seçilen mahallelerdeki üyeleri görür ve günceller. Hiç seçim yapılmazsa ilçenin tamamına erişir.
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {editingUser
                    ? (submitting ? 'Kaydediliyor...' : 'Atamayı Kaydet')
                    : (submitting ? 'Oluşturuluyor...' : 'Sorumlu Hesabı Oluştur')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
