from flask import Flask, render_template, Response, request, jsonify
import cv2
import mediapipe as mp
import math
import time
import base64
import requests
import numpy as np  # Add numpy for image decoding
import io           # Add io for handling bytes
from PIL import Image # Add PIL for easier image handling from bytes

app = Flask(__name__)

# Setup MediaPipe Pose
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose
pose_processor = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) # Reusable processor

# Global variables
last_measurements = {}
last_frame = None
snapshot_request = {"active": False, "duration": 0, "start_time": None}

# Global conversion factors (modifiable via the GUI or calibration)
conversion_factors = {
    'Chest Circumference': 7.6,  # Store base factors, apply cm conversion later
    'Shoulder Width': 6.9,
    'Hip Length': 4.6,
    'Thigh Circumference': 8.6,
}

# --- Helper Functions (Keep existing ones like image_to_base64, calculate_distance) ---

def image_to_base64(image_path):
    # ... (keep existing code) ...
    with open(image_path, "rb") as img_file:
        encoded_string = base64.b64encode(img_file.read()).decode("utf-8")
    return encoded_string

def calculate_distance(point1, point2, image_width, image_height):
    # ... (keep existing code) ...
    x1, y1 = int(point1.x * image_width), int(point1.y * image_height)
    x2, y2 = int(point2.x * image_width), int(point2.y * image_height)
    return math.hypot(x2 - x1, y2 - y1)

# --- Refactored Measurement Calculation ---
def calculate_pixel_measurements(landmarks, image_width, image_height):
    """Calculates raw pixel measurements from landmarks."""
    try:
        chest_factor = 2.6
        hip_factor   = 2.8
        thigh_factor = 2.6

        chest_width = calculate_distance(
            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
            image_width, image_height)
        shoulder_length = chest_width # Use chest_width directly for shoulder

        hip_length = calculate_distance(
            landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
            image_width, image_height)

        # Thigh calculation might need refinement depending on pose/visibility
        # Using hip width as a proxy for thigh calculation base here, adjust if needed
        thigh_base_width = hip_length # Approximation, might need better landmarks if available
        thigh_circumference = thigh_base_width * thigh_factor # Approximation

        return {
            'Chest Circumference': chest_width * chest_factor, # Raw value related to pixels * factor
            'Shoulder Width': shoulder_length,                # Raw pixel distance
            'Hip Length': hip_length * hip_factor, # Raw value related to pixels * factor
            'Thigh Circumference': thigh_circumference, # Raw value related to pixels * factor
        }
    except Exception as e:
        print(f"Error calculating pixel measurements: {e}")
        # Return None for all if calculation fails for any part
        return {key: None for key in conversion_factors.keys()}


def convert_pixels_to_cm(pixel_measurements):
    """Converts pixel measurements to CM using global factors."""
    global conversion_factors
    converted = {}
    cm_per_inch = 2.54
    for key, value in pixel_measurements.items():
        factor = conversion_factors.get(key)
        if value is not None and factor is not None and factor != 0:
             # The factor here represents pixels per inch originally,
             # so value (pixels) / factor (pixels/inch) gives inches.
             # Then multiply by cm_per_inch.
            centimeters = (value / factor) * cm_per_inch
            converted[key] = round(centimeters, 2)
        else:
            converted[key] = None # Keep as None if calculation wasn't possible
    return converted

# --- MediaPipe Processing for a single image ---
def process_image_for_measurements(image_np):
    """Runs MediaPipe Pose on a single NumPy image array and returns pixel measurements."""
    global pose_processor # Use the global processor
    image_height, image_width, _ = image_np.shape
    image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False
    results = pose_processor.process(image_rgb)
    image_rgb.flags.writeable = True # Good practice

    if results.pose_landmarks:
        pixel_measurements = calculate_pixel_measurements(results.pose_landmarks.landmark, image_width, image_height)
        return pixel_measurements
    else:
        # Return None for all measurements if no pose is detected
        return {key: None for key in conversion_factors.keys()}

# --- Live Feed Generation (Modified to use refactored calculation) ---
def gen_frames():
    global last_frame, snapshot_request, last_measurements
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 720)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    # Use the single global pose processor instance
    global pose_processor

    while True:
        success, frame = cap.read()
        if not success:
            print("Failed to grab frame")
            time.sleep(0.1) # Avoid busy-waiting
            continue # Try again

        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        frame = cv2.flip(frame, 1)
        frame = cv2.resize(frame, (720, 1080))

        # Process for landmarks and get pixel measurements
        current_pixel_measurements = process_image_for_measurements(frame.copy()) # Pass a copy

        # Store the raw pixel measurements globally for calibration/potential reuse
        last_measurements = current_pixel_measurements

        # Convert to CM for display overlay
        display_cm_measurements = convert_pixels_to_cm(current_pixel_measurements)

        # Draw landmarks if detected (using results from process_image...)
        # Need to re-run process or store results if needed for drawing
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False
        results = pose_processor.process(image_rgb) # Re-run for drawing (or store previous results)
        image_rgb.flags.writeable = True
        frame = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR) # Convert back if needed

        if results.pose_landmarks:
             mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        # Overlay CM measurements
        y0, dy = 30, 30
        for i, (key, value) in enumerate(display_cm_measurements.items()):
            display_text = f"{key}: {value:.2f} cm" if value is not None else f"{key}: N/A"
            cv2.putText(frame, display_text, (10, y0 + i * dy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        last_frame = frame.copy() # Store the frame with overlays

        frame_to_stream = frame.copy()
        if snapshot_request["active"]:
            # ... (keep countdown timer code) ...
             elapsed = time.time() - snapshot_request["start_time"]
             remaining = snapshot_request["duration"] - int(elapsed)
             if remaining < 0:
                 remaining = 0
             countdown_text = f"Snapshot in: {remaining}s"
             cv2.putText(frame_to_stream, countdown_text, (200, 540),
                         cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)


        ret, buffer = cv2.imencode('.jpg', frame_to_stream)
        if not ret:
            print("Failed to encode frame")
            continue
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    print("Releasing camera capture")
    cap.release()
    # pose_processor.close() # Close MediaPipe processor if script ends

# --- Routes ---

@app.route('/')
def index():
    # Convert factors to cm for display in sliders/calibration initially
    display_factors = {k: v * 2.54 for k,v in conversion_factors.items()}
    return render_template('index.html', conversion_factors=display_factors)

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture')
def capture():
    # ... (keep existing code, ensures last_frame is captured) ...
    global snapshot_request, last_frame
    duration = int(request.args.get('duration', 3))
    snapshot_request["active"] = True
    snapshot_request["duration"] = duration
    snapshot_request["start_time"] = time.time()
    time.sleep(duration) # Consider async await if blocking is an issue
    snapshot_request["active"] = False

    if last_frame is None:
         return jsonify({"error": "No frame captured yet"}), 500

    ret, buffer = cv2.imencode('.jpg', last_frame)
    if not ret:
        return jsonify({"error": "Failed to encode snapshot"}), 500

    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    # cv2.imwrite("last_frame.jpg", last_frame) # Optional: save for debugging
    return jsonify({"image": jpg_as_text})


@app.route('/process_snapshot', methods=['POST'])
def process_snapshot():
    # ... (keep existing code for try-on) ...
    data = request.get_json()
    image_base64 = data.get("image")
    cloth_type = data.get("cloth_type", "upper")
    selected_cloth = data.get("selected_cloth")

    # Use the provided cloth image or fall back to a default image.
    if not selected_cloth:
        # Make sure 'paldo1.jpg' exists or handle the error
        try:
            cloth_image = image_to_base64('paldo1.jpg')
        except FileNotFoundError:
             return jsonify({"error": "Default cloth image not found"}), 500
    else:
        cloth_image = selected_cloth

    payload = {
        "person_image": image_base64,
        "cloth_image": cloth_image,
        "cloth_type": cloth_type,
    }

    # Make sure the ngrok URL is correct and the service is running
    try_on_url = "https://99ab-34-125-202-23.ngrok-free.app//tryon" # Ensure no double slash if base URL has one
    try:
        response = requests.post(try_on_url, json=payload, timeout=60) # Add timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        result_image = response.json().get('result_image')
        if not result_image:
             return jsonify({"error": "Try-on service did not return an image"}), 500
        return jsonify({"image": result_image})
    except requests.exceptions.RequestException as e:
        print(f"Error contacting try-on service: {e}")
        return jsonify({"error": f"Could not connect to try-on service: {e}"}), 503 # Service Unavailable
    except Exception as e:
        print(f"Error processing try-on response: {e}")
        return jsonify({"error": f"Error processing try-on response: {e}"}), 500


@app.route('/measurements')
def measurements():
    """Returns the latest measurements CALCULATED FROM THE LIVE FEED."""
    # This endpoint now returns the latest calculated CM values from the feed
    global last_measurements # This holds PIXEL measurements
    converted_measurements = convert_pixels_to_cm(last_measurements)
    return jsonify(converted_measurements)

# --- NEW ENDPOINT ---
@app.route('/calculate_measurements_from_image', methods=['POST'])
def calculate_measurements_from_image():
    """Calculates measurements from a provided Base64 image."""
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400

    image_base64 = data['image']

    try:
        # Decode Base64
        image_bytes = base64.b64decode(image_base64)
        # Convert bytes to NumPy array using PIL for robustness
        image_pil = Image.open(io.BytesIO(image_bytes))
        image_np = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR) # Convert PIL Image to OpenCV BGR format

    except (base64.binascii.Error, ValueError) as e:
        print(f"Error decoding base64 or loading image: {e}")
        return jsonify({"error": "Invalid image data"}), 400
    except Exception as e:
        print(f"Unexpected error during image decoding: {e}")
        return jsonify({"error": "Failed to process image data"}), 500


    # Process the single image for pixel measurements
    pixel_measurements = process_image_for_measurements(image_np)

    # Convert pixel measurements to CM
    cm_measurements = convert_pixels_to_cm(pixel_measurements)

    # Return the CM measurements
    return jsonify(cm_measurements)


@app.route('/update_conversion', methods=['POST'])
def update_conversion():
    # ... (keep existing code, but ensure it updates the base factors) ...
    global conversion_factors
    data = request.get_json()
    key = data.get('key')
    # The value from the slider is likely already in 'cm', but our factors are pixels/inch.
    # We need to decide how the slider value relates to the factor.
    # Assuming the slider represents the desired CM measurement for a reference object,
    # and we know the pixel measurement of that object, the factor would be pixels / (desired_cm / 2.54).
    # This is complex without knowing the calibration process precisely.
    # Let's *assume* for now the slider directly sets the PIXELS/INCH factor for simplicity.
    # The frontend needs to send the raw factor value.
    value = data.get('value') # Assume this is the desired pixels/inch factor

    if key in conversion_factors and isinstance(value, (int, float)):
        conversion_factors[key] = float(value) # Directly update the factor
        print(f"Updated conversion factor {key}: {conversion_factors[key]}")
        return jsonify({'status': 'success', 'conversion_factors': conversion_factors})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid key or value'}), 400

@app.route('/calibrate', methods=['POST'])
def calibrate():
    # ... (Keep existing calibration logic - it uses last_measurements (pixels)
    #      and fixed_sizes (cm) to update conversion_factors (pixels/inch)) ...
    global conversion_factors, last_measurements
    # These fixed sizes should be in CM
    fixed_sizes = {
        'Chest Circumference': 96.52,  # 38 inches in cm
        'Shoulder Width': 40.64,       # 16 inches in cm
        'Hip Length': 38.1,            # 15 inches in cm - Check if this is hip CIRCUMFERENCE or width? Assuming width for now.
        'Thigh Circumference': 50.8,   # 20 inches in cm
    }
    cm_per_inch = 2.54
    updated_factors = {} # Store the *new* factors (pixels/inch)

    if not last_measurements or any(v is None for v in last_measurements.values()):
        return jsonify({'status': 'error', 'message': 'Incomplete or no measurements available from live feed for calibration.'}), 400

    print(f"Calibrating with pixel measurements: {last_measurements}")
    print(f"Current factors (pixels/inch): {conversion_factors}")

    for key, fixed_size_cm in fixed_sizes.items():
        if key in last_measurements and last_measurements[key] is not None and last_measurements[key] > 0:
            measured_pixels = last_measurements[key]
            fixed_size_inches = fixed_size_cm / cm_per_inch

            # Calculate the new factor: pixels / inches
            new_factor = measured_pixels / fixed_size_inches
            conversion_factors[key] = new_factor
            updated_factors[key] = new_factor # Store the factor itself (pixels/inch)

        else:
             print(f"Skipping calibration for {key}: measurement not available or zero.")


    print(f"Calibration complete. New factors: {conversion_factors}")
    # Return the updated *factors* (pixels/inch) so the frontend sliders can be updated
    return jsonify({'status': 'calibrated', 'updated_factors': updated_factors})


if __name__ == '__main__':
    # When running, ensure the pose processor is initialized
    # with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    #    pose_processor = pose # Assign to global
    #    app.run(debug=True, host='0.0.0.0') # Use 0.0.0.0 to be accessible on network
    # Simpler approach for debug: rely on the global initialization
     app.run(debug=True) # Add host='0.0.0.0' if needed