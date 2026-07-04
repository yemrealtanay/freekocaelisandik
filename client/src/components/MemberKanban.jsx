import React from 'react';
import { formatPhone, getRoleLabel } from './MemberTable';
import { Phone, Calendar, ArrowRight } from 'lucide-react';

const COLUMNS = [
  { id: 'GOREVSIZ', label: 'Görevsiz', class: 'GOREVSIZ' },
  { id: 'ASIL_UYE', label: 'Asil Üye', class: 'ASIL_UYE' },
  { id: 'YEDEK_UYE', label: 'Yedek Üye', class: 'YEDEK_UYE' },
  { id: 'MUSAHIT', label: 'Müşahit', class: 'MUSAHIT' },
  { id: 'YEDEK_MUSAHIT', label: 'Yedek Müşahit', class: 'YEDEK_MUSAHIT' },
  { id: 'OKUL_SORUMLUSU', label: 'Okul Sorumlusu', class: 'OKUL_SORUMLUSU' },
  { id: 'OKUL_YARDIMCISI', label: 'Okul Sorumlu Yrd.', class: 'OKUL_YARDIMCISI' },
  { id: 'AVUKAT', label: 'Avukat', class: 'AVUKAT' },
  { id: 'KURYE', label: 'Kurye', class: 'KURYE' },
  { id: 'BILISIM', label: 'Bilişim Sorumlusu', class: 'BILISIM' },
  { id: 'BOLGE_MAHALLE', label: 'Bölge/Mahalle Sorumlusu', class: 'BOLGE_MAHALLE' }
];

export default function MemberKanban({ members, onSelectMember, onRoleChange }) {
  
  const handleDragStart = (e, memberId) => {
    e.dataTransfer.setData('text/plain', memberId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetRole) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('text/plain');
    if (memberId) {
      onRoleChange(memberId, targetRole);
    }
  };

  // Group members by role
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = members.filter((m) => m.role === col.id);
    return acc;
  }, {});

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const columnMembers = grouped[col.id] || [];
        return (
          <div
            key={col.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              <div className="kanban-column-title">
                <span className={`role-badge ${col.class}`} style={{ border: 'none', padding: '0' }}>
                  &bull;
                </span>
                <span>{col.label}</span>
              </div>
              <span className="kanban-column-count">{columnMembers.length}</span>
            </div>

            <div className="kanban-cards-container">
              {columnMembers.map((member) => (
                <div
                  key={member.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, member.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 className="kanban-card-title">{member.first_name} {member.last_name}</h4>
                    <span 
                      className="detail-link" 
                      onClick={() => onSelectMember(member)}
                      style={{ cursor: 'pointer' }}
                    >
                      <ArrowRight size={12} />
                    </span>
                  </div>
                  
                  <div className="kanban-card-phone">
                    {member.phone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={10} />
                        {formatPhone(member.phone)}
                      </span>
                    ) : '—'}
                  </div>

                  <div className="kanban-card-footer">
                    <span style={{ fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {member.school || member.district}
                    </span>
                    {member.latest_action_date && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px' }}>
                        <Calendar size={8} />
                        {member.latest_action_date}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {columnMembers.length === 0 && (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  border: '1px dashed var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-dim)',
                  fontSize: '12px',
                  padding: '24px 12px',
                  textAlign: 'center'
                }}>
                  Buraya sürükleyin
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
