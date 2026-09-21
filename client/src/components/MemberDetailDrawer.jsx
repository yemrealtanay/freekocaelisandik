import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Save, Plus, Phone, Calendar, User, FileText, CheckCircle2, Trash2, PhoneCall, MapPin, MessageSquare, Check } from 'lucide-react';
import { api } from '../utils/api';
import { formatPhone } from './MemberTable';

export function getStanceLabel(stance) {
  switch (stance) {
    case 'DESTEKLIYOR': return 'Destekliyor';
    case 'KARARSIZ': return 'Kararsız';
    case 'MESAFELI': return 'Mesafeli';
    case 'GELMEYECEK': return 'Oy Vermeye Gelmeyecek';
    default: return 'Henüz Görüşülmedi';
  }
}

export default function MemberDetailDrawer({ member, onClose, onUpdateSuccess }) {
  const [activeSubTab, setActiveSubTab] = useState('timeline'); // 'timeline' or 'edit'
  
  // Member edit form state
  const [sno, setSno] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [voteStance, setVoteStance] = useState('BELIRTILMEDI');
  const [contactStatus, setContactStatus] = useState('GORUSULMEDI');
  const [hasVoted, setHasVoted] = useState(0);
  const [votedAt, setVotedAt] = useState(null);
  
  // Timeline events state
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // New interaction form state
  const [eventType, setEventType] = useState('ARAMA');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventStance, setEventStance] = useState('BELIRTILMEDI');
  const [eventNote, setEventNote] = useState('');
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [submittingMember, setSubmittingMember] = useState(false);
  const [togglingVote, setTogglingVote] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset states when member changes
  useEffect(() => {
    if (member) {
      setSno(member.sno || '');
      setFirstName(member.first_name || '');
      setLastName(member.last_name || '');
      setPhone(member.phone || '');
      setNeighborhood(member.neighborhood || '');
      setVoteStance(member.vote_stance || 'BELIRTILMEDI');
      setContactStatus(member.contact_status || 'GORUSULMEDI');
      setHasVoted(member.has_voted || 0);
      setVotedAt(member.voted_at || null);
      setEventStance(member.vote_stance || 'BELIRTILMEDI');
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
      setErrorMsg('Görüşme geçmişi yüklenemedi.');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleToggleVoteDirect = async () => {
    if (!member || togglingVote) return;
    setTogglingVote(true);
    setErrorMsg('');
    try {
      const res = await api.members.toggleVote(member.id);
      setHasVoted(res.member.has_voted);
      setVotedAt(res.member.voted_at);
      setSuccessMsg(res.message);
      if (onUpdateSuccess) onUpdateSuccess();
      fetchTimeline();
    } catch (err) {
      setErrorMsg(err.message || 'Oy durumu güncellenemedi.');
    } finally {
      setTogglingVote(false);
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
        sno: sno ? parseInt(sno, 10) : null,
        first_name: firstName,
        last_name: lastName,
        phone,
        neighborhood,
        vote_stance: voteStance,
        contact_status: contactStatus,
        has_voted: hasVoted
      });
      setSuccessMsg('Üye bilgileri başarıyla güncellendi.');
      onUpdateSuccess();
      fetchTimeline();
    } catch (err) {
      setErrorMsg(err.message || 'Güncelleme sırasında hata oluştu.');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!window.confirm(`${firstName} ${lastName} isimli üyeyi sistemden silmek istediğinize emin misiniz?`)) {
      return;
    }
    setSubmittingMember(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.delete(member.id);
      onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Üye silinirken bir hata oluştu.');
      setSubmittingMember(false);
    }
  };

  const handleAddTimelineEvent = async (e) => {
    e.preventDefault();
    if (!eventNote.trim()) {
      setErrorMsg('Lütfen görüşme notunu girin.');
      return;
    }
    setSubmittingEvent(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.update(member.id, {
        vote_stance: eventStance,
        contact_status: 'GORUSULDU',
        note: eventNote,
        interaction_type: eventType
      });

      setEventNote('');
      setVoteStance(eventStance);
      setContactStatus('GORUSULDU');
      setSuccessMsg('Görüşme başarıyla kaydedildi.');
      fetchTimeline();
      onUpdateSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Görüşme kaydedilemedi.');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'ARAMA': return <Phone size={13} />;
      case 'SMS': return <FileText size={13} />;
      case 'YUZ_YUZE': case 'ZIYARET': return <User size={13} />;
      case 'DURUM_DEGISIKLIGI': return <CheckCircle2 size={13} />;
      case 'SECIM_OYU': return <Check size={13} />;
      default: return <MessageSquare size={13} />;
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case 'ARAMA': return 'Telefon Araması';
      case 'SMS': return 'SMS Gönderimi';
      case 'YUZ_YUZE': return 'Yüz Yüze Görüşme';
      case 'ZIYARET': return 'Ev / İşyeri Ziyareti';
      case 'DURUM_DEGISIKLIGI': return 'İntiba Değişimi';
      case 'SECIM_OYU': return 'Seçim Günü Oy Takibi';
      case 'SISTEM': case 'SYSTEM': return 'Sistem Kaydı';
      default: return 'Görüşme Notu';
    }
  };

  if (!member) return null;

  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Top Header */}
        <div className="drawer-header">
          <button className="drawer-back mobile-only" onClick={onClose} aria-label="Geri">
            <ArrowLeft size={20} />
          </button>
          <div className="drawer-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {sno && <span className="sno-badge">#{sno}</span>}
              <div className="drawer-title">{firstName} {lastName}</div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {neighborhood && (
                <span className="neighborhood-badge">
                  <MapPin size={10} />
                  {neighborhood}
                </span>
              )}
              <span className={`stance-badge ${voteStance}`}>
                {getStanceLabel(voteStance)}
              </span>
            </div>
          </div>
          <button className="drawer-close hide-on-mobile" onClick={onClose} title="Kapat">
            <X size={20} />
          </button>
        </div>

        {/* Quick Call Bar on Mobile */}
        {cleanPhone && (
          <div className="drawer-call-bar">
            <a 
              href={`tel:${cleanPhone}`} 
              className="btn-call-direct"
            >
              <PhoneCall size={18} />
              <span>{formatPhone(phone)} &mdash; Hemen Ara</span>
            </a>
          </div>
        )}

        {/* Election Day Fast Toggle Bar */}
        <div style={{
          margin: '0 20px 14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: hasVoted === 1 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
          border: hasVoted === 1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: hasVoted === 1 ? '#34d399' : 'var(--text-main)' }}>
              🗳️ Seçim Günü Sandık Takibi
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {hasVoted === 1 
                ? (votedAt ? `Oy kullandı (${new Date(votedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})` : 'Sandıkta oy kullandı')
                : 'Henüz oy kullanmadı'}
            </div>
          </div>
          <button
            type="button"
            className={`voted-toggle-btn ${hasVoted === 1 ? 'voted' : 'not-voted'}`}
            onClick={handleToggleVoteDirect}
            disabled={togglingVote}
            title={hasVoted === 1 ? 'Oyu geri al' : 'Oy kullandı olarak işaretle'}
          >
            {hasVoted === 1 ? (
              <>
                <CheckCircle2 size={14} />
                <span>Oy Kullandı</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '13px' }}>⏳</span>
                <span>Oy Kullanmadı</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Swapping inside Drawer */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab ${activeSubTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('timeline')}
          >
            Görüşmeler & Notlar
          </button>
          <button
            type="button"
            className={`drawer-tab ${activeSubTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('edit')}
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
              <h4 className="drawer-section-title">Üye Bilgileri</h4>
              
              <div className="grid-2-col">
                <div className="form-group">
                  <label>Sıra No (SNo)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={sno}
                    onChange={(e) => setSno(e.target.value)}
                    placeholder="Örn: 27"
                  />
                </div>
                <div className="form-group">
                  <label>Mahalle</label>
                  <input
                    type="text"
                    className="form-control"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Örn: DEĞİRMENDERE MERKEZ MAH."
                    required
                  />
                </div>
              </div>

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

              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </div>

              <div className="grid-2-col">
                <div className="form-group">
                  <label>Seçmen İntibası</label>
                  <select
                    className="form-control"
                    value={voteStance}
                    onChange={(e) => setVoteStance(e.target.value)}
                  >
                    <option value="DESTEKLIYOR">🟢 Destekliyor</option>
                    <option value="KARARSIZ">🟡 Kararsız</option>
                    <option value="MESAFELI">🔴 Mesafeli</option>
                    <option value="GELMEYECEK">🟣 Oy Vermeye Gelmeyecek</option>
                    <option value="BELIRTILMEDI">⚪ Henüz Görüşülmedi</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Görüşme Durumu</label>
                  <select
                    className="form-control"
                    value={contactStatus}
                    onChange={(e) => setContactStatus(e.target.value)}
                  >
                    <option value="GORUSULDU">Görüşüldü</option>
                    <option value="GORUSULMEDI">Görüşülmedi</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Seçim Günü Oy Durumu</label>
                <select
                  className="form-control"
                  value={hasVoted}
                  onChange={(e) => setHasVoted(parseInt(e.target.value, 10))}
                >
                  <option value={0}>⏳ Oy Kullanmadı</option>
                  <option value={1}>✅ Oy Kullandı</option>
                </select>
              </div>

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingMember}
                  style={{ flex: 1, minHeight: '44px' }}
                >
                  <Save size={16} />
                  <span>Değişiklikleri Kaydet</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteMember}
                  disabled={submittingMember}
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  <Trash2 size={16} />
                  <span>Sil</span>
                </button>
              </div>
            </form>
          ) : (
            /* Timeline & Interaction Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Add Interaction Log Form */}
              <form onSubmit={handleAddTimelineEvent} style={{ 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-lg)', 
                padding: '18px' 
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px', color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                  Yeni Görüşme Kaydet
                </h4>

                <div className="grid-2-col" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>İşlem / Görüşme Türü</label>
                    <select
                      className="form-control"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="ARAMA">Telefon Araması</option>
                      <option value="YUZ_YUZE">Yüz Yüze Görüşme</option>
                      <option value="ZIYARET">Ev / İşyeri Ziyareti</option>
                      <option value="SMS">SMS Gönderimi</option>
                      <option value="NOT">Genel Not</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Görüşme Tarihi</label>
                    <input
                      type="date"
                      className="form-control"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Bu Görüşme Sonucu Seçmen İntibası</label>
                  <select
                    className="form-control"
                    value={eventStance}
                    onChange={(e) => setEventStance(e.target.value)}
                    style={{ padding: '8px 12px', fontWeight: 600 }}
                  >
                    <option value="DESTEKLIYOR">🟢 Destekliyor</option>
                    <option value="KARARSIZ">🟡 Kararsız</option>
                    <option value="MESAFELI">🔴 Mesafeli</option>
                    <option value="GELMEYECEK">🟣 Oy Vermeye Gelmeyecek</option>
                    <option value="BELIRTILMEDI">⚪ Henüz Görüşülmedi / Bilinmiyor</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Görüşme Notu / Detay</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                    placeholder="Görüşmede neler konuşuldu? Üyenin yaklaşımı nedir?"
                    style={{ resize: 'vertical' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingEvent}
                  style={{ width: '100%', padding: '12px', justifyContent: 'center', minHeight: '44px', fontWeight: 600 }}
                >
                  <Plus size={16} />
                  <span>{submittingEvent ? 'Kaydediliyor...' : 'Görüşmeyi Kaydet'}</span>
                </button>
              </form>

              {/* Timeline List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h4 className="drawer-section-title">Görüşme Geçmişi ({timelineEvents.length})</h4>
                
                {loadingTimeline ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    Görüşme geçmişi yükleniyor...
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: 'var(--text-dim)', 
                    padding: '32px 16px', 
                    border: '1px dashed var(--border-color)', 
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px'
                  }}>
                    Bu üyeyle ilgili henüz bir görüşme kaydı girilmemiş.
                  </div>
                ) : (
                  <div className="timeline" style={{ paddingRight: '4px' }}>
                    {timelineEvents.map((event) => (
                      <div key={event.id} className={`timeline-item ${event.type}`}>
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span className="timeline-type-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {getEventIcon(event.type)}
                                {getEventLabel(event.type)}
                              </span>
                              <span style={{ color: 'var(--text-dim)' }}>&middot;</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {event.user_name || 'Sistem'}
                              </span>
                            </span>
                            <span className="timeline-date" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={11} />
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
