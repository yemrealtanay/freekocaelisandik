export function exportToCSV(members, districtName) {
  if (!members || members.length === 0) return;

  const headers = [
    'TCKN',
    'Ad',
    'Soyad',
    'Telefon',
    'İl',
    'İlçe',
    'Sandık Alanı',
    'Sandık No',
    'Görev Rolü',
    'Son İşlem Tarihi',
    'Son Açıklama / Not'
  ];

  // Helper to escape values for CSV
  const escapeValue = (val) => {
    if (val === null || val === undefined) return '';
    let stringVal = String(val);
    // Double quotes need to be escaped as two double quotes
    stringVal = stringVal.replace(/"/g, '""');
    if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
      return `"${stringVal}"`;
    }
    return stringVal;
  };

  const rows = members.map((m) => [
    escapeValue(m.tckn),
    escapeValue(m.first_name),
    escapeValue(m.last_name),
    escapeValue(m.phone),
    escapeValue(m.province),
    escapeValue(m.district),
    escapeValue(m.school),
    escapeValue(m.ballot_no),
    escapeValue(m.role),
    escapeValue(m.latest_action_date || '-'),
    escapeValue(m.latest_note || '-')
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
