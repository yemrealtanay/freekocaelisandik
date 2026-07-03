import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { exportToCSV } from '../utils/export';
import MemberTable from '../components/MemberTable';
import MemberCardView from '../components/MemberCardView';
import MemberKanban from '../components/MemberKanban';
import MemberDetailDrawer from '../components/MemberDetailDrawer';
import { Download, Plus, Search, View, X, MapPin, AlertCircle } from 'lucide-react';

const PREDEFINED_DISTRICTS = [
  'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'Gölcük', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

const ROLES = [
  { id: 'TUM', label: 'Tümü' },
  { id: 'SANDIK_GOREVLISI', label: 'Sandık Görevlisi' },
  { id: 'SANDIK_SORUMLUSU', label: 'Sandık Sorumlusu' },
  { id: 'MUSAHIT', label: 'Müşahit' },
  { id: 'YEDEK', label: 'Yedek' },
  { id: 'GOREVSIZ', label: 'Görevsiz' }
];

export default function MembersPage({ currentUser }) {
  const isAdmin = currentUser.role === 'ADMIN';

  // Filters & State
  const [selectedDistrict, setSelectedDistrict] = useState(
    isAdmin ? PREDEFINED_DISTRICTS[0] : currentUser.district
  );
  const [selectedRole, setSelectedRole] = useState('TUM');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('Tablo'); // Tablo, Kart, Kanban
  
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
  const [tckn, setTckn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');
  const [ballotNo, setBallotNo] = useState('');
  const [role, setRole] = useState('GOREVSIZ');
  const [createDistrict, setCreateDistrict] = useState(selectedDistrict);
  const [submittingMember, setSubmittingMember] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [selectedDistrict, selectedRole, searchQuery]);

  // Sync create district whenever active district changes
  useEffect(() => {
    setCreateDistrict(selectedDistrict);
  }, [selectedDistrict]);

  const fetchMembers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.members.list({
        district: selectedDistrict,
        role: selectedRole,
        search: searchQuery
      });
      setMembers(data.members);
      setDisplayedCount(data.displayedCount);
      setTotalCount(data.totalCount);
    } catch (err) {
      console.error(err);
      setErrorMsg('Üye listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChangeInline = async (memberId, newRole) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.members.update(memberId, { role: newRole });
      setSuccessMsg('Üyenin görev durumu başarıyla güncellendi.');
      fetchMembers();
    } catch (err) {
      setErrorMsg(err.message || 'Görev durumu güncellenemedi.');
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
        tckn,
        first_name: firstName,
        last_name: lastName,
        phone,
        school,
        ballot_no: ballotNo,
        role,
        district: isAdmin ? createDistrict : currentUser.district
      });
      
      setSuccessMsg('Üye başarıyla kaydedildi.');
      setCreateModalOpen(false);
      
      // Reset form
      setTckn('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setSchool('');
      setBallotNo('');
      setRole('GOREVSIZ');
      
      fetchMembers();
    } catch (err) {
      setErrorMsg(err.message || 'Üye kaydedilemedi.');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleExport = () => {
    exportToCSV(members, selectedDistrict);
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="page-header">
        <div className="page-title-area">
          <div className="page-title">
            <span>Üyeler</span>
            {isAdmin ? (
              <select
                className="district-select-dropdown"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {PREDEFINED_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="district-badge">{selectedDistrict}</span>
            )}
          </div>
          <span className="page-subtitle">
            {totalCount} üye arasından {displayedCount} üye listeleniyor
          </span>
        </div>
        
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExport} disabled={members.length === 0}>
            <Download size={16} />
            <span>CSV / Excel İndir</span>
          </button>
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            <span>Üye Ekle</span>
          </button>
        </div>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      {/* Filter and Search Section */}
      <div className="filter-bar">
        
        <div className="search-and-view">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-control search-input"
              placeholder="İsim veya telefon ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="view-switcher">
            {['Tablo', 'Kart', 'Kanban'].map((mode) => (
              <button
                key={mode}
                className={`view-btn ${viewMode === mode ? 'active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Tag Filters */}
        <div className="tag-filters">
          {ROLES.map((roleOpt) => (
            <button
              key={roleOpt.id}
              className={`filter-tag ${selectedRole === roleOpt.id ? 'active' : ''}`}
              onClick={() => setSelectedRole(roleOpt.id)}
            >
              {roleOpt.label}
            </button>
          ))}
        </div>

      </div>

      {/* Views */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '24px' }}>Yükleniyor...</div>
      ) : (
        <>
          {viewMode === 'Tablo' && (
            <MemberTable 
              members={members} 
              onSelectMember={setSelectedMember} 
              onRoleChange={handleRoleChangeInline}
            />
          )}

          {viewMode === 'Kart' && (
            <MemberCardView 
              members={members} 
              onSelectMember={setSelectedMember} 
              onRoleChange={handleRoleChangeInline}
            />
          )}

          {viewMode === 'Kanban' && (
            <MemberKanban 
              members={members} 
              onSelectMember={setSelectedMember} 
              onRoleChange={handleRoleChangeInline}
            />
          )}
        </>
      )}

      {/* Profile detail & Timeline Drawer */}
      {selectedMember && (
        <MemberDetailDrawer
          member={selectedMember}
          onClose={() => {
            setSelectedMember(null);
            fetchMembers(); // refresh to show updated fields in the list
          }}
          onUpdateSuccess={fetchMembers}
        />
      )}

      {/* Manual Member Creation Modal */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Yeni Üye Kaydet</h3>
              <button className="drawer-close" onClick={() => setCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMember}>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                
                {isAdmin && (
                  <div className="form-group">
                    <label>Kaydedilecek İlçe</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Ad</label>
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
                    <label>Soyad</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Telefon</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="5XX XXX XX XX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>TCKN</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="11 haneli TCKN"
                      value={tckn}
                      onChange={(e) => setTckn(e.target.value)}
                      maxLength={11}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Sandık Alanı (Okul)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Örn: Leyla Atakan İlkokulu"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Sandık No</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Örn: 2130"
                      value={ballotNo}
                      onChange={(e) => setBallotNo(e.target.value)}
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
                    <option value="SANDIK_GOREVLISI">Sandık Görevlisi</option>
                    <option value="SANDIK_SORUMLUSU">Sandık Sorumlusu</option>
                    <option value="MUSAHIT">Müşahit</option>
                    <option value="YEDEK">Yedek</option>
                  </select>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingMember}>
                  {submittingMember ? 'Kaydediliyor...' : 'Üye Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
