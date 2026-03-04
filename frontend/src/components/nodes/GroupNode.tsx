import React from 'react';
import './GroupNode.css';

export type GroupType = 'it' | 'researcher' | 'project' | 'vpc' | 'region' | 'layer';

interface GroupNodeData {
  label: string;
  icon: string;
  width: number;
  height: number;
  groupType: GroupType;
  dashed?: boolean;
  subtitle?: string;
}

export const GroupNode: React.FC<{ data: GroupNodeData }> = ({ data }) => {
  const classes = [
    'group-node',
    `group-${data.groupType}`,
    data.dashed ? 'group-dashed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ width: data.width, height: data.height }}>
      <div className="group-label">
        <span className="material-symbols-outlined group-icon">{data.icon}</span>
        <span className="group-text">{data.label}</span>
        {data.subtitle && <span className="group-subtitle">{data.subtitle}</span>}
      </div>
    </div>
  );
};
