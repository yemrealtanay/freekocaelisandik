import React from 'react';
import { ArrowRight, Phone, MapPin, CheckCircle, Clock, CheckCircle2 } from 'lucide-react';

export function formatPhone(phone) {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `0${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
  }
  return phone;
}

export function getStanceLabel(stance) {
  switch (stance) {
    case 'DESTEKLIYOR': return 'Destekliyor';
    case 'KARARSIZ': return 'Kararsız';
    case 'MESAFELI': return 'Mesafeli';
    case 'GELMEYECEK': return 'Oy Vermeye Gelmeyecek';
    default: return 'Henüz Görüşülmedi';
  }
}

export default function MemberTable({ members, onSelectMember, onStanceChange, onToggleVote }) {
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
            <th style={{ width: '60px' }}>SNo</th>
            <th>Ad Soyad</th>
            <th>Telefon</th>
            <th>Mahalle</th>
            <th>Seçmen İntibası</th>
            <th style={{ textAlign: 'center' }}>🗳️ Seçim Günü Oy Durumu</th>
            <th>Görüşme Durumu</th>
            <th>Son Görüşme</th>
            <th style={{ textAlign: 'right' }}>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const rawStance = member.vote_stance || 'BELIRTILMEDI';
            const isContacted = member.contact_status === 'GORUSULDU' || (rawStance && rawStance !== 'BELIRTILMEDI');
            const isVoted = member.has_voted === 1;

            return (
              <tr key={member.id}>
                <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {member.sno ? `#${member.sno}` : '—'}
                </td>
                <td>
                  <div className="member-name-cell" onClick={() => onSelectMember(member)} style={{ cursor: 'pointer' }}>
                    <span className="member-fullname">
                      {member.first_name} {member.last_name}
                    </span>
                    <span className="member-note-preview">
                      {member.latest_note || 'Henüz görüşme notu yok'}
                    </span>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {member.phone ? (
                    <a 
                      href={`tel:${member.phone.replace(/\D/g, '')}`} 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none', fontWeight: 500 }}
                      title="Aramak için tıklayın"
                    >
                      <Phone size={13} style={{ color: '#10b981' }} />
                      {formatPhone(member.phone)}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  {member.neighborhood ? (
                    <span className="neighborhood-badge">
                      <MapPin size={11} />
                      {member.neighborhood}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{member.district}</span>
                  )}
                </td>
                <td>
                  <select
                    className={`stance-badge ${rawStance}`}
                    value={rawStance}
                    onChange={(e) => onStanceChange(member.id, e.target.value)}
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
                      appearance: 'none',
                      fontSize: '12px'
                    }}
                  >
                    <option value="DESTEKLIYOR" style={{ backgroundColor: 'var(--bg-surface)', color: '#34d399' }}>🟢 Destekliyor</option>
                    <option value="KARARSIZ" style={{ backgroundColor: 'var(--bg-surface)', color: '#fbbf24' }}>🟡 Kararsız</option>
                    <option value="MESAFELI" style={{ backgroundColor: 'var(--bg-surface)', color: '#f87171' }}>🔴 Mesafeli</option>
                    <option value="GELMEYECEK" style={{ backgroundColor: 'var(--bg-surface)', color: '#c084fc' }}>🟣 Oy Vermeye Gelmeyecek</option>
                    <option value="BELIRTILMEDI" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>⚪ Henüz Görüşülmedi</option>
                  </select>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className={`voted-toggle-btn ${isVoted ? 'voted' : 'not-voted'}`}
                    onClick={() => onToggleVote && onToggleVote(member.id)}
                    title={isVoted ? 'Oy durumunu geri al' : 'Sandıkta oy kullandı olarak işaretle'}
                  >
                    {isVoted ? (
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
                </td>
                <td>
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isContacted ? 'var(--success)' : 'var(--text-dim)'
                  }}>
                    <CheckCircle size={13} style={{ color: isContacted ? 'var(--success)' : 'var(--text-dim)' }} />
                    {isContacted ? 'Görüşüldü' : 'Görüşülmedi'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {member.latest_action_date || member.last_contact_date || '—'}
                    </span>
                    {member.latest_action_user && (
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {member.latest_action_user}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => onSelectMember(member)}
                  >
                    <span>Görüşme / Detay</span>
                    <ArrowRight size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
