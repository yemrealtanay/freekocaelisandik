import React, { useMemo, useState } from 'react';
import { Search, MapPin } from 'lucide-react';

// Multi-select list of neighborhoods. An empty selection means "whole district".
export default function NeighborhoodPicker({ options, value, onChange, loading }) {
  const [query, setQuery] = useState('');

  // Keep already-assigned neighborhoods visible even if they currently have no members
  const allOptions = useMemo(() => {
    const counts = new Map(options.map(o => [o.neighborhood, o.count]));
    value.forEach(n => {
      if (!counts.has(n)) counts.set(n, 0);
    });
    return [...counts.entries()]
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, 'tr'));
  }, [options, value]);

  const normalizedQuery = query.trim().toLocaleLowerCase('tr');
  const visibleOptions = normalizedQuery
    ? allOptions.filter(o => o.neighborhood.toLocaleLowerCase('tr').includes(normalizedQuery))
    : allOptions;

  const selected = new Set(value);

  const toggle = (neighborhood) => {
    onChange(selected.has(neighborhood)
      ? value.filter(v => v !== neighborhood)
      : [...value, neighborhood]);
  };

  const selectVisible = () => {
    onChange([...new Set([...value, ...visibleOptions.map(o => o.neighborhood)])]);
  };

  return (
    <div className="nb-picker">
      <div className="search-container">
        <Search size={16} className="search-icon" />
        <input
          type="search"
          className="form-control search-input"
          placeholder="Mahalle ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="nb-picker-meta">
        <span>
          {value.length === 0
            ? 'Seçim yok: ilçenin tüm mahallelerini görür'
            : <><strong>{value.length}</strong> mahalle seçildi</>}
        </span>
        <div className="nb-picker-actions">
          <button type="button" className="link-btn" onClick={selectVisible} disabled={visibleOptions.length === 0}>
            {normalizedQuery ? 'Sonuçları Seç' : 'Tümünü Seç'}
          </button>
          <button type="button" className="link-btn" onClick={() => onChange([])} disabled={value.length === 0}>
            Temizle
          </button>
        </div>
      </div>

      <div className="nb-picker-list" role="group" aria-label="Mahalleler">
        {loading ? (
          <div className="nb-picker-empty">Mahalleler yükleniyor...</div>
        ) : visibleOptions.length === 0 ? (
          <div className="nb-picker-empty">
            {allOptions.length === 0 ? 'Bu ilçede kayıtlı mahalle bulunamadı.' : 'Eşleşen mahalle yok.'}
          </div>
        ) : (
          visibleOptions.map((o) => (
            <label key={o.neighborhood} className={`nb-picker-item ${selected.has(o.neighborhood) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(o.neighborhood)}
                onChange={() => toggle(o.neighborhood)}
              />
              <span className="nb-picker-name">{o.neighborhood}</span>
              <span className="nb-picker-count">{o.count} üye</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// Compact read-only chip list with "+N" overflow
export function NeighborhoodChips({ neighborhoods, max = 3 }) {
  if (!neighborhoods || neighborhoods.length === 0) return null;
  const shown = neighborhoods.slice(0, max);
  const rest = neighborhoods.length - shown.length;

  return (
    <div className="nb-chip-list" title={neighborhoods.join(', ')}>
      {shown.map((n) => (
        <span key={n} className="neighborhood-badge">
          <MapPin size={10} />
          {n}
        </span>
      ))}
      {rest > 0 && <span className="nb-chip-more">+{rest}</span>}
    </div>
  );
}
