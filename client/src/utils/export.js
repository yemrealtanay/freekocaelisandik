export function exportToCSV(members, districtName) {
  if (!members || members.length === 0) return;

  const headers = [
    'Adı',
    'Soyadı',
    'Telefon',
    'İlçe',
    'Mahalle',
    'Seçmen İntibası',
    'Görüşme Durumu',
    'Son Görüşme Tarihi',
    'Son Görüşme Notu',
    'Sandık Alanı / Okul',
    'Sandık No',
    'TCKN'
  ];

  const getStanceLabel = (stance) => {
    switch (stance) {
      case 'DESTEKLIYOR': return 'Destekliyor';
      case 'KARARSIZ': return 'Kararsız';
      case 'MESAFELI': return 'Mesafeli';
      default: return 'Henüz Görüşülmedi';
    }
  };

  const getContactLabel = (status) => {
    return status === 'GORUSULDU' ? 'Görüşüldü' : 'Görüşülmedi';
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
    escapeValue(m.first_name),
    escapeValue(m.last_name),
    escapeValue(m.phone ? `0${m.phone.replace(/\D/g, '').slice(-10)}` : '-'),
    escapeValue(m.district),
    escapeValue(m.neighborhood || '-'),
    escapeValue(getStanceLabel(m.vote_stance)),
    escapeValue(getContactLabel(m.contact_status)),
    escapeValue(m.latest_action_date || m.last_contact_date || '-'),
    escapeValue(m.latest_note || '-'),
    escapeValue(m.school || '-'),
    escapeValue(m.ballot_no || '-'),
    escapeValue(m.tckn || '-')
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(','))
  ].join('\n');

  // Create Blob with UTF-8 BOM to prevent Excel Turkish character issues
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  // Format filename: Uye_Listesi_Izmit_YYYY-MM-DD.csv
  const dateStr = new Date().toISOString().split('T')[0];
  const formattedDistrict = districtName ? districtName.replace(/\s+/g, '_') : 'Kocaeli';
  link.setAttribute('download', `Uye_Listesi_${formattedDistrict}_${dateStr}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
