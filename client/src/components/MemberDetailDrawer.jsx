import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Phone, Calendar, User, Info, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';
import { formatPhone } from './MemberTable';

export default function MemberDetailDrawer({ member, onClose, onUpdateSuccess }) {
  const [activeSubTab, setActiveSubTab] = useState('timeline'); // 'timeline' or 'edit'
  
  // Member edit form state
  const [tckn, setTckn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');
  const [ballotNo, setBallotNo] = useState('');
  const [role, setRole] = useState('');
  
  // Timeline events state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // New event form state
  const [eventType, setEventType] = useState('ARAMA');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventNote, setEventNote] = useState('');
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [submittingMember, setSubmittingMember] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset states when member changes
  useEffect(() => {
    if (member) {
      setTckn(member.tckn || '');
      setFirstName(member.first_name || '');
      setLastName(member.last_name || '');
      setPhone(member.phone || '');
      setSchool(member.school || '');
      setBallotNo(member.ballot_no || '');
      setRole(member.role || 'GOREVSIZ');
      setErrorMsg('');
      setSuccessMsg('');
      setActiveSubTab('timeline');
      fetchTimeline();
    }
  }, [member]);

  const fetchTimeline = async () => {
    if (!member) return;
    setLoadingTimeline(true);
    try {
      const data = await api.members.getTimeline(member.id);
      setTimelineEvents(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Zaman akışı yüklenemedi.');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      setErrorMsg('Ad ve Soyad alanları zorunludur.');
      return;
    }
    setSubmittingMember(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.update(member.id, {
        tckn,
        first_name: firstName,
        last_name: lastName,
        phone,
        school,
        ballot_no: ballotNo,
        role
      });
      setSuccessMsg('Üye bilgileri başarıyla güncellendi.');
      onUpdateSuccess();
      // Reload timeline as a role change log might have been created
      fetchTimeline();
    } catch (err) {
      setErrorMsg(err.message || 'Güncelleme hatası.');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleAddTimelineEvent = async (e) => {
    e.preventDefault();
    if (!eventNote.trim()) {
      setErrorMsg('Lütfen işlem notunu girin.');
      return;
    }
    setSubmittingEvent(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.addTimeline(member.id, {
        type: eventType,
        date: eventDate,
        note: eventNote
      });
      setEventNote('');
      setSuccessMsg('İşlem zaman akışına eklendi.');
      fetchTimeline();
      onUpdateSuccess(); // Trigger list refresh to show latest note in list
    } catch (err) {
      setErrorMsg(err.message || 'Aktivite eklenemedi.');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'ARAMA': return <Phone size={14} />;
      case 'SMS': return <FileText size={14} />;
      case 'ROLE_CHANGE': return <CheckCircle2 size={14} />;
      default: return <Info size={14} />;
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case 'ARAMA': return 'Telefon Araması';
      case 'SMS': return 'SMS Gönderimi';
      case 'EPOSTA': return 'E-posta';
      case 'YUZ_YUZE': return 'Yüz Yüze';
      case 'ROLE_CHANGE': return 'Görev Değişimi';
      case 'SYSTEM': return 'Sistem Notu';
      default: return 'Not';
    }
  };

  if (!member) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-area">
            <div className="drawer-title">{firstName} {lastName}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {member.district} İlçesi &bull; {formatPhone(phone)}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Swapping inside Drawer */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveSubTab('timeline')}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              color: activeSubTab === 'timeline' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeSubTab === 'timeline' ? '2px solid var(--primary)' : 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Zaman Akışı (Timeline)
          </button>
          <button
            onClick={() => setActiveSubTab('edit')}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              color: activeSubTab === 'edit' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeSubTab === 'edit' ? '2px solid var(--primary)' : 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Bilgileri Düzenle
          </button>
        </div>

        {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
        {successMsg && <div className="toast-msg success">{successMsg}</div>}

        <div className="drawer-body">
          {activeSubTab === 'edit' ? (
            /* Member Edit Form */
            <form onSubmit={handleUpdateMember}>
              <h4 className="drawer-section-title">Profil Bilgileri</h4>
              
              <div className="grid-2-col">
                <div className="form-group">
                  <label>Ad</label>
                  <input
                    type="text"
                    className="form-control"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Soyad</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-2-col">
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="text"
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>TCKN</label>
                  <input
                    type="text"
                    className="form-control"
                    value={tckn}
                    onChange={(e) => setTkn(e.target.value)}
                    maxLength={11}
                  />
                </div>
              </div>

              <h4 className="drawer-section-title" style={{ marginTop: '16px' }}>Sandık & Görev Detayları</h4>

              <div className="grid-2-col">
                <div className="form-group">
                  <label>Sandık Alanı (Okul)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Örn: Yunus Emre İlkokulu"
                  />
                </div>
                <div className="form-group">
                  <label>Sandık No</label>
                  <input
                    type="text"
                    className="form-control"
                    value={ballotNo}
                    onChange={(e) => setBallotNo(e.target.value)}
                    placeholder="Örn: 1045"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Görev Rolü</label>
                <select
                  className="form-control"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="GOREVSIZ">Görevsiz</option>
                  <option value="ASIL_UYE">Asil Üye</option>
                  <option value="YEDEK_UYE">Yedek Üye</option>
                  <option value="MUSAHIT">Müşahit</option>
                  <option value="YEDEK_MUSAHIT">Yedek Müşahit</option>
                  <option value="OKUL_SORUMLUSU">Okul Sorumlusu</option>
                  <option value="OKUL_YARDIMCISI">Okul Sorumlu Yardımcısı</option>
                  <option value="AVUKAT">Avukat</option>
                  <option value="KURYE">Kurye</option>
                  <option value="BILISIM">Bilişim Sorumlusu</option>
                  <option value="BOLGE_MAHALLE">Bölge/Mahalle Sorumlusu</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingMember}
                style={{ width: '100%', marginTop: '16px' }}
              >
                <Save size={16} />
                <span>Değişiklikleri Kaydet</span>
              </button>
            </form>
          ) : (
            /* Timeline View & Log Add Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
              
              {/* Add Interaction Log Form */}
              <form onSubmit={handleAddTimelineEvent} style={{ 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-lg)', 
                padding: '20px' 
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '16px', color: 'var(--text-main)' }}>
                  Yeni İşlem Ekle
                </h4>
                <div className="grid-2-col" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>İşlem Türü</label>
                    <select
                      className="form-control"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="ARAMA">Telefon Araması</option>
                      <option value="SMS">SMS Gönderimi</option>
                      <option value="EPOSTA">E-posta</option>
                      <option value="YUZ_YUZE">Yüz Yüze Görüşme</option>
                      <option value="NOTE">Sistem/Durum Notu</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>İşlem Tarihi</label>
                    <input
                      type="date"
                      className="form-control"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Açıklama / Cevap</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                    placeholder="Görüşme sonucu ne oldu? (Örn: Görevi kabul etti, SMS gönderildi vb.)"
                    style={{ resize: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingEvent}
                  style={{ width: '100%', padding: '8px 16px' }}
                >
                  <Plus size={16} />
                  <span>Zaman Akışına Ekle</span>
                </button>
              </form>

              {/* Timeline List */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 className="drawer-section-title">Zaman Akışı</h4>
                
                {loadingTimeline ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    Yükleniyor...
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    Bu üyeyle ilgili henüz bir işlem yapılmadı.
                  </div>
                ) : (
                  <div className="timeline" style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                    {timelineEvents.map((event) => (
                      <div key={event.id} className={`timeline-item ${event.type}`}>
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="timeline-type-badge">{getEventLabel(event.type)}</span>
                              <span style={{ color: 'var(--text-dim)' }}>&middot;</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {event.user_name || 'Sistem'}
                              </span>
                            </span>
                            <span className="timeline-date" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={10} />
                              {event.date}
                            </span>
                          </div>
                          <div className="timeline-note">{event.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
