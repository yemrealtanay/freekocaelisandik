import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Play } from 'lucide-react';

const DISTRICTS = [
  'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 
  'Gebze', 'Gölcük', 'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez'
];

export default function UploadPage({ onUploadStart }) {
  const [district, setDistrict] = useState(DISTRICTS[0]);
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
    tckn: '',
    first_name: '',
    last_name: '',
    phone: '',
    ballot_area: '',
    ballot_no: '',
    description: ''
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
      setMapping(response.guessedMapping);
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

      // Reset file input
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
          <h2 className="page-title">Excel İçe Aktar</h2>
          <span className="page-subtitle">Sisteme dinamik sütun eşleştirmesi ile toplu üye aktarımı yapın</span>
        </div>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      {step === 'upload' ? (
        <div className="upload-split-layout">
          {/* Step 1: Upload form */}
          <div className="table-container" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '24px', color: 'var(--text-main)' }}>1. Aşama: Dosya ve İlçe Seçimi</h3>
            
            <form onSubmit={handleAnalyzeSubmit}>
              <div className="form-group">
                <label>Hedef İlçe</label>
                <select
                  className="form-control"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
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
                        <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '4px' }}>Tüm Excel sütun formatları desteklenmektedir</div>
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
          <div className="table-container" style={{ padding: '24px' }}>
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
                <table className="custom-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Dosya</th>
                      <th style={{ padding: '8px 12px' }}>İlçe</th>
                      <th style={{ padding: '8px 12px' }}>Durum</th>
                      <th style={{ padding: '8px 12px' }}>Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUploads.map((log) => (
                      <tr key={log.id}>
                        <td style={{ padding: '10px 12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.filename}>
                          {log.filename.replace(/^\d+-/, '')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{log.district}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{getStatusBadge(log.status)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{log.error || 'İşlem bekliyor'}</td>
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
          <div className="table-container" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>TC Kimlik Numarası (TCKN)</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.tckn} onChange={(e) => handleMappingChange('tckn', e.target.value)}>
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
                  <span>Cep Telefonu</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.phone} onChange={(e) => handleMappingChange('phone', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Sandık Alanı / Okul</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.ballot_area} onChange={(e) => handleMappingChange('ballot_area', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Sandık No</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.ballot_no} onChange={(e) => handleMappingChange('ballot_no', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Açıklama (Timeline Notu)</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.description} onChange={(e) => handleMappingChange('description', e.target.value)}>
                  <option value="">-- Eşleştirme Yok --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Görev / Rol</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>(Opsiyonel)</span>
                </label>
                <select className="form-control" value={mapping.role || ''} onChange={(e) => handleMappingChange('role', e.target.value)}>
                  <option value="">-- Eşleştirme Yok (Varsayılan: Görevsiz) --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

            </div>

            {/* Live Preview Table */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Canlı Önizleme (Seçtiğiniz sütunlara göre ilk 3 satır verisi)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="custom-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th>TCKN</th>
                      <th>Adı</th>
                      <th>Soyadı</th>
                      <th>Cep Telefonu</th>
                      <th>Sandık Alanı (Okul)</th>
                      <th>Sandık No</th>
                      <th>Görev / Rol</th>
                      <th>Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ color: mapping.tckn ? 'var(--text-main)' : 'var(--text-dim)' }}>
                          {mapping.tckn ? String(row[mapping.tckn] || '') : '—'}
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
                        <td style={{ color: mapping.ballot_area ? 'var(--text-main)' : 'var(--text-dim)' }}>
                          {mapping.ballot_area ? String(row[mapping.ballot_area] || '') : '—'}
                        </td>
                        <td style={{ color: mapping.ballot_no ? 'var(--text-main)' : 'var(--text-dim)' }}>
                          {mapping.ballot_no ? String(row[mapping.ballot_no] || '') : '—'}
                        </td>
                        <td style={{ color: mapping.role ? 'var(--text-main)' : 'var(--text-dim)' }}>
                          {mapping.role ? String(row[mapping.role] || '') : '—'}
                        </td>
                        <td style={{ color: mapping.description ? 'var(--text-muted)' : 'var(--text-dim)', fontSize: '12px' }}>
                          {mapping.description ? String(row[mapping.description] || '') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form actions */}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '32px' }}>
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
                <span>{uploading ? 'Aktarılıyor...' : 'Aktarımı Başlat'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
