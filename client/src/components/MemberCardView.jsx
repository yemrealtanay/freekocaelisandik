import React from 'react';
import { ArrowRight, Phone, MapPin, School, ClipboardList } from 'lucide-react';
import { formatPhone, getRoleLabel } from './MemberTable';

export default function MemberCardView({ members, onSelectMember }) {
  if (!members || members.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
        Eşleşen üye bulunamadı.
      </div>
    );
  }

  return (
    <div className="card-grid">
      {members.map((member) => (
        <div key={member.id} className="member-card">
          <div className="card-header">
            <div className="card-title" onClick={() => onSelectMember(member)}>
              <h3>{member.first_name} {member.last_name}</h3>
              <span className="card-phone">{formatPhone(member.phone)}</span>
            </div>
            <span className={`role-badge ${member.role}`}>
              {getRoleLabel(member.role)}
            </span>
          </div>

          <div className="card-body">
            <div className="card-info-item">
              <span className="card-info-label">İlçe:</span>
              <span className="card-info-value">{member.district}</span>
            </div>
            <div className="card-info-item">
              <span className="card-info-label">Sandık Alanı:</span>
              <span className="card-info-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <School size={12} style={{ color: 'var(--text-dim)' }} />
                {member.school || '—'}
              </span>
            </div>
            <div className="card-info-item">
              <span className="card-info-label">Sandık No:</span>
              <span className="card-info-value">{member.ballot_no || '—'}</span>
            </div>
            <div className="card-info-item">
              <span className="card-info-label">TCKN:</span>
              <span className="card-info-value" style={{ fontFamily: 'monospace' }}>{member.tckn || '—'}</span>
            </div>
            {member.latest_note && (
              <div className="card-note">
                <strong>Son İşlem Notu:</strong> {member.latest_note}
              </div>
            )}
          </div>

          <div className="card-actions">
            <button className="btn btn-secondary" onClick={() => onSelectMember(member)} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <span>Profili İncele</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
