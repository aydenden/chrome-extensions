import { useState, useRef } from 'react';
import type { InputMode } from '../hooks/usePopupState';

interface Company {
  id: string;
  name: string;
}

interface CompanyInputProps {
  value: string;
  onChange: (value: string) => void;
  detectedCompany: string | null;
  savedCompanies: Company[];
  inputMode: InputMode;
  disabled?: boolean;
  isLoading?: boolean;
}

export function CompanyInput({
  value,
  onChange,
  detectedCompany,
  savedCompanies,
  inputMode,
  disabled = false,
  isLoading = false,
}: CompanyInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCompanies = savedCompanies.filter(c =>
    c.name.toLowerCase().includes(value.toLowerCase())
  );

  const displayedChips = savedCompanies.slice(0, 3);
  const moreCount = savedCompanies.length - 3;

  const handleSelectSaved = (company: Company) => {
    onChange(company.name);
    setShowDropdown(false);
  };

  if (isLoading) {
    return <div className="loading-skeleton" />;
  }

  return (
    <>
      {/* Company Input */}
      <div className="company-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="company-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="회사명을 입력하세요"
          disabled={disabled}
        />
        {value && (
          <button className="input-clear" onClick={() => onChange('')} aria-label="Clear">
            ×
          </button>
        )}

        {/* Dropdown for matching companies */}
        {showDropdown && filteredCompanies.length > 0 && (
          <div className="company-dropdown">
            <div className="dropdown-label">저장된 회사</div>
            {filteredCompanies.map(company => (
              <button
                key={company.id}
                className="dropdown-item"
                onMouseDown={() => handleSelectSaved(company)}
              >
                {company.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="input-status">
        {inputMode === 'detected' && (
          <>
            <span className="status-icon detected">✓</span>
            <span className="status-text">자동 감지됨</span>
          </>
        )}
        {inputMode === 'saved' && (
          <>
            <span className="status-icon saved">●</span>
            <span className="status-text">저장된 회사</span>
          </>
        )}
        {inputMode === 'manual' && value && (
          <>
            <span className="status-icon manual">+</span>
            <span className="status-text">새 회사</span>
          </>
        )}
        {!value && !detectedCompany && !disabled && (
          <span className="status-text warning">회사명을 감지할 수 없습니다</span>
        )}
      </div>

      {/* Quick Pick Chips */}
      {savedCompanies.length > 0 && !value && (
        <div className="quick-picks">
          <span className="picks-label">최근:</span>
          {displayedChips.map(company => (
            <button key={company.id} className="pick-chip" onClick={() => handleSelectSaved(company)}>
              {company.name}
            </button>
          ))}
          {moreCount > 0 && <span className="more-count">+{moreCount}</span>}
        </div>
      )}
    </>
  );
}
