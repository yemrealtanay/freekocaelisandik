export function exportToCSV(members, districtName) {
  if (!members || members.length === 0) return;

  const headers = [
    'Sıra No',
    'Adı',
    'Soyadı',
    'Telefon',
    'İlçe',
    'Mahalle',
    'Seçmen İntibası',
    'Görüşme Durumu',
    'Seçim Günü Oy Durumu',
    'Oy Kullanma Zamanı',
    'Son Görüşme Tarihi',
    'Son Görüşme Notu'
  ];

  const getStanceLabel = (stance) => {
    switch (stance) {
      case 'DESTEKLIYOR': return 'Destekliyor';
      case 'KARARSIZ': return 'Kararsız';
      case 'MESAFELI': return 'Mesafeli';
      case 'GELMEYECEK': return 'Oy Vermeye Gelmeyecek';
      default: return 'Henüz Görüşülmedi';
    }
  };

  const getContactLabel = (status) => {
    return status === 'GORUSULDU' ? 'Görüşüldü' : 'Görüşülmedi';
  };

  const getVotedLabel = (hasVoted) => {
    return hasVoted === 1 ? 'Oy Kullandı' : 'Oy Kullanmadı';
  };

  // Helper to escape values for CSV
  const escapeValue = (val) => {
    if (val === null || val === undefined) return '';
    let stringVal = String(val);
    stringVal = stringVal.replace(/"/g, '""');
    if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
      return `"${stringVal}"`;
    }
    return stringVal;
  };

  const rows = members.map((m) => [
    escapeValue(m.sno || '-'),
    escapeValue(m.first_name),
    escapeValue(m.last_name),
    escapeValue(m.phone ? `0${m.phone.replace(/\D/g, '').slice(-10)}` : '-'),
    escapeValue(m.district || 'Gölcük'),
    escapeValue(m.neighborhood || '-'),
    escapeValue(getStanceLabel(m.vote_stance)),
    escapeValue(getContactLabel(m.contact_status)),
    escapeValue(getVotedLabel(m.has_voted)),
    escapeValue(m.voted_at ? new Date(m.voted_at).toLocaleString('tr-TR') : '-'),
    escapeValue(m.latest_action_date || m.last_contact_date || '-'),
    escapeValue(m.latest_note || '-')
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Add BOM for Excel UTF-8 display compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sanitizedDistrict = (districtName || 'golcuk').toLowerCase().replace(/\s+/g, '_');
  link.setAttribute('download', `${sanitizedDistrict}_secim_ve_uye_listesi_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
