import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Upload, FileSpreadsheet, RefreshCw, ArrowLeft, Play } from 'lucide-react';

function previewResolvedStance(rawVal) {
  if (!rawVal) return { code: 'BELIRTILMEDI', label: '⚪ Henüz Görüşülmedi' };
  const norm = rawVal
    .toString()
    .trim()
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');

  if (norm.includes('MAVI') || norm.includes('DESTEK') || norm.includes('YESIL') || norm.includes('OLUMLU')) {
    return { code: 'DESTEKLIYOR', label: '🟢 Destekliyor' };
  }
  if (norm.includes('SARI') || norm.includes('KARARSIZ') || norm.includes('ORTADA')) {
    return { code: 'KARARSIZ', label: '🟡 Kararsız' };
  }
  if (norm.includes('KIRMIZI') || norm.includes('MESAFE') || norm.includes('OLUMSUZ')) {
    return { code: 'MESAFELI', label: '🔴 Mesafeli' };
  }
  if (norm.includes('GRI') || norm.includes('GELMEYECEK') || norm.includes('MOR')) {
    return { code: 'GELMEYECEK', label: '🟣 Oy Vermeye Gelmeyecek' };
  }
  return { code: 'BELIRTILMEDI', label: '⚪ Henüz Görüşülmedi (Mevcudu Korur)' };
}

export default function UploadPage({ onUploadStart }) {
  const [district, setDistrict] = useState('Gölcük');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recentUploads, setRecentUploads] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Field Matching States
  const [step, setStep] = useState('upload'); // 'upload' | 'mapping'
  const [tempFileId, setTempFileId] = useState('');
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [mapping, setMapping] = useState({
    sno: '',
    first_name: '',
    last_name: '',
    phone: '',
    neighborhood: '',
    vote_stance: '',
    caller: '',
    note: ''
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.uploads.list();
      setRecentUploads(data);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        setErrorMsg('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  // Step 1: Upload Excel to Analyze headers
  const handleAnalyzeSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Lütfen yüklenecek bir Excel dosyası seçin.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await api.uploads.analyze(file);
      setTempFileId(response.tempFileId);
      setExcelHeaders(response.headers);
      setPreviewRows(response.previewRows);
      setMapping({
        sno: response.guessedMapping?.sno || '',
        first_name: response.guessedMapping?.first_name || '',
        last_name: response.guessedMapping?.last_name || '',
        phone: response.guessedMapping?.phone || '',
        neighborhood: response.guessedMapping?.neighborhood || '',
        vote_stance: response.guessedMapping?.vote_stance || '',
        caller: response.guessedMapping?.caller || '',
        note: response.guessedMapping?.note || ''
      });
      setStep('mapping');
    } catch (err) {
      setErrorMsg(err.message || 'Excel dosyası analiz edilemedi.');
    } finally {
      setUploading(false);
    }
  };

  // Step 2: Confirm mapping and trigger background import
  const handleImportSubmit = async () => {
    if (!mapping.first_name || !mapping.last_name) {
      setErrorMsg('Eşleştirmede "Adı" ve "Soyadı" alanları zorunludur.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await api.uploads.import(tempFileId, district, mapping);
      setSuccessMsg(response.message);
      setFile(null);
      setStep('upload');

      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) fileInput.value = '';

      if (onUploadStart) {
        onUploadStart(response.uploadId);
      }

      fetchHistory();
    } catch (err) {
      setErrorMsg(err.message || 'Aktarım başlatılamadı.');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ color: 'var(--text-muted)' }}>Bekliyor</span>;
      case 'PROCESSING':
        return <span style={{ color: 'var(--primary)' }}>İşleniyor...</span>;
      case 'COMPLETED':
        return <span style={{ color: 'var(--success)' }}>Tamamlandı</span>;
      case 'FAILED':
        return <span style={{ color: 'var(--danger)' }}>Başarısız</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const handleMappingChange = (field, excelHeader) => {
    setMapping(prev => ({
      ...prev,
      [field]: excelHeader
    }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h2 className="page-title">Excel Üye Listesi & Durum Güncelleme</h2>
          <span className="page-subtitle">
            Mevcut üyeleri mükerrer kayıt oluşturmadan karşılaştırır, değişen renk/intiba durumlarını ve saha notlarını günceller
          </span>
        </div>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      {step === 'upload' ? (
        <div className="upload-split-layout">
          {/* Step 1: Upload form */}
          <div className="table-container panel">
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-main)' }}>1. Aşama: Excel Dosyası Seçimi</h3>
            
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Renk &rarr; Seçmen İntibası Eşleştirme Kuralları:
              </div>
              <div>
                <strong>MAVİ</strong> &rarr; 🟢 Destekliyor &nbsp;|&nbsp; 
                <strong>SARI</strong> &rarr; 🟡 Kararsız &nbsp;|&nbsp; 
                <strong>KIRMIZI</strong> &rarr; 🔴 Mesafeli &nbsp;|&nbsp; 
                <strong>GRİ</strong> &rarr; 🟣 Oy Vermeye Gelmeyecek &nbsp;|&nbsp; 
                <strong>BEYAZ</strong> &rarr; ⚪ Görüşülmedi <em>(DB&apos;de işaretli olanları ezmez)</em>
              </div>
            </div>

            <form onSubmit={handleAnalyzeSubmit}>
              <div className="form-group">
                <label>Hedef İlçe</label>
                <input
                  type="text"
                  className="form-control"
                  value={district}
                  disabled
                  style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '32px' }}>
                <label>Excel Dosyası (.xlsx, .xls)</label>
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-app)',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer',
                      width: '100%',
                      height: '100%'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <FileSpreadsheet size={32} style={{ color: file ? 'var(--primary)' : 'var(--text-dim)' }} />
                    {file ? (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{file.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                          {(file.size / 1024).toFixed(1)} KB &bull; Dosyayı değiştirmek için tıklayın veya sürükleyin
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '14px' }}>Dosya seçin veya buraya sürükleyin</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '4px' }}>
                          Sıra No, Adı, Soyadı, Telefon, Orijinal Mahalle, Durum (Renk), Arama Sorumlusu, Lojistik Notlar
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={uploading || !file}
              >
                <Upload size={16} />
                <span>{uploading ? 'Dosya Okunuyor...' : 'Excel Analiz Et ve Eşleştir'}</span>
              </button>
            </form>
          </div>

          {/* Upload History */}
          <div className="table-container panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-main)', margin: 0 }}>Son Yükleme Geçmişi</h3>
              <button className="btn btn-secondary" onClick={fetchHistory} style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                <RefreshCw size={12} />
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Yükleniyor...</div>
            ) : recentUploads.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                Henüz yükleme yapılmadı.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="custom-table responsive-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Dosya</th>
                      <th style={{ padding: '8px 12px' }}>İlçe</th>
                      <th style={{ padding: '8px 12px' }}>Durum</th>
                      <th style={{ padding: '8px 12px' }}>Sonuç Özeti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUploads.map((log) => (
                      <tr key={log.id}>
                        <td className="cell-primary" style={{ padding: '10px 12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.filename}>
                          {log.filename.replace(/^\d+-/, '')}
                        </td>
                        <td data-label="İlçe" style={{ padding: '10px 12px' }}>{log.district}</td>
                        <td data-label="Durum" style={{ padding: '10px 12px', fontWeight: 600 }}>{getStatusBadge(log.status)}</td>
                        <td className="cell-full" data-label="Sonuç Özeti" style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{log.error || 'İşlem bekliyor'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Step 2: Field Mapping View */}
          <div className="table-container panel">
            <div className="section-head" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setStep('upload')} style={{ padding: '8px' }}>
                  <ArrowLeft size={16} />
                </button>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  2. Aşama: Sütun Eşleştirme ({district} İlçesi)
                </h3>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Excel Dosyası: <strong>{file?.name}</strong></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Sıra No (SNo)</span>
                  <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>(Eşleştirme Anahtarı)</span>
                </label>
                <select className="form-control" value={mapping.sno} onChange={(e) => handleMappingChange('sno', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <span>Adı</span>
                  <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>
                </label>
                <select className="form-control" value={mapping.first_name} onChange={(e) => handleMappingChange('first_name', e.target.value)}>
                  <option value="">-- Sütun Seçin --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <span>Soyadı</span>
                  <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>
                </label>
                <select className="form-control" value={mapping.last_name} onChange={(e) => handleMappingChange('last_name', e.target.value)}>
                  <option value="">-- Sütun Seçin --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Telefon</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.phone} onChange={(e) => handleMappingChange('phone', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Mahalle</span>
                  <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>(Resmi 48 Mahalle)</span>
                </label>
                <select className="form-control" value={mapping.neighborhood} onChange={(e) => handleMappingChange('neighborhood', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Durum (Renk) / İntiba</span>
                  <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>(Mavi/Sarı/Kırmızı/Gri)</span>
                </label>
                <select className="form-control" value={mapping.vote_stance} onChange={(e) => handleMappingChange('vote_stance', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Arama Sorumlusu</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Görüşme Notuna Eklenir)</span>
                </label>
                <select className="form-control" value={mapping.caller} onChange={(e) => handleMappingChange('caller', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Lojistik / Ek Notlar</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Görüşme Notuna Eklenir)</span>
                </label>
                <select className="form-control" value={mapping.note} onChange={(e) => handleMappingChange('note', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

            </div>

            {/* Live Preview Table */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Canlı Önizleme (Seçtiğiniz sütunlara göre ilk satırlar ve dönüşecek statüler)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="custom-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th>SNo</th>
                      <th>Adı</th>
                      <th>Soyadı</th>
                      <th>Telefon</th>
                      <th>Mahalle</th>
                      <th>Excel Renk &rarr; Sistem Statüsü</th>
                      <th>Eklenecek Görüşme Notu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      const rawColor = mapping.vote_stance ? String(row[mapping.vote_stance] || '') : '';
                      const resolved = previewResolvedStance(rawColor);
                      const callerVal = mapping.caller ? String(row[mapping.caller] || '').trim() : '';
                      const noteVal = mapping.note ? String(row[mapping.note] || '').trim() : '';
                      const previewNote = [
                        callerVal ? `Arama Sorumlusu: ${callerVal}` : '',
                        noteVal ? `Not: ${noteVal}` : ''
                      ].filter(Boolean).join(' | ');

                      return (
                        <tr key={idx}>
                          <td style={{ color: mapping.sno ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: 600, fontFamily: 'monospace' }}>
                            {mapping.sno ? String(row[mapping.sno] || '') : '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: mapping.first_name ? 'var(--text-main)' : 'var(--text-dim)' }}>
                            {mapping.first_name ? String(row[mapping.first_name] || '').toUpperCase() : '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: mapping.last_name ? 'var(--text-main)' : 'var(--text-dim)' }}>
                            {mapping.last_name ? String(row[mapping.last_name] || '').toUpperCase() : '—'}
                          </td>
                          <td style={{ color: mapping.phone ? 'var(--text-main)' : 'var(--text-dim)' }}>
                            {mapping.phone ? String(row[mapping.phone] || '') : '—'}
                          </td>
                          <td style={{ color: mapping.neighborhood ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: 500 }}>
                            {mapping.neighborhood ? String(row[mapping.neighborhood] || '') : '—'}
                          </td>
                          <td>
                            {rawColor ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{rawColor}</span>
                                <span>&rarr;</span>
                                <span className={`stance-badge ${resolved.code}`}>
                                  {resolved.label}
                                </span>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ color: previewNote ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '12px' }}>
                            {previewNote || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form actions */}
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '32px' }}>
              <button className="btn btn-secondary" onClick={() => setStep('upload')} style={{ padding: '12px 24px' }}>
                Vazgeç
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleImportSubmit} 
                style={{ padding: '12px 24px' }}
                disabled={uploading}
              >
                <Play size={14} />
                <span>{uploading ? 'Aktarılıyor...' : 'Karşılaştır ve Güncellemeyi Başlat'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
