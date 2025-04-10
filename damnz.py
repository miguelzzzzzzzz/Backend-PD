from flask import Flask, render_template, Response, request, jsonify
import cv2
import mediapipe as mp
import math
import time
import base64
import requests

app = Flask(__name__)

# Setup MediaPipe Pose
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# Global variables
last_measurements = {}
last_frame = None
snapshot_request = {"active": False, "duration": 0, "start_time": None}

def image_to_base64(image_path):
    with open(image_path, "rb") as img_file:
        encoded_string = base64.b64encode(img_file.read()).decode("utf-8")
    return encoded_string

# Global conversion factors (modifiable via the GUI or calibration)
conversion_factors = {
    'Chest Circumference': 7.6 * 2.54,  # Converted to cm
    'Shoulder Width': 6.9 * 2.54,       # Converted to cm
    'Hip Length': 4.6 * 2.54,           # Converted to cm
    'Thigh Circumference': 8.6 * 2.54,  # Converted to cm
}

def calculate_distance(point1, point2, image_width, image_height):
    x1, y1 = int(point1.x * image_width), int(point1.y * image_height)
    x2, y2 = int(point2.x * image_width), int(point2.y * image_height)
    return math.hypot(x2 - x1, y2 - y1)

def update_measurements(landmarks, image_width, image_height):
    global last_measurements
    chest_factor = 2.6
    hip_factor   = 2.8
    thigh_factor = 2.6

    chest_width = calculate_distance(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        image_width, image_height)
    chest_circumference = chest_width * chest_factor
    shoulder_length = chest_width
    hip_length = calculate_distance(
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        image_width, image_height)
    thigh_length = calculate_distance(
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        image_width, image_height)
    thigh_circumference = thigh_length * thigh_factor

    last_measurements = {
        'Chest Circumference': int(chest_circumference),
        'Shoulder Width': int(shoulder_length),
        'Hip Length': int(hip_length),
        'Thigh Circumference': int(thigh_circumference),
    }
    return last_measurements

def overlay_measurements(image, measurements):
    global conversion_factors
    y0 = 30
    dy = 30
    for i, (key, value) in enumerate(measurements.items()):
        if value is not None:
            conversion = conversion_factors.get(key, 1)
            centimeters = value / conversion
            display_value = f"{centimeters:.2f} cm"
        else:
            display_value = "N/A"
        cv2.putText(image, f"{key}: {display_value}", (10, y0 + i * dy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    return image

def gen_frames():
    global last_frame, snapshot_request
    cap = cv2.VideoCapture(0)
    # Set portrait resolution (720x1080 instead of 1080x720)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 720)   # Height becomes width
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)  # Width becomes height
    
    with mp_pose.Pose(min_detection_confidence=0.5, 
                      min_tracking_confidence=0.5) as pose:
        while True:
            success, frame = cap.read()
            if not success:
                break

            # Rotate the frame 90 degrees clockwise for proper portrait orientation
            frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
            frame = cv2.flip(frame, 1)  # Mirror effect
            
            # Resize to maintain portrait aspect (optional)
            frame = cv2.resize(frame, (720, 1080))
            image_height, image_width, _ = frame.shape

            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image_rgb.flags.writeable = False
            results = pose.process(image_rgb)
            image_rgb.flags.writeable = True
            frame = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

            # Update measurements if landmarks are detected
            if results.pose_landmarks:
                update_measurements(results.pose_landmarks.landmark, image_width, image_height)
                mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            frame = overlay_measurements(frame, last_measurements)
            last_frame = frame.copy()

            frame_to_stream = frame.copy()
            if snapshot_request["active"]:
                elapsed = time.time() - snapshot_request["start_time"]
                remaining = snapshot_request["duration"] - int(elapsed)
                if remaining < 0:
                    remaining = 0
                # Adjust text position for portrait mode
                countdown_text = f"Snapshot in: {remaining}s"
                cv2.putText(frame_to_stream, countdown_text, (200, 540),  # Adjusted coordinates
                            cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

            ret, buffer = cv2.imencode('.jpg', frame_to_stream)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    cap.release()

@app.route('/')
def index():
    return render_template('index.html', conversion_factors=conversion_factors)

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture')
def capture():
    """
    Captures the current frame after waiting for the specified duration and returns it as a base64 image.
    No processing is done here.
    """
    global snapshot_request, last_frame
    duration = int(request.args.get('duration', 3))
    snapshot_request["active"] = True
    snapshot_request["duration"] = duration
    snapshot_request["start_time"] = time.time()
    time.sleep(duration)
    snapshot_request["active"] = False
    ret, buffer = cv2.imencode('.jpg', last_frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    cv2.imwrite("last_frame.jpg", last_frame)
    return jsonify({"image": jpg_as_text})

@app.route('/process_snapshot', methods=['POST'])
def process_snapshot(): 
    data = request.get_json()
    image_base64 = data.get("image")
    cloth_type = data.get("cloth_type", "upper")
    selected_cloth = data.get("selected_cloth")

    # Use the provided cloth image or fall back to a default image.
    if not selected_cloth:
        cloth_image = image_to_base64('paldo1.jpg')
    else:
        cloth_image = selected_cloth

    payload = {
        "person_image": image_base64,
        "cloth_image": cloth_image,
        "cloth_type": cloth_type,
    }

    response = requests.post("https://99ab-34-125-202-23.ngrok-free.app//tryon", json=payload)
    result_image = response.json().get('result_image')
    return jsonify({"image": result_image})


@app.route('/measurements')
def measurements():
    duration = int(request.args.get('duration', 3))
    time.sleep(duration)
    
    # Convert raw measurements to centimeters using conversion_factors
    converted_measurements = {}
    for key, value in last_measurements.items():
        conversion = conversion_factors.get(key, 1)
        if value is not None:
            centimeters = value / conversion
            converted_measurements[key] = round(centimeters, 2)
        else:
            converted_measurements[key] = None

    return jsonify(converted_measurements)


@app.route('/update_conversion', methods=['POST'])
def update_conversion():
    global conversion_factors
    data = request.get_json()
    key = data.get('key')
    value = data.get('value')
    if key in conversion_factors and isinstance(value, (int, float)):
        conversion_factors[key] = float(value) * 2.54  # Convert input to cm
        return jsonify({'status': 'success', 'conversion_factors': conversion_factors})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid key or value'}), 400

# New calibration endpoint using fixed sizes on the backend
@app.route('/calibrate', methods=['POST'])
def calibrate():
    """
    This endpoint uses fixed calibration sizes stored on the backend.
    Fixed sizes (in cm) for the calibration subject:
      - Chest Circumference: 91.44 cm (36 inches)
      - Shoulder Width: 40.64 cm (16 inches)
      - Hip Length: 96.52 cm (38 inches)
      - Thigh Circumference: 55.88 cm (22 inches)
    It compares the current measurements against these values and updates the conversion factors if
    the difference is greater than a 2.54 cm (1 inch) tolerance.
    """
    global conversion_factors, last_measurements
    fixed_sizes = {
        'Chest Circumference': 96.52,  # 38 inches in cm
        'Shoulder Width': 40.64,       # 16 inches in cm
        'Hip Length': 38.1,            # 15 inches in cm
        'Thigh Circumference': 50.8,   # 20 inches in cm
    }
    tolerance = 2.54  # 1 inch in cm
    updated_factors = {}

    if not last_measurements:
        return jsonify({'status': 'error', 'message': 'No measurements available for calibration.'}), 400

    for key, fixed_size in fixed_sizes.items():
        if key in last_measurements:
            measured_pixels = last_measurements[key]
            current_factor = conversion_factors.get(key, 1)
            measured_cm = measured_pixels / current_factor
            diff = abs(measured_cm - fixed_size)
            if diff > tolerance:
                new_factor = measured_pixels / fixed_size
                conversion_factors[key] = new_factor
                updated_factors[key] = new_factor

    return jsonify({'status': 'calibrated', 'updated_factors': updated_factors})

if __name__ == '__main__':
    app.run(debug=True)