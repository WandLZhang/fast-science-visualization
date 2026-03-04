import React from 'react';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  isTransitioning?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, isTransitioning }) => {
  return (
    <div className="welcome-screen">
      <div className={`welcome-card ${isTransitioning ? 'fade-out' : ''}`}>
        <div className="welcome-logo">
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>
            deployed_code
          </span>
        </div>

        <h1 className="display-small welcome-title">
          <span className="title-part-1">Fast Science</span>{' '}
          <span className="title-part-2">Infrastructure</span>
        </h1>

        <div className="welcome-layers">
          <div className="layer-badge layer-l0">
            <span className="material-symbols-outlined layer-icon">shield</span>
            <span className="layer-text">L0<br/>Foundation</span>
          </div>
          <span className="layer-arrow material-symbols-outlined">arrow_forward</span>
          <div className="layer-badge layer-l1">
            <span className="material-symbols-outlined layer-icon">assignment</span>
            <span className="layer-text">L1<br/>Project Factory</span>
          </div>
          <span className="layer-arrow material-symbols-outlined">arrow_forward</span>
          <div className="layer-badge layer-l2">
            <span className="material-symbols-outlined layer-icon">biotech</span>
            <span className="layer-text">L2<br/>Workloads</span>
          </div>
        </div>

        <button className="welcome-button" onClick={onGetStarted}>
          <span className="label-large">View</span>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', marginLeft: '8px' }}>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
};
