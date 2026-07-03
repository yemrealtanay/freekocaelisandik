import React from 'react';
import { ArrowRight, Phone, Home } from 'lucide-react';

export function formatPhone(phone) {
  if (!phone) return '-';
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // 534 371 06 54
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `0${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }
  return phone;
}

export function getRoleLabel(role) {
  switch (role) {
    case 'GOREVSIZ': return 'Görevsiz';
    case 'MUSAHIT': return 'Müşahit';
    case 'SANDIK_GOREVLISI': return 'Sandık Görevlisi';
    case 'SANDIK_SORUMLUSU': return 'Sandık Sorumlusu';
    case 'YEDEK': return 'Yedek';
    default: return role;
  }
}

export default function MemberTable({ members, onSelectMember, onRoleChange }) {
  if (!members || members.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
        Eşleşen üye bulunamadı.
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="custom-table">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Telefon</th>
            <th>Adres / Sandık Bilgisi</th>
            <th>Rol</th>
            <th>Son İşlem</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const address = member.school 
              ? `${member.school}${member.ballot_no ? ` (Sandık: ${member.ballot_no})` : ''}` 
              : `${member.district}`;
            
            return (
              <tr key={member.id}>
                <td>
                  <div className="member-name-cell" onClick={() => onSelectMember(member)}>
                    <span className="member-fullname">
                      {member.first_name} {member.last_name}
                    </span>
                    <span className="member-note-preview">
                      {member.latest_note || 'Henüz not yok'}
                    </span>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {member.phone ? (
                    <a href={`tel:${member.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none' }}>
                      <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                      {formatPhone(member.phone)}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                    <Home size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px' }}>{address}</span>
                  </div>
                </td>
                <td>
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
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  {member.latest_action_date || '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="detail-link" onClick={() => onSelectMember(member)}>
                    Detay <ArrowRight size={14} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
