import React from 'react';
import './DetailPanel.css';

interface DetailPanelProps {
  title: string;
  subtitle?: string;
  icon?: string;
  status?: string;
  details: Record<string, string | number | boolean | undefined>;
  consoleUrl?: string;
  differentiator?: string;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  title, subtitle, icon, status, details, consoleUrl, differentiator,
}) => {
  return (
    <div className="detail-panel">
      <div className="detail-header">
        {icon && <span className="material-symbols-outlined detail-icon">{icon}</span>}
        <div>
          <h3 className="title-medium" style={{ margin: 0 }}>{title}</h3>
          {subtitle && <p className="body-small" style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>{subtitle}</p>}
        </div>
        {status && (
          <span className={`detail-status-badge status-${status}`}>
            {status.toUpperCase()}
          </span>
        )}
      </div>

      {consoleUrl && (
        <a href={consoleUrl} target="_blank" rel="noopener noreferrer" className="detail-console-link">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
          <span>Open in Console</span>
        </a>
      )}

      <div className="detail-properties">
        {Object.entries(details).map(([key, value]) =>
          value !== undefined ? (
            <div key={key} className="detail-property">
              <span className="detail-key">{key}</span>
              <span className="detail-value">{String(value)}</span>
            </div>
          ) : null
        )}
      </div>

      {differentiator && (
        <div className="detail-differentiator">
          <div className="differentiator-header">
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#1A73E8' }}>lightbulb</span>
            <span className="label-medium" style={{ color: '#1A73E8' }}>Why Google Cloud</span>
          </div>
          <p className="body-small differentiator-text">{differentiator}</p>
        </div>
      )}
    </div>
  );
};
