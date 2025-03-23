import React, { useState } from 'react';

const LiveFeedSnapshot = () => {
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [measurements, setMeasurements] = useState(null);
  const [apparelSize, setApparelSize] = useState('');

  // This function returns a size index based on a measurement value.
  // Thresholds: [30, 34, 38, 42] inches corresponding to Extra Small, Small, Medium, Large.
  const getSizeIndex = (value) => {
    if (value < 30) return 0;
    else if (value < 34) return 1;
    else if (value < 38) return 2;
    else if (value < 42) return 3;
    else return 4;
  };

  // This function calculates the recommended apparel size by taking the maximum
  // required size from all four measurements.
  const recommendedApparelSize = (m) => {
    const indices = [
      getSizeIndex(m.chest),
      getSizeIndex(m.shoulder),
      getSizeIndex(m.hip),
      getSizeIndex(m.thigh)
    ];
    const maxIndex = Math.max(...indices);
    const sizes = ["Extra Small", "Small", "Medium", "Large", "Extra Large"];
    return sizes[maxIndex];
  };

  // Process measurement data, converting raw server values to inches.
  const displayMeasurements = (data) => {
    // Conversion factors should match those used on the server.
    const chestInches = parseFloat((data['Chest Circumference'] / 10.2).toFixed(2));
    const shoulderInches = parseFloat((data['Shoulder Width'] / 8.4).toFixed(2));
    const hipInches = parseFloat((data['Hip Length'] / 5.8).toFixed(2));
    const thighInches = parseFloat((data['Thigh Circumference'] / 9.3).toFixed(2));

    const meas = {
      chest: chestInches,
      shoulder: shoulderInches,
      hip: hipInches,
      thigh: thighInches,
    };

    setMeasurements(meas);
    setApparelSize(recommendedApparelSize(meas));
  };

  // Takes a snapshot and then retrieves measurement sizes.
  const takeSnapshot = async (duration) => {
    try {
      const response = await fetch(`/snapshot?duration=${duration}`);
      const blob = await response.blob();
      setSnapshotUrl(URL.createObjectURL(blob));
      
      // Fetch measurements after snapshot is taken.
      const measResponse = await fetch('/measurements');
      const data = await measResponse.json();
      displayMeasurements(data);
    } catch (error) {
      console.error('Error taking snapshot:', error);
    }
  };

  // Inline styling.
  const containerStyle = {
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    margin: '20px'
  };

  const videoContainerStyle = {
    position: 'relative',
    display: 'inline-block',
    marginBottom: '20px'
  };

  const imgStyle = {
    border: '1px solid #ccc'
  };

  const buttonContainerStyle = {
    margin: '20px'
  };

  const measurementInfoStyle = {
    marginTop: '20px',
    fontSize: '18px'
  };

  return (
    <div style={containerStyle}>
      <h1>Live Video Feed with Snapshot</h1>
      
      {/* Live video feed */}
      <div id="video-container" style={videoContainerStyle}>
        <img
          id="videoFeed"
          src="/video_feed"
          alt="Live Video Feed"
          width="1080"
          height="720"
          style={imgStyle}
        />
      </div>
      
      {/* Snapshot buttons */}
      <div className="button-container" style={buttonContainerStyle}>
        <button onClick={() => takeSnapshot(3)}>Snapshot 3 sec</button>
        <button onClick={() => takeSnapshot(5)}>Snapshot 5 sec</button>
        <button onClick={() => takeSnapshot(10)}>Snapshot 10 sec</button>
      </div>
      
      {/* Display snapshot */}
      <h2>Snapshot:</h2>
      {snapshotUrl && (
        <img
          id="snapshotImg"
          src={snapshotUrl}
          alt="Snapshot will appear here"
          width="1080"
          height="720"
          style={{ ...imgStyle, marginTop: '20px' }}
        />
      )}
      
      {/* Display measurement info and recommended apparel size */}
      <div id="measurementInfo" style={measurementInfoStyle}>
        <h3>Measurement Sizes:</h3>
        <div id="sizes">
          {measurements && (
            <div>
              <p>Chest Circumference: {measurements.chest} inch</p>
              <p>Shoulder Width: {measurements.shoulder} inch</p>
              <p>Hip Length: {measurements.hip} inch</p>
              <p>Thigh Circumference: {measurements.thigh} inch</p>
            </div>
          )}
        </div>
        <h3>Recommended Apparel Size:</h3>
        <div id="apparelSize">{apparelSize}</div>
      </div>
    </div>
  );
};

export default LiveFeedSnapshot;
