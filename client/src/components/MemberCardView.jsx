import React from 'react';
import { Phone, PhoneCall, MapPin, MessageSquarePlus, Clock, AlertCircle } from 'lucide-react';
import { formatPhone } from './MemberTable';

export function getStanceLabel(stance) {
  switch (stance) {
    case 'DESTEKLIYOR': return 'Destekliyor';
    case 'KARARSIZ': return 'Kararsız';
    case 'MESAFELI': return 'Mesafeli';
    default: return 'Henüz Görüşülmedi';
  }
}

export default function MemberCardView({ members, onSelectMember, onStanceChange }) {
  if (!members || members.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '60px 20px', 
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--border-color)',
        margin: '20px 0'
      }}>
        <AlertCircle size={32} style={{ marginBottom: '12px', color: 'var(--text-dim)' }} />
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Eşleşen üye bulunamadı.</div>
        <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
          Lütfen mahalle seçimini veya arama kriterinizi kontrol edin.
        </div>
      </div>
    );
  }

  return (
    <div className="member-card-list">
      {members.map((member) => {
        const cleanPhone = member.phone ? member.phone.replace(/\D/g, '') : '';
        const rawStance = member.vote_stance || 'BELIRTILMEDI';

        return (
          <div key={member.id} className="mobile-card">
            {/* Top Bar: Name & Mahalle */}
            <div className="mobile-card-header">
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onSelectMember(member)}>
                <div className="mobile-card-title">
                  {member.first_name} {member.last_name}
                </div>
                <div className="mobile-card-meta" style={{ marginTop: '4px' }}>
                  {member.neighborhood ? (
                    <span className="neighborhood-badge">
                      <MapPin size={10} />
                      {member.neighborhood}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.district}</span>
                  )}
                  <span className={`stance-badge ${rawStance}`}>
                    {getStanceLabel(rawStance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Call Action (Rock solid on mobile) */}
            {cleanPhone ? (
              <a 
                href={`tel:${cleanPhone}`} 
                className="btn-call-direct"
                onClick={(e) => e.stopPropagation()}
              >
                <PhoneCall size={18} />
                <span>{formatPhone(member.phone)} &mdash; Hemen Ara</span>
              </a>
            ) : (
              <div style={{ 
                padding: '10px', 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                borderRadius: 'var(--radius-md)', 
                color: 'var(--text-dim)', 
                fontSize: '13px',
                textAlign: 'center' 
              }}>
                Telefon numarası kayıtlı değil
              </div>
            )}

            {/* 4-Stance Quick Selection Buttons */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Seçmen İntibası (Tek Tıkla Seç)
              </div>
              <div className="stance-button-group">
                <button
                  type="button"
                  className={`stance-btn ${rawStance === 'DESTEKLIYOR' ? 'active DESTEKLIYOR' : ''}`}
                  onClick={() => onStanceChange(member.id, 'DESTEKLIYOR')}
                >
                  <span style={{ fontSize: '14px' }}>🟢</span>
                  <span>Destekliyor</span>
                </button>

                <button
                  type="button"
                  className={`stance-btn ${rawStance === 'KARARSIZ' ? 'active KARARSIZ' : ''}`}
                  onClick={() => onStanceChange(member.id, 'KARARSIZ')}
                >
                  <span style={{ fontSize: '14px' }}>🟡</span>
                  <span>Kararsız</span>
                </button>

                <button
                  type="button"
                  className={`stance-btn ${rawStance === 'MESAFELI' ? 'active MESAFELI' : ''}`}
                  onClick={() => onStanceChange(member.id, 'MESAFELI')}
                >
                  <span style={{ fontSize: '14px' }}>🔴</span>
                  <span>Mesafeli</span>
                </button>

                <button
                  type="button"
                  className={`stance-btn ${rawStance === 'BELIRTILMEDI' ? 'active BELIRTILMEDI' : ''}`}
                  onClick={() => onStanceChange(member.id, 'BELIRTILMEDI')}
                >
                  <span style={{ fontSize: '14px' }}>⚪</span>
                  <span>Görüşülmedi</span>
                </button>
              </div>
            </div>

            {/* Note Preview & Last Action */}
            <div style={{ 
              backgroundColor: 'var(--bg-app)', 
              borderRadius: 'var(--radius-md)', 
              padding: '10px 12px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 12px', color: 'var(--text-dim)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} />
                  {member.latest_action_date || member.last_contact_date || 'Görüşme yok'}
                </span>
                {member.latest_action_user && (
                  <span>Sorumlu: <strong>{member.latest_action_user}</strong></span>
                )}
              </div>
              <div style={{ color: member.latest_note ? 'var(--text-main)' : 'var(--text-dim)', fontStyle: member.latest_note ? 'normal' : 'italic' }}>
                {member.latest_note ? member.latest_note : 'Henüz görüşme notu girilmemiş.'}
              </div>
            </div>

            {/* Action Buttons: Add Note / View History */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ 
                  flex: 1, 
                  justifyContent: 'center', 
                  padding: '10px', 
                  fontSize: '13px',
                  fontWeight: 600,
                  minHeight: '44px'
                }}
                onClick={() => onSelectMember(member)}
              >
                <MessageSquarePlus size={15} />
                <span>Görüşme / Not Ekle</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
