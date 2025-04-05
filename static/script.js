// --- FUNCTIONALITY CODE: JavaScript ---

// Toggle functionality to switch between Live Feed and Upload Image
document.getElementById('toggleMode').addEventListener('change', function() {
    if (this.checked) {
      // Switch to Upload Image mode
      document.getElementById('liveFeedContainer').style.display = 'none';
      document.getElementById('uploadContainer').style.display = 'block';
      document.getElementById('liveLabel').classList.remove('active');
      document.getElementById('uploadLabel').classList.add('active');
    } else {
      // Switch to Live Feed mode; reset upload container display
      document.getElementById('liveFeedContainer').style.display = 'block';
      document.getElementById('uploadContainer').style.display = 'none';
      document.getElementById('liveLabel').classList.add('active');
      document.getElementById('uploadLabel').classList.remove('active');
      // Reset upload container elements if needed
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
      // Hide the upload box and show the uploaded image
      document.querySelector('#uploadContainer .upload-box').style.display = 'none';
      const uploadedImage = document.getElementById('uploadedImage');
      uploadedImage.src = url;
      uploadedImage.style.display = 'block';
    }
  }
  
  // Snapshot and Calibration functions
  function takeSnapshot(duration) {
    fetch('/measurements')
      .then(response => response.json())
      .then(data => {
        displayMeasurements(data);
        displayMeasurementsEast(data);
        displayMeasurementsWest(data);
      })
      .catch(error => console.error('Error fetching measurements:', error));
  
    fetch(`/snapshot?duration=${duration}`)
      .then(response => response.json())
      .then(data => {
        const base64Image = data.image;
        document.getElementById('snapshotImg').src = 'data:image/jpeg;base64,' + base64Image;
      })
      .catch(error => console.error('Error taking snapshot:', error));
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
    let chestInches = (data['Chest Circumference'] / 7.6).toFixed(2);
    let shoulderInches = (data['Shoulder Width'] / 6.9).toFixed(2);
    let hipInches = (data['Hip Length'] / 4.6).toFixed(2);
    let thighInches = (data['Thigh Circumference'] / 8.6).toFixed(2);
    
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
    let chestInches = (data['Chest Circumference'] / 7.6).toFixed(2);
    let shoulderInches = (data['Shoulder Width'] / 6.9).toFixed(2);
    let hipInches = (data['Hip Length'] / 4.6).toFixed(2);
    let thighInches = (data['Thigh Circumference'] / 8.6).toFixed(2);
    
    let recommended = recommendedOverallSizeEast(
      parseFloat(chestInches),
      parseFloat(shoulderInches),
      parseFloat(hipInches),
      parseFloat(thighInches)
    );
    document.getElementById('apparelSizeEu').innerText = recommended;
  }
  
  function displayMeasurementsWest(data) {
    let chestInches = (data['Chest Circumference'] / 7.6).toFixed(2);
    let shoulderInches = (data['Shoulder Width'] / 6.9).toFixed(2);
    let hipInches = (data['Hip Length'] / 4.6).toFixed(2);
    let thighInches = (data['Thigh Circumference'] / 8.6).toFixed(2);
    
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
    function recommendedSizeFromChest(chestWidthInches) {
      if (chestWidthInches >= 15.95 && chestWidthInches <= 17.15) return "XS";
      else if (chestWidthInches >= 16.75 && chestWidthInches <= 17.9) return "S";
      else if (chestWidthInches >= 17.5 && chestWidthInches <= 18.7) return "M";
      else if (chestWidthInches >= 18.3 && chestWidthInches <= 19.5) return "L";
      else if (chestWidthInches >= 19.1 && chestWidthInches <= 20.3) return "XL";
      else if (chestWidthInches >= 20.0 && chestWidthInches <= 21.05) return "XXL";
      else return "Size out of range";
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
  
  function recommendedOverallSizeWest(chest, shoulder, hip, thigh) {
    const sizeMapping = { "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5 };
    function recommendedSizeFromChest(chestWidthInches) {
      if (chestWidthInches >= 15.95 && chestWidthInches <= 16.95) return "XS";
      else if (chestWidthInches >= 16.95 && chestWidthInches <= 17.9) return "S";
      else if (chestWidthInches >= 17.9 && chestWidthInches <= 18.9) return "M";
      else if (chestWidthInches >= 18.9 && chestWidthInches <= 19.9) return "L";
      else if (chestWidthInches >= 19.9 && chestWidthInches <= 21.05) return "XL";
      else if (chestWidthInches >= 21.05 && chestWidthInches <= 22.25) return "XXL";
      else return "Size out of range";
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
  
  // Clothing Selection Functionality
  let selectedCloth = null;
  let clothingType = "upper";
  
  document.addEventListener('DOMContentLoaded', function() {
    const clothes = [
      { src: "/shirt.jpg", label: "Black Shirt" },
      { src: "/uniform.jpg", label: "Brown Shirt" },
      { src: "/aaaa.jpg", label: "Plaid Shirt" },
      { src: "/jeans.png", label: "Jeans" },
      { src: "/shirt.jpg", label: "Black Shirt" },
      { src: "/uniform.jpg", label: "Brown Shirt" },
      { src: "/aaaa.jpg", label: "Plaid Shirt" },
      { src: "/jeans.png", label: "Jeans" },
      { src: "/shirt.jpg", label: "Black Shirt" },
      { src: "/uniform.jpg", label: "Brown Shirt" },
      { src: "/aaaa.jpg", label: "Plaid Shirt" },
      { src: "/jeans.png", label: "Jeans" }
    ];
    const clothesGrid = document.querySelector('.clothes-grid');
    clothes.forEach((cloth, index) => {
      const img = document.createElement('img');
      img.src = cloth.src;
      img.alt = cloth.label;
      img.className = "clothing-item";
      img.addEventListener('click', function() {
        // Remove "selected" class from all items
        document.querySelectorAll('.clothing-item').forEach(item => item.classList.remove('selected'));
        img.classList.add('selected');
        selectedCloth = cloth.src;
      });
      clothesGrid.appendChild(img);
    });
  
    // Handle file upload for cloth selection
    const clothUpload = document.getElementById('clothUpload');
    clothUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if(file) {
        const url = URL.createObjectURL(file);
        selectedCloth = url;
        // Remove selected class from existing images
        document.querySelectorAll('.clothing-item').forEach(item => item.classList.remove('selected'));
        // Optionally, add the uploaded image to the grid and mark it as selected
        const img = document.createElement('img');
        img.src = url;
        img.alt = "Uploaded Cloth";
        img.className = "clothing-item selected";
        clothesGrid.appendChild(img);
      }
    });
  
    // Handle clothing type selection change
    const clothingTypeSelect = document.getElementById('clothingType');
    clothingTypeSelect.addEventListener('change', function(e) {
      clothingType = e.target.value;
    });
  });
  
  // Submit function for clothing selection
  function handleSubmit() {
    alert(`Submitted!\nClothing Type: ${clothingType}\nCloth Selected: ${selectedCloth || "None"}`);
  }
  
  // Conversion factor slider handling (if any slider exists in the document)
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
  