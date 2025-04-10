// --- clothing.js ---
// Manages clothing selection, custom uploads, type selection, and configuration sliders.

let selectedCloth = null; // Stores the src/URL of the selected cloth
let clothingType = "upper"; // Default clothing type

// Function to get the currently selected cloth URL/src
export function getSelectedCloth() {
    return selectedCloth;
}

// Function to get the currently selected clothing type
export function getClothingType() {
    return clothingType;
}

// Helper function to convert URL to base64 (needed for uploaded cloth preview and potential reuse)
function convertURLToBase64(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                // Return the full data URL for potential preview use if needed,
                // or just the base64 part if only that is required elsewhere.
                // Sticking to full data URL for flexibility here.
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        }));
}


// Initialize clothing grid and event listeners when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // --- Clothing Selection ---
    const clothes = [ // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HERE IT IS
        { src: "/static/images/1.png", label: "Dress 1" },
        { src: "/static/images/2.png", label: "Dress 2" },
        { src: "/static/images/3.png", label: "Dress 3" },
        { src: "/static/images/4.png", label: "Dress 4" },
        { src: "/static/images/5.png", label: "Dress 5" }
    ]; // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< IT IS PRESENT
    const clothesGrid = document.querySelector('.clothes-grid');

    // Check if clothesGrid exists before proceeding
    if (clothesGrid) {
        clothes.forEach((cloth) => { // <<<<<<<<<<<<<<<<<<<<<<<<< AND USED HERE
            const img = document.createElement('img');
            img.src = cloth.src;
            img.alt = cloth.label;
            img.className = "clothing-item";
            img.addEventListener('click', function() {
                // Remove selected class from any previously selected item (including uploaded ones)
                document.querySelectorAll('.clothing-item.selected').forEach(item => item.classList.remove('selected'));
                // Add selected class to the clicked item
                img.classList.add('selected');
                selectedCloth = cloth.src; // Store the src of the selected predefined cloth
                console.log("Selected cloth:", selectedCloth);
            });
            clothesGrid.appendChild(img);
        });
    } else {
        console.warn("Element with class '.clothes-grid' not found for clothing items.");
    }

    // --- Custom Cloth Upload ---
    const clothUploadInput = document.getElementById('clothUpload');
    clothUploadInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);

            // Deselect any previously selected item
            document.querySelectorAll('.clothing-item.selected').forEach(item => item.classList.remove('selected'));

            // Check if an uploaded image already exists, replace it; otherwise, create a new one
            let uploadedImg = clothesGrid.querySelector('img[alt="Uploaded Cloth"]');
            if (!uploadedImg) {
                uploadedImg = document.createElement('img');
                uploadedImg.alt = "Uploaded Cloth";
                uploadedImg.className = "clothing-item";
                 // Add click listener similar to predefined clothes
                uploadedImg.addEventListener('click', function() {
                    document.querySelectorAll('.clothing-item.selected').forEach(item => item.classList.remove('selected'));
                    uploadedImg.classList.add('selected');
                    selectedCloth = uploadedImg.src; // Store the blob URL
                    console.log("Selected cloth (uploaded):", selectedCloth);
                });
                clothesGrid.appendChild(uploadedImg); // Append only if new
            }

            uploadedImg.src = url; // Update src (for new or existing)
            uploadedImg.classList.add('selected'); // Mark as selected
            selectedCloth = url; // Store the blob URL of the uploaded cloth
            console.log("Selected cloth (uploaded):", selectedCloth);

            // Optionally clear the file input value if you want to allow uploading the same file again
             // e.target.value = null;
        }
    });

    // --- Clothing Type Selection ---
    const clothingTypeSelect = document.getElementById('clothingType');
    if (clothingTypeSelect) {
         clothingType = clothingTypeSelect.value; // Initialize with current value
         clothingTypeSelect.addEventListener('change', function(e) {
            clothingType = e.target.value;
            console.log("Clothing type changed to:", clothingType);
        });
    }


    // --- Conversion Factor Sliders ---
    const sliders = document.querySelectorAll('input[type="range"].conversion-slider'); // Add a class to sliders for specificity
    sliders.forEach(slider => {
        // Initial display update
        const initialValue = parseFloat(slider.value);
        const valueSpan = document.getElementById(slider.name + '-value');
         if (valueSpan) {
            valueSpan.innerText = initialValue.toFixed(2); // Use toFixed for consistency
         } else {
             console.warn(`Value display element not found for slider: ${slider.name}-value`);
         }


        slider.addEventListener('input', (event) => {
            const key = event.target.name;
            const newValue = parseFloat(event.target.value);
             const displaySpan = document.getElementById(key + '-value');
             if (displaySpan) {
                displaySpan.innerText = newValue.toFixed(2); // Update display
             }

            // Send update to backend
            fetch('/update_conversion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key, value: newValue })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => console.log('Conversion factor updated:', data))
            .catch(error => console.error('Error updating conversion factor:', error));
        });
    });
});

console.log("clothing.js loaded"); // For debugging