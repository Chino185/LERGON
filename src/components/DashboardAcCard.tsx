import React, { useState } from 'react';
import styles from './DashboardAcCard.module.css';

export interface DashboardAcCardProps {
  initialTemperature?: number;
  initialPowerState?: boolean;
}

export const DashboardAcCard: React.FC<DashboardAcCardProps> = ({
  initialTemperature = 24,
  initialPowerState = true,
}) => {
  const [temperature, setTemperature] = useState<number>(initialTemperature);
  const [isOn, setIsOn] = useState<boolean>(initialPowerState);

  const MIN_TEMP = 16;
  const MAX_TEMP = 30;

  const handleDecrease = () => {
    if (isOn && temperature > MIN_TEMP) {
      setTemperature((prev) => prev - 1);
    }
  };

  const handleIncrease = () => {
    if (isOn && temperature < MAX_TEMP) {
      setTemperature((prev) => prev + 1);
    }
  };

  const togglePower = () => {
    setIsOn((prev) => !prev);
  };

  // Calculate pin rotation angle from -120deg to +120deg
  const rotationAngle = -120 + ((temperature - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)) * 240;

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 className={styles.mainTitle}>AIR CONDITIONER</h2>
          <p className={styles.subtitle}>Auto Cooling</p>
        </div>
        <button
          type="button"
          onClick={togglePower}
          className={`${styles.powerSwitch} ${
            isOn ? styles.powerSwitchActive : styles.powerSwitchInactive
          }`}
        >
          {isOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Gauge / Dial Visualization */}
      <div className={styles.gaugeContainer}>
        <svg viewBox="0 0 200 130" className={styles.gaugeSvg}>
          <path
            d="M 30 110 A 80 80 0 1 1 170 110"
            fill="none"
            strokeWidth="3"
            strokeDasharray="1,4"
            className={isOn ? styles.gaugeArcActive : styles.gaugeArcDisabled}
            strokeLinecap="round"
          />
        </svg>

        {/* Dynamic Center-Anchored Rotating Indicator Pin */}
        <div
          className={styles.pinContainer}
          style={{ transform: `rotate(${rotationAngle}deg)` }}
        >
          <div
            className={`${styles.pinLine} ${
              isOn ? styles.pinLineActive : styles.pinLineDisabled
            }`}
          >
            <div
              className={`${styles.pinHead} ${
                isOn ? styles.pinHeadActive : styles.pinHeadDisabled
              }`}
            />
          </div>
        </div>

        {/* Readout */}
        <div className={styles.readout}>
          <span
            className={`${styles.tempValue} ${
              !isOn ? styles.tempValueDisabled : ''
            }`}
          >
            {isOn ? `${temperature}°C` : '--'}
          </span>
          <span className={styles.metaLabel}>TARGET TEMP</span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className={styles.footerControls}>
        <button
          type="button"
          onClick={handleDecrease}
          disabled={!isOn || temperature <= MIN_TEMP}
          className={styles.controlBtn}
          aria-label="Decrease Temperature"
        >
          -
        </button>
        <button
          type="button"
          onClick={handleIncrease}
          disabled={!isOn || temperature >= MAX_TEMP}
          className={styles.controlBtn}
          aria-label="Increase Temperature"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default DashboardAcCard;
