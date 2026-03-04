import React from 'react';
import { Handle, Position } from 'reactflow';
import './ResourceNode.css';

export type NodeStatus = 'active' | 'running' | 'pending' | 'error' | 'info';

interface ResourceNodeData {
  label: string;
  subtitle?: string;
  icon: string;
  status: NodeStatus;
  tooltip?: string;
  consoleUrl?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ResourceNode: React.FC<{ data: ResourceNodeData }> = ({ data }) => {
  const statusClass = `status-${data.status}`;

  return (
    <div
      className={`resource-node ${statusClass} ${data.isSelected ? 'selected' : ''}`}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} id="target-left" className="handle" />
      <Handle type="target" position={Position.Top} id="target-top" className="handle" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="handle" />

      <div className="resource-content">
        <div className="resource-icon-wrap">
          <span className="material-symbols-outlined resource-icon">{data.icon}</span>
          <div className={`status-dot ${statusClass}`} />
        </div>
        <div className="resource-info">
          <span className="resource-label">{data.label}</span>
          {data.subtitle && <span className="resource-subtitle">{data.subtitle}</span>}
        </div>
        {data.consoleUrl && (
          <a
            href={data.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="resource-link"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
          </a>
        )}
      </div>

      <Handle type="source" position={Position.Top} id="source-top" className="handle" />
      <Handle type="source" position={Position.Right} id="source-right" className="handle" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="handle" />
    </div>
  );
};
