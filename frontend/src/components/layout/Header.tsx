import React from 'react';

interface HeaderProps {
  lastRefresh: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ lastRefresh, isLoading, onRefresh }) => {
  return (
    <div className="infra-header">
      <div className="header-left">
        <span className="material-symbols-outlined header-icon" style={{ color: 'var(--color-primary)', fontSize: '28px' }}>deployed_code</span>
        <div>
          <h1 className="title-large" style={{ margin: 0 }}>Fast Science Infrastructure</h1>
          <p className="body-medium" style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
            GCP Landing Zone &middot; L0 / L1 / L2
          </p>
        </div>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {lastRefresh && (
          <span className="body-small" style={{ color: 'var(--color-on-surface-variant)' }}>
            Updated {lastRefresh}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 20px', background: 'var(--color-primary)',
            color: 'var(--color-on-primary)', border: 'none',
            borderRadius: 'var(--radius-extra-large)', cursor: isLoading ? 'wait' : 'pointer',
            fontFamily: "'Google Sans Text', sans-serif", fontSize: '13px', fontWeight: 500,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: '18px',
            animation: isLoading ? 'spin 1s linear infinite' : 'none',
          }}>refresh</span>
          <span className="label-large">{isLoading ? 'Loading...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
};
