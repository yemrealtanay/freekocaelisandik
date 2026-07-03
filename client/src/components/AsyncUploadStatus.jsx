import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function AsyncUploadStatus({ uploadId, onComplete, onDismiss }) {
  const [status, setStatus] = useState('PENDING'); // PENDING, PROCESSING, COMPLETED, FAILED
  const [errorMsg, setErrorMsg] = useState('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!uploadId) return;

    setStatus('PENDING');
    setVisible(true);

    let intervalId = setInterval(async () => {
      try {
        const data = await api.uploads.status(uploadId);
        setStatus(data.status);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(intervalId);
          if (data.status === 'FAILED') {
            setErrorMsg(data.error || 'Yükleme başarısız.');
          } else {
            setErrorMsg(data.error || 'Yükleme tamamlandı.'); // Contains success details like processed count
          }
          if (onComplete) {
            onComplete(data.status);
          }
        }
      } catch (err) {
        console.error('Error polling upload status:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [uploadId]);

  if (!visible || !uploadId) return null;

  const handleDismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  return (
    <div className="floating-upload-tracker">
      {(status === 'PENDING' || status === 'PROCESSING') && (
        <>
          <div className="upload-spinner" />
          <div className="upload-tracker-text">
            <div className="upload-tracker-title">Excel Dosyası İşleniyor</div>
            <div className="upload-tracker-desc">Üyeler veritabanına aktarılıyor, lütfen bekleyin...</div>
          </div>
        </>
      )}

      {status === 'COMPLETED' && (
        <>
          <CheckCircle size={24} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <div className="upload-tracker-text">
            <div className="upload-tracker-title" style={{ color: 'var(--success)' }}>İşlem Tamamlandı</div>
            <div className="upload-tracker-desc">{errorMsg}</div>
          </div>
          <button 
            onClick={handleDismiss} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '8px' }}
          >
            <X size={14} />
          </button>
        </>
      )}

      {status === 'FAILED' && (
        <>
          <AlertCircle size={24} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="upload-tracker-text">
            <div className="upload-tracker-title" style={{ color: 'var(--danger)' }}>İşlem Hatalı</div>
            <div className="upload-tracker-desc" style={{ color: '#fca5a5' }}>{errorMsg}</div>
          </div>
          <button 
            onClick={handleDismiss} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '8px' }}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
