// --- FUNCTIONALITY CODE: JavaScript ---

// Toggle functionality to switch between Live Feed and Upload Image
document.getElementById('toggleMode').addEventListener('change', function() {
  if (this.checked) {
    document.getElementById('liveFeedContainer').style.display = 'none';
    document.getElementById('uploadContainer').style.display = 'block';
    document.getElementById('liveLabel').classList.remove('active');
    document.getElementById('uploadLabel').classList.add('active');
  } else {
    document.getElementById('liveFeedContainer').style.display = 'block';
    document.getElementById('uploadContainer').style.display = 'none';
    document.getElementById('liveLabel').classList.add('active');
    document.getElementById('uploadLabel').classList.remove('active');
    document.querySelector('#uploadContainer .upload-box').style.display = 'flex';
    document.getElementById('uploadedImage').style.display = 'none';
    document.getElementById('uploadInput').value = "";
  }
});

// Handle image upload in Upload Image mode
function handleUploadImage(e) {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    document.querySelector('#uploadContainer .upload-box').style.display = 'none';
    const uploadedImage = document.getElementById('uploadedImage');
    uploadedImage.src = url;
    uploadedImage.style.display = 'block';
  }
}

// Global variable to store the captured snapshot
let capturedSnapshot = null;

function takeSnapshot(duration) {
  fetch('/measurements')
    .then(response => response.json())
    .then(data => {
      displayMeasurements(data);
      displayMeasurementsEast(data);
      displayMeasurementsWest(data);
    })
    .catch(error => console.error('Error fetching measurements:', error));

  fetch(`/capture?duration=${duration}`)
    .then(response => response.json())
    .then(data => {
      const base64Image = data.image;
      capturedSnapshot = base64Image; // Save snapshot for later processing

      // Hide live feed and show snapshot overlay
      document.getElementById('liveFeedContainer').style.display = 'none';
      document.getElementById('snapshotOverlay').style.display = 'block';
      document.getElementById('snapshotPreview').src = 'data:image/jpeg;base64,' + base64Image;
    })
    .catch(error => console.error('Error capturing snapshot:', error));
}

function retrySnapshot() {
  // Hide snapshot overlay and unhide live feed without reloading it.
  document.getElementById('snapshotOverlay').style.display = 'none';
  document.getElementById('liveFeedContainer').style.display = 'block';
  capturedSnapshot = null;
}
function handleSubmit() {
  let personImagePromise;
  // Determine which mode is active: live feed (capturedSnapshot) or upload mode.
  if (document.getElementById('toggleMode').checked) {
    // Upload mode: use the uploaded image from the upload container.
    let uploadedSrc = document.getElementById('uploadedImage').src;
    // If it's a blob URL (not a data URL), convert it.
    if (uploadedSrc && !uploadedSrc.startsWith("data:image")) {
      personImagePromise = convertURLToBase64(uploadedSrc);
    } else {
      personImagePromise = Promise.resolve(uploadedSrc);
    }
  } else {
    // Live feed mode: use the captured snapshot.
    personImagePromise = Promise.resolve(capturedSnapshot);
  }
  
  personImagePromise.then(personImage => {
    console.log("Person Image (pure base64):", personImage);
    if (personImage && personImage.trim() !== "") {
      // Show the processing modal and start the progress bar.
      const modal = document.getElementById('processingModal');
      modal.style.display = 'flex';
      document.getElementById('modalHeader').innerText = "Generating...";
      document.querySelector('.spinner').style.display = 'block';
      document.querySelector('.progress-container').style.display = 'block';
      document.getElementById('processedImageContainer').style.display = 'none';
      document.getElementById('modalButtons').style.display = 'none';

      const progressBar = document.getElementById('progressBar');
      progressBar.style.width = '0%';

      let totalTime = 23; // seconds for the progress bar
      let elapsedTime = 0;
      const progressInterval = setInterval(() => {
        elapsedTime++;
        let percent = Math.min((elapsedTime / totalTime) * 100, 100);
        progressBar.style.width = percent + '%';
        if (elapsedTime >= totalTime) {
          clearInterval(progressInterval);
        }
      }, 1000);

      // Convert the selected cloth image to base64 before sending.
      let clothPromise = selectedCloth ? convertURLToBase64(selectedCloth) : Promise.resolve(null);

      clothPromise.then(clothBase64 => {
        fetch('/process_snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: personImage, // pure base64 without "data:image/jpeg;base64,"
            cloth_type: document.getElementById('clothingType').value,
            selected_cloth: clothBase64  // may be null if no cloth is selected.
          })
        })
        .then(response => response.json())
        .then(data => {
          clearInterval(progressInterval);
          progressBar.style.width = '100%';
          document.getElementById('modalHeader').innerText = "Generated Image";
          document.querySelector('.spinner').style.display = 'none';
          document.querySelector('.progress-container').style.display = 'none';
          const processedImageContainer = document.getElementById('processedImageContainer');
          processedImageContainer.style.display = 'block';
          // Display the processed image larger (the modal's CSS sets a larger size)
          document.getElementById('processedImage').src = 'data:image/jpeg;base64,' + data.image;
          document.getElementById('modalButtons').style.display = 'block';
        })
        .catch(error => {
          clearInterval(progressInterval);
          console.error('Error processing snapshot:', error);
          alert("Error processing snapshot.");
          modal.style.display = 'none';
        });
      }).catch(err => {
        console.error("Error converting cloth image to base64:", err);
      });
    } else {
      alert("No image available. Please capture a snapshot or upload an image.");
    }
  });
}


// Helper function to convert URL to base64 (unchanged)
function convertURLToBase64(url) {
  return fetch(url)
    .then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    }));
}

// Save button: download the processed image
function saveImage() {
  const imageSrc = document.getElementById('processedImage').src;
  // Create a temporary anchor element and trigger download
  const a = document.createElement('a');
  a.href = imageSrc;
  a.download = 'processed_image.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Close button: hide the modal
function closeModal() {
  document.getElementById('processingModal').style.display = 'none';
}

function calibrate() {
  fetch('/calibrate', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      console.log("Calibration updated:", data.updated_factors);
      for (const key in data.updated_factors) {
        const newValue = data.updated_factors[key];
        document.getElementById(key + '-value').innerText = newValue;
        document.getElementById(key).value = newValue;
      }
      alert("Calibration completed.");
    })
    .catch(error => console.error('Error calibrating:', error));
}

function displayMeasurements(data) {
  const sizesDiv = document.getElementById('sizes');
  let chestInches = (data['Chest Circumference']).toFixed(2);
  let shoulderInches = (data['Shoulder Width']).toFixed(2);
  let hipInches = (data['Hip Length']).toFixed(2);
  let thighInches = (data['Thigh Circumference']).toFixed(2);
  
  sizesDiv.innerHTML = `
    Chest Circumference: ${chestInches} inch<br>
    Shoulder Width: ${shoulderInches} inch<br>
    Hip Length: ${hipInches} inch<br>
    Thigh Circumference: ${thighInches} inch
  `;
  
  let recommended = recommendedOverallSize(
    parseFloat(chestInches),
    parseFloat(shoulderInches),
    parseFloat(hipInches),
    parseFloat(thighInches)
  );
  document.getElementById('apparelSize').innerText = recommended;
}

function displayMeasurementsEast(data) {
  let chestInches = (data['Chest Circumference']).toFixed(2);
  let shoulderInches = (data['Shoulder Width']).toFixed(2);
  let hipInches = (data['Hip Length']).toFixed(2);
  let thighInches = (data['Thigh Circumference']).toFixed(2);
  
  let recommended = recommendedOverallSizeEast(
    parseFloat(chestInches),
    parseFloat(shoulderInches),
    parseFloat(hipInches),
    parseFloat(thighInches)
  );
  document.getElementById('apparelSizeEu').innerText = recommended;
}

function displayMeasurementsWest(data) {
  let chestInches = (data['Chest Circumference']).toFixed(2);
  let shoulderInches = (data['Shoulder Width']).toFixed(2);
  let hipInches = (data['Hip Length']).toFixed(2);
  let thighInches = (data['Thigh Circumference']).toFixed(2);
  
  let recommended = recommendedOverallSizeWest(
    parseFloat(chestInches),
    parseFloat(shoulderInches),
    parseFloat(hipInches),
    parseFloat(thighInches)
  );
  document.getElementById('apparelSizeEn').innerText = recommended;
}

function recommendedOverallSize(chest, shoulder, hip, thigh) {
  const sizeMapping = { "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5 };
  function recommendedSizeFromChest(chestInches) {
    if (chestInches < 17.9) return "XS";
    else if (chestInches < 19.1) return "S";
    else if (chestInches < 20.3) return "M";
    else if (chestInches < 21.45) return "L";
    else if (chestInches < 22.6) return "XL";
    else return "XXL";
  }
  function recommendedSizeFromShoulder(shoulderInches) {
    if (shoulderInches < 16.1) return "XS";
    else if (shoulderInches < 16.9) return "S";
    else if (shoulderInches < 17.7) return "M";
    else if (shoulderInches < 18.5) return "L";
    else if (shoulderInches < 19.3) return "XL";
    else return "XXL";
  }
  function recommendedSizeFromLength(lengthInches) {
    if (lengthInches < 25.4) return "XS";
    else if (lengthInches < 26.6) return "S";
    else if (lengthInches < 27.75) return "M";
    else if (lengthInches < 28.7) return "L";
    else if (lengthInches < 29.5) return "XL";
    else return "XXL";
  }
  const chestSize = recommendedSizeFromChest(chest / 2);
  const shoulderSize = recommendedSizeFromShoulder(shoulder);
  const lengthSize = recommendedSizeFromLength(hip);
  const sizes = [chestSize, shoulderSize, lengthSize];
  const numericSizes = sizes.map(size => sizeMapping[size]);
  const maxSizeValue = Math.max(...numericSizes);
  return Object.keys(sizeMapping).find(key => sizeMapping[key] === maxSizeValue);
}

function recommendedOverallSizeEast(chest, shoulder, hip, thigh) {
  const sizeMapping = { "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5 };

  function recommendedSizeFromChest(chestInches) {
    // Retaining researched upper thresholds for Eastern sizing:
    if (chestInches < 17.15) return "XS";
    else if (chestInches < 17.9) return "S";
    else if (chestInches < 18.7) return "M";
    else if (chestInches < 19.5) return "L";
    else if (chestInches < 20.3) return "XL";
    else return "XXL";
  }

  function recommendedSizeFromShoulder(shoulderInches) {
    if (shoulderInches < 16.1) return "XS";
    else if (shoulderInches < 16.9) return "S";
    else if (shoulderInches < 17.7) return "M";
    else if (shoulderInches < 18.5) return "L";
    else if (shoulderInches < 19.3) return "XL";
    else return "XXL";
  }

  function recommendedSizeFromLength(lengthInches) {
    if (lengthInches < 25.4) return "XS";
    else if (lengthInches < 26.6) return "S";
    else if (lengthInches < 27.75) return "M";
    else if (lengthInches < 28.7) return "L";
    else if (lengthInches < 29.5) return "XL";
    else return "XXL";
  }

  // Note: as in your original code, the chest measurement is halved.
  const chestSize = recommendedSizeFromChest(chest / 2);
  const shoulderSize = recommendedSizeFromShoulder(shoulder);
  const lengthSize = recommendedSizeFromLength(hip);

  const sizes = [chestSize, shoulderSize, lengthSize];
  const numericSizes = sizes.map(size => sizeMapping[size]);
  const maxSizeValue = Math.max(...numericSizes);
  return Object.keys(sizeMapping).find(key => sizeMapping[key] === maxSizeValue);
}



function recommendedOverallSizeWest(chest, shoulder, hip, thigh) {
  const sizeMapping = { "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5 };

  function recommendedSizeFromChest(chestInches) {
    // Retaining researched upper thresholds for Western sizing:
    if (chestInches < 16.95) return "XS";
    else if (chestInches < 17.9) return "S";
    else if (chestInches < 18.9) return "M";
    else if (chestInches < 19.9) return "L";
    else if (chestInches < 21.05) return "XL";
    else return "XXL";
  }

  function recommendedSizeFromShoulder(shoulderInches) {
    if (shoulderInches < 16.1) return "XS";
    else if (shoulderInches < 16.9) return "S";
    else if (shoulderInches < 17.7) return "M";
    else if (shoulderInches < 18.5) return "L";
    else if (shoulderInches < 19.3) return "XL";
    else return "XXL";
  }

  function recommendedSizeFromLength(lengthInches) {
    if (lengthInches < 25.4) return "XS";
    else if (lengthInches < 26.6) return "S";
    else if (lengthInches < 27.75) return "M";
    else if (lengthInches < 28.7) return "L";
    else if (lengthInches < 29.5) return "XL";
    else return "XXL";
  }

  // As before, we use chest / 2.
  const chestSize = recommendedSizeFromChest(chest / 2);
  const shoulderSize = recommendedSizeFromShoulder(shoulder);
  const lengthSize = recommendedSizeFromLength(hip);

  const sizes = [chestSize, shoulderSize, lengthSize];
  const numericSizes = sizes.map(size => sizeMapping[size]);
  const maxSizeValue = Math.max(...numericSizes);
  return Object.keys(sizeMapping).find(key => sizeMapping[key] === maxSizeValue);
}



// --- Clothing Selection Functionality ---
let selectedCloth = null;
let clothingType = "upper";

document.addEventListener('DOMContentLoaded', function() {
  const clothes = [
    { src: "/static/images/1.png", label: "Dress 1" },
    { src: "/static/images/2.png", label: "Dress 2" },
    { src: "/static/images/3.png", label: "Dress 3" },
    { src: "/static/images/4.png", label: "Dress 4" },
    { src: "/static/images/5.png", label: "Dress 5" }
  ];
  const clothesGrid = document.querySelector('.clothes-grid');
  clothes.forEach((cloth, index) => {
    const img = document.createElement('img');
    img.src = cloth.src;
    img.alt = cloth.label;
    img.className = "clothing-item";
    img.addEventListener('click', function() {
      document.querySelectorAll('.clothing-item').forEach(item => item.classList.remove('selected'));
      img.classList.add('selected');
      selectedCloth = cloth.src;
    });
    clothesGrid.appendChild(img);
  });

  const clothUpload = document.getElementById('clothUpload');
  clothUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      selectedCloth = url;
      document.querySelectorAll('.clothing-item').forEach(item => item.classList.remove('selected'));
      const img = document.createElement('img');
      img.src = url;
      img.alt = "Uploaded Cloth";
      img.className = "clothing-item selected";
      clothesGrid.appendChild(img);
    }
  });

  const clothingTypeSelect = document.getElementById('clothingType');
  clothingTypeSelect.addEventListener('change', function(e) {
    clothingType = e.target.value;
  });
});

// Conversion factor slider handling
const sliders = document.querySelectorAll('input[type="range"]');
sliders.forEach(slider => {
  slider.addEventListener('input', (event) => {
    const key = event.target.name;
    const newValue = parseFloat(event.target.value);
    document.getElementById(key + '-value').innerText = newValue;
    fetch('/update_conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key, value: newValue })
    })
    .then(response => response.json())
    .then(data => console.log('Conversion factor updated', data))
    .catch(error => console.error('Error updating conversion factor:', error));
  });
});
