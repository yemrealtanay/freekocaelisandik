import React from 'react';
import { ArrowRight, Phone, MapPin, School, ClipboardList } from 'lucide-react';
import { formatPhone, getRoleLabel } from './MemberTable';

export default function MemberCardView({ members, onSelectMember, onRoleChange }) {
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
            <select
              className={`role-badge ${member.role}`}
              value={member.role}
              onChange={(e) => onRoleChange(member.id, e.target.value)}
              style={{
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'inherit',
                paddingRight: '22px',
                backgroundPosition: 'right 6px center',
                backgroundRepeat: 'no-repeat',
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b96a8' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundSize: '10px',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none'
              }}
            >
              <option value="GOREVSIZ" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}>Görevsiz</option>
              <option value="SANDIK_GOREVLISI" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}>Sandık Görevlisi</option>
              <option value="SANDIK_SORUMLUSU" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}>Sandık Sorumlusu</option>
              <option value="MUSAHIT" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}>Müşahit</option>
              <option value="YEDEK" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' }}>Yedek</option>
            </select>
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
