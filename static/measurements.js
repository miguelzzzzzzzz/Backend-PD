// --- measurements.js ---
// Handles fetching/displaying measurements and calculating recommended sizes.

// --- Size Recommendation Algorithms ---

// Base size mapping
const sizeMapping = { "XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5 };
const sizeKeys = Object.keys(sizeMapping);

// Helper to get size string from max numeric value
function getMaxSizeString(sizes) {
    const numericSizes = sizes.map(size => sizeMapping[size]).filter(val => val !== undefined); // Filter out undefined if a size is invalid
    if (numericSizes.length === 0) return "N/A"; // Handle case where no valid sizes are found
    const maxSizeValue = Math.max(...numericSizes);
    return sizeKeys.find(key => sizeMapping[key] === maxSizeValue) || "N/A";
}

// Size calculation logic (Original / Potentially Asian Fit)
function recommendedOverallSize(chestCm, shoulderCm, hipCm) { // Removed thigh as it wasn't used
    function recommendedSizeFromChest(cm) {
        if (cm < 45.5) return "XS";
        else if (cm < 48.5) return "S";
        else if (cm < 51.5) return "M";
        else if (cm < 54.5) return "L";
        else if (cm < 57.5) return "XL";
        else return "XXL";
    }
    function recommendedSizeFromShoulder(cm) {
        if (cm < 41) return "XS";
        else if (cm < 43) return "S";
        else if (cm < 45) return "M";
        else if (cm < 47) return "L";
        else if (cm < 49) return "XL";
        else return "XXL";
    }
    function recommendedSizeFromLength(cm) { // Renamed from hip to length based on variable name in original function
        if (cm < 64.5) return "XS";
        else if (cm < 67.5) return "S";
        else if (cm < 70.5) return "M";
        else if (cm < 73) return "L";
        else if (cm < 75) return "XL";
        else return "XXL";
    }
    const chestSize = recommendedSizeFromChest(chestCm / 2); // Assuming chestCm is circumference
    const shoulderSize = recommendedSizeFromShoulder(shoulderCm);
    const lengthSize = recommendedSizeFromLength(hipCm); // Using hip measurement for length
    return getMaxSizeString([chestSize, shoulderSize, lengthSize]);
}

// Size calculation logic (East / EU Fit) - Measurements assumed in CM
function recommendedOverallSizeEast(chestCm, shoulderCm, hipCm) {
     function recommendedSizeFromChest(cm) {
        if (cm < 43.5) return "XS";
        else if (cm < 45.5) return "S";
        else if (cm < 47.5) return "M";
        else if (cm < 49.5) return "L";
        else if (cm < 51.5) return "XL";
        else return "XXL";
    }
    function recommendedSizeFromShoulder(cm) {
        if (cm < 41) return "XS";
        else if (cm < 43) return "S";
        else if (cm < 45) return "M";
        else if (cm < 47) return "L";
        else if (cm < 49) return "XL";
        else return "XXL";
    }
    function recommendedSizeFromLength(cm) {
        if (cm < 64.5) return "XS";
        else if (cm < 67.5) return "S";
        else if (cm < 70.5) return "M";
        else if (cm < 73) return "L";
        else if (cm < 75) return "XL";
        else return "XXL";
    }
    const chestSize = recommendedSizeFromChest(chestCm / 2);
    const shoulderSize = recommendedSizeFromShoulder(shoulderCm);
    const lengthSize = recommendedSizeFromLength(hipCm);
    return getMaxSizeString([chestSize, shoulderSize, lengthSize]);
}

// Size calculation logic (West / EN/US Fit) - Measurements assumed in CM
function recommendedOverallSizeWest(chestCm, shoulderCm, hipCm) {
    function recommendedSizeFromChest(cm) {
        if (cm < 43) return "XS";
        else if (cm < 45.5) return "S";
        else if (cm < 48) return "M";
        else if (cm < 50.5) return "L";
        else if (cm < 53.5) return "XL";
        else return "XXL";
    }
     function recommendedSizeFromShoulder(cm) {
        if (cm < 41) return "XS";
        else if (cm < 43) return "S";
        else if (cm < 45) return "M";
        else if (cm < 47) return "L";
        else if (cm < 49) return "XL";
        else return "XXL";
    }
    function recommendedSizeFromLength(cm) {
        if (cm < 64.5) return "XS";
        else if (cm < 67.5) return "S";
        else if (cm < 70.5) return "M";
        else if (cm < 73) return "L";
        else if (cm < 75) return "XL";
        else return "XXL";
    }
    const chestSize = recommendedSizeFromChest(chestCm / 2);
    const shoulderSize = recommendedSizeFromShoulder(shoulderCm);
    const lengthSize = recommendedSizeFromLength(hipCm);
    return getMaxSizeString([chestSize, shoulderSize, lengthSize]);
}


// --- Measurement Display Functions ---

/**
 * Fetches measurements from the backend.
 * @returns {Promise<Object>} A promise that resolves with the measurement data.
 */
export function fetchMeasurements() {
    return fetch('/measurements')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error('Error fetching measurements:', error);
            // Return a default/empty object or re-throw to handle upstream
            return {};
        });
}


/**
 * Displays the raw measurements and calculates the primary recommended size.
 * @param {Object} data - The measurement data object from the backend.
 */
export function displayMeasurements(data) {
    const sizesDiv = document.getElementById('sizes');
    if (!sizesDiv || !data || typeof data !== 'object') return; // Basic validation

    // Use || 0 as a fallback if a measurement is missing
    let chestCm = (data['Chest Circumference'] || 0).toFixed(2);
    let shoulderCm = (data['Shoulder Width'] || 0).toFixed(2);
    let hipCm = (data['Hip Length'] || 0).toFixed(2); // Assuming this is 'length' for sizing
    let thighCm = (data['Thigh Circumference'] || 0).toFixed(2); // Keep for display even if not used in size calc

    sizesDiv.innerHTML = `
        Chest Circumference: ${chestCm} cm<br>
        Shoulder Width: ${shoulderCm} cm<br>
        Hip Length: ${hipCm} cm<br>
        Thigh Circumference: ${thighCm} cm
    `;

    let recommended = recommendedOverallSize(
        parseFloat(chestCm),
        parseFloat(shoulderCm),
        parseFloat(hipCm)
        // parseFloat(thighCm) // Not used in this specific function
    );
    const apparelSizeEl = document.getElementById('apparelSize');
    if (apparelSizeEl) {
        apparelSizeEl.innerText = recommended;
    }
}

/**
 * Displays measurements converted for East/EU sizing and calculates the recommended size.
 * Assumes input data might be in inches and converts to cm if needed (adjust multiplier if input is already cm).
 * @param {Object} data - The measurement data object from the backend.
 */
export function displayMeasurementsEast(data) {
    const apparelSizeEuEl = document.getElementById('apparelSizeEu');
    if (!apparelSizeEuEl || !data || typeof data !== 'object') return;

    // Assuming input 'data' values might need conversion from inches to cm.
    // If 'data' is already in cm, remove the '* 2.54'.
    const cmMultiplier = 1.0; // CHANGE TO 2.54 IF INPUT DATA IS IN INCHES
    let chestCm = ((data['Chest Circumference'] || 0) * cmMultiplier).toFixed(2);
    let shoulderCm = ((data['Shoulder Width'] || 0) * cmMultiplier).toFixed(2);
    let hipCm = ((data['Hip Length'] || 0) * cmMultiplier).toFixed(2);
    // let thighCm = ((data['Thigh Circumference'] || 0) * cmMultiplier).toFixed(2); // Not used in size calc

    let recommended = recommendedOverallSizeEast(
        parseFloat(chestCm),
        parseFloat(shoulderCm),
        parseFloat(hipCm)
    );
    apparelSizeEuEl.innerText = recommended;
}

/**
 * Displays measurements converted for West/EN/US sizing and calculates the recommended size.
 * Assumes input data might be in inches and converts to cm if needed (adjust multiplier if input is already cm).
 * @param {Object} data - The measurement data object from the backend.
 */
export function displayMeasurementsWest(data) {
     const apparelSizeEnEl = document.getElementById('apparelSizeEn');
    if (!apparelSizeEnEl || !data || typeof data !== 'object') return;

    // Assuming input 'data' values might need conversion from inches to cm.
    // If 'data' is already in cm, remove the '* 2.54'.
    const cmMultiplier = 1.0; // CHANGE TO 2.54 IF INPUT DATA IS IN INCHES
    let chestCm = ((data['Chest Circumference'] || 0) * cmMultiplier).toFixed(2);
    let shoulderCm = ((data['Shoulder Width'] || 0) * cmMultiplier).toFixed(2);
    let hipCm = ((data['Hip Length'] || 0) * cmMultiplier).toFixed(2);
     // let thighCm = ((data['Thigh Circumference'] || 0) * cmMultiplier).toFixed(2); // Not used in size calc

    let recommended = recommendedOverallSizeWest(
        parseFloat(chestCm),
        parseFloat(shoulderCm),
        parseFloat(hipCm)
    );
    apparelSizeEnEl.innerText = recommended;
}

console.log("measurements.js loaded"); // For debugging