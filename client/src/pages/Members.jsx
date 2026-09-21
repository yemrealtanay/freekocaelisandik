import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { exportToCSV } from '../utils/export';
import MemberTable from '../components/MemberTable';
import MemberCardView from '../components/MemberCardView';
import MemberDetailDrawer from '../components/MemberDetailDrawer';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Download, Plus, Search, X, MapPin, CheckCircle2 } from 'lucide-react';

const PREDEFINED_DISTRICTS = [
  'Gölcük', 'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

const STANCE_FILTERS = [
  { id: 'TUM', label: 'Tüm İntibalar' },
  { id: 'GORUSULEN', label: 'Görüşülenler' },
  { id: 'DESTEKLIYOR', label: '🟢 Destekliyor' },
  { id: 'KARARSIZ', label: '🟡 Kararsız' },
  { id: 'MESAFELI', label: '🔴 Mesafeli' },
  { id: 'GELMEYECEK', label: '🟣 Gelmeyecek' },
  { id: 'BELIRTILMEDI', label: '⚪ Henüz Görüşülmedi' }
];

const VOTED_FILTERS = [
  { id: 'TUM', label: 'Tüm Oy Durumu' },
  { id: 'KULLANDI', label: '✅ Oy Kullananlar' },
  { id: 'KULLANMADI', label: '⏳ Oy Kullanmayanlar' }
];

export default function MembersPage({ currentUser, initialNeighborhood, initialStance, initialVotedStatus }) {
  const isAdmin = currentUser.role === 'ADMIN';
  const assignedNeighborhoods = currentUser.neighborhoods || [];
  const defaultNeighborhood = assignedNeighborhoods.length === 1 ? assignedNeighborhoods[0] : '';

  // Filters & State
  const [selectedDistrict, setSelectedDistrict] = useState(
    currentUser.district || 'Gölcük'
  );
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(
    initialNeighborhood || defaultNeighborhood || 'TUM'
  );
  const [selectedStance, setSelectedStance] = useState(initialStance || 'TUM');
  const [selectedVotedStatus, setSelectedVotedStatus] = useState(initialVotedStatus || 'TUM');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Desktop view preference; on mobile the card view is always enforced
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState('Tablo');
  const effectiveViewMode = isMobile ? 'Kart' : viewMode;
  
  // Data State
  const [members, setMembers] = useState([]);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals & Panels State
  const [selectedMember, setSelectedMember] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // New member form state
  const [sno, setSno] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhoodInput, setNeighborhoodInput] = useState(defaultNeighborhood);
  const [createVoteStance, setCreateVoteStance] = useState('BELIRTILMEDI');
  const [createDistrict, setCreateDistrict] = useState(selectedDistrict);
  const [submittingMember, setSubmittingMember] = useState(false);

  // Load neighborhoods when selectedDistrict changes
  useEffect(() => {
    fetchNeighborhoods();
  }, [selectedDistrict]);

  // Fetch members when filters change
  useEffect(() => {
    fetchMembers();
  }, [selectedDistrict, selectedNeighborhood, selectedStance, selectedVotedStatus, searchQuery]);

  // Sync create district whenever active district changes
  useEffect(() => {
    setCreateDistrict(selectedDistrict);
  }, [selectedDistrict]);

  const fetchNeighborhoods = async () => {
    try {
      const data = await api.members.getNeighborhoods(selectedDistrict);
      setNeighborhoods(data);
    } catch (err) {
      console.error('Mahalleler yüklenemedi:', err);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.members.list({
        district: selectedDistrict,
        neighborhood: selectedNeighborhood,
        vote_stance: selectedStance,
        voted_status: selectedVotedStatus,
        search: searchQuery
      });
      setMembers(data.members || []);
      setDisplayedCount(data.displayedCount || 0);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error(err);
      setErrorMsg('Üye listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  // Instant 1-tap voting toggle handler with optimistic UI update
  const handleToggleVote = async (memberId) => {
    setMembers(prevMembers =>
      prevMembers.map(m => {
        if (m.id === memberId) {
          const nextVoted = m.has_voted === 1 ? 0 : 1;
          return {
            ...m,
            has_voted: nextVoted,
            voted_at: nextVoted === 1 ? new Date().toISOString() : null
          };
        }
        return m;
      })
    );

    try {
      await api.members.toggleVote(memberId);
    } catch (err) {
      setErrorMsg(err.message || 'Oy durumu güncellenemedi.');
      fetchMembers(); // rollback on error
    }
  };

  // Inline stance change handler with optimistic UI update
  const handleStanceChangeInline = async (memberId, newStance) => {
    setMembers(prevMembers =>
      prevMembers.map(m => {
        if (m.id === memberId) {
          return {
            ...m,
            vote_stance: newStance,
            contact_status: newStance === 'BELIRTILMEDI' ? 'GORUSULMEDI' : 'GORUSULDU',
            last_contact_date: new Date().toISOString().split('T')[0]
          };
        }
        return m;
      })
    );

    try {
      await api.members.update(memberId, { 
        vote_stance: newStance,
        contact_status: newStance === 'BELIRTILMEDI' ? 'GORUSULMEDI' : 'GORUSULDU'
      });
    } catch (err) {
      setErrorMsg(err.message || 'Seçmen intibası güncellenemedi.');
      fetchMembers(); // rollback on error
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      setErrorMsg('Ad ve Soyad alanları zorunludur.');
      return;
    }

    setSubmittingMember(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.create({
        sno: sno ? parseInt(sno, 10) : null,
        first_name: firstName,
        last_name: lastName,
        phone,
        neighborhood: neighborhoodInput,
        vote_stance: createVoteStance,
        district: isAdmin ? createDistrict : currentUser.district
      });
      
      setSuccessMsg('Yeni üye başarıyla sisteme kaydedildi.');
      setCreateModalOpen(false);
      
      // Reset form
      setSno('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setNeighborhoodInput(defaultNeighborhood);
      setCreateVoteStance('BELIRTILMEDI');
      
      fetchMembers();
      fetchNeighborhoods();
    } catch (err) {
      setErrorMsg(err.message || 'Üye kaydedilemedi.');
    } finally {
      setSubmittingMember(false);
    }
  };

  const createNeighborhoodOptions = assignedNeighborhoods.length
    ? assignedNeighborhoods
    : neighborhoods.map(n => n.neighborhood);

  const handleExport = () => {
    exportToCSV(members, `${selectedDistrict}_${selectedNeighborhood !== 'TUM' ? selectedNeighborhood : 'Tum_Mahalleler'}`);
  };

  // Calculate live voting statistics on currently filtered list
  const currentVotedCount = members.filter(m => m.has_voted === 1).length;
  const currentVotingRate = displayedCount > 0 ? Math.round((currentVotedCount / displayedCount) * 100) : 0;

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-area">
          <div className="page-title">
            <span>Saha Üye Listesi</span>
            {isAdmin ? (
              <select
                className="district-select-dropdown"
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedNeighborhood('TUM');
                }}
              >
                {PREDEFINED_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="district-badge">{selectedDistrict}</span>
            )}
          </div>
          <span className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Toplam: <strong>{totalCount}</strong> üye</span>
            <span>&bull;</span>
            <span>Listelenen: <strong>{displayedCount}</strong> üye</span>
            <span>&bull;</span>
            <span style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.15)', 
              color: '#34d399', 
              padding: '2px 8px', 
              borderRadius: 'var(--radius-sm)', 
              fontWeight: 600,
              fontSize: '12px'
            }}>
              🗳️ Oy Kullanan: {currentVotedCount} / {displayedCount} (%{currentVotingRate})
            </span>
          </span>
        </div>
        
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExport} disabled={members.length === 0} title="Excel / CSV olarak dışa aktar" aria-label="Excel İndir">
            <Download size={16} />
            <span className="btn-label">Excel İndir</span>
          </button>
          <button className="btn btn-primary hide-on-mobile" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            <span>Yeni Üye Ekle</span>
          </button>
        </div>
      </div>

      {/* Mobile floating action button */}
      <button className="fab" onClick={() => setCreateModalOpen(true)} aria-label="Yeni Üye Ekle">
        <Plus size={24} />
      </button>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      {/* Filter and Search Section */}
      <div className="filter-bar">
        
        {/* Row 1: Search + Neighborhood Dropdown + View Switcher */}
        <div className="search-and-view">
          {/* Search Box */}
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              className="form-control search-input"
              placeholder="Sıra No, İsim veya Telefon ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mahalle Selector */}
          <div className="filter-select-wrap">
            <select
              className="form-control"
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              style={{
                borderColor: selectedNeighborhood !== 'TUM' ? 'var(--primary)' : 'var(--border-color)',
                fontWeight: selectedNeighborhood !== 'TUM' ? 600 : 400
              }}
            >
              <option value="TUM">
                {assignedNeighborhoods.length ? 'Atanan Tüm Mahalleler' : 'Tüm Mahalleler'} ({neighborhoods.length})
              </option>
              {neighborhoods.map((n) => (
                <option key={n.neighborhood} value={n.neighborhood}>
                  {n.neighborhood} ({n.count})
                </option>
              ))}
            </select>
          </div>

          {/* View Switcher: Kart / Tablo (desktop only, mobile is always Kart) */}
          {!isMobile && (
            <div className="view-switcher" style={{ flexShrink: 0 }}>
              {['Kart', 'Tablo'].map((mode) => (
                <button
                  key={mode}
                  className={`view-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Election Day Voting Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            🗳️ Seçim Günü:
          </span>
          <div className="tag-filters" style={{ display: 'inline-flex', gap: '6px' }}>
            {VOTED_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`filter-tag ${selectedVotedStatus === filter.id ? 'active' : ''}`}
                onClick={() => setSelectedVotedStatus(filter.id)}
                style={{
                  backgroundColor: selectedVotedStatus === filter.id && filter.id === 'KULLANDI' ? 'rgba(16, 185, 129, 0.25)' : undefined,
                  borderColor: selectedVotedStatus === filter.id && filter.id === 'KULLANDI' ? '#10b981' : undefined,
                  color: selectedVotedStatus === filter.id && filter.id === 'KULLANDI' ? '#34d399' : undefined
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Stance Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            Saha İntibası:
          </span>
          <div className="tag-filters" style={{ display: 'inline-flex', gap: '6px' }}>
            {STANCE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`filter-tag ${selectedStance === filter.id ? 'active' : ''}`}
                onClick={() => setSelectedStance(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '36px', textAlign: 'center' }}>
          Üyeler yükleniyor...
        </div>
      ) : (
        <>
          {effectiveViewMode === 'Kart' && (
            <MemberCardView
              members={members}
              onSelectMember={setSelectedMember}
              onStanceChange={handleStanceChangeInline}
              onToggleVote={handleToggleVote}
            />
          )}

          {effectiveViewMode === 'Tablo' && (
            <MemberTable 
              members={members} 
              onSelectMember={setSelectedMember} 
              onStanceChange={handleStanceChangeInline}
              onToggleVote={handleToggleVote}
            />
          )}
        </>
      )}

      {/* Member Details Drawer (Timeline, Call, Quick Note) */}
      {selectedMember && (
        <MemberDetailDrawer
          member={selectedMember}
          onClose={() => {
            setSelectedMember(null);
            fetchMembers();
          }}
          onUpdateSuccess={fetchMembers}
        />
      )}

      {/* Manual Member Creation Modal */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="sheet-handle" />
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Yeni Saha Üyesi Ekle</h3>
              <button className="drawer-close" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMember}>
              <div className="modal-body">
                
                {isAdmin && (
                  <div className="form-group">
                    <label>Hedef İlçe</label>
                    <select
                      className="form-control"
                      value={createDistrict}
                      onChange={(e) => setCreateDistrict(e.target.value)}
                    >
                      {PREDEFINED_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid-2-col">
                  <div className="form-group">
                    <label>Sıra No (SNo)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Örn: 154"
                      value={sno}
                      onChange={(e) => setSno(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Mahalle <span style={{ color: 'var(--danger)' }}>*</span></label>
                    {createNeighborhoodOptions.length > 0 ? (
                      <select
                        className="form-control"
                        value={neighborhoodInput}
                        onChange={(e) => setNeighborhoodInput(e.target.value)}
                        required
                      >
                        <option value="">-- Mahalle Seçin --</option>
                        {createNeighborhoodOptions.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Örn: DEĞİRMENDERE MERKEZ MAH."
                        value={neighborhoodInput}
                        onChange={(e) => setNeighborhoodInput(e.target.value)}
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="grid-2-col">
                  <div className="form-group">
                    <label>Ad <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ahmet"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Soyad <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Demir"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="05XX XXX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Seçmen İntibası</label>
                  <select
                    className="form-control"
                    value={createVoteStance}
                    onChange={(e) => setCreateVoteStance(e.target.value)}
                  >
                    <option value="BELIRTILMEDI">⚪ Henüz Görüşülmedi</option>
                    <option value="DESTEKLIYOR">🟢 Destekliyor</option>
                    <option value="KARARSIZ">🟡 Kararsız</option>
                    <option value="MESAFELI">🔴 Mesafeli</option>
                    <option value="GELMEYECEK">🟣 Oy Vermeye Gelmeyecek</option>
                  </select>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingMember}>
                  {submittingMember ? 'Kaydediliyor...' : 'Üyeyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
