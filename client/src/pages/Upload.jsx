import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Lütfen yüklenecek bir Excel dosyası seçin.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await api.uploads.upload(file, district);
      setSuccessMsg(response.message);
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) fileInput.value = '';

      // Trigger floating progress tracker in bottom corner
      if (onUploadStart) {
        onUploadStart(response.uploadId);
      }
      
      // Refresh upload history logs
      fetchHistory();
    } catch (err) {
      setErrorMsg(err.message || 'Dosya yükleme hatası.');
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h2 className="page-title">Excel Yükle</h2>
          <span className="page-subtitle">Sisteme ilçe seçerek toplu üye aktarımı yapın</span>
        </div>
      </div>

      {errorMsg && <div className="toast-msg error">{errorMsg}</div>}
      {successMsg && <div className="toast-msg success">{successMsg}</div>}

      <div className="upload-split-layout">
        
        {/* Upload Form */}
        <div className="table-container" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '24px', color: 'var(--text-main)' }}>Yeni Excel İçe Aktarımı</h3>
          
          <form onSubmit={handleSubmit}>
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
                      <div style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '4px' }}>Excel formatı (TCKN, Adi, Soyadi, CepTelefon, vb.)</div>
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
              <span>{uploading ? 'Yükleniyor...' : 'Excel Yükle ve Aktar'}</span>
            </button>
          </form>
        </div>

        {/* Upload History Logs */}
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
    </div>
  );
}
