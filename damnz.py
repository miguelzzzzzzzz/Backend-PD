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

# Global conversion factors (modifiable via the GUI)
conversion_factors = {
    'Chest Circumference': 7.6,
    'Shoulder Width': 6.9,
    'Hip Length': 4.6,
    'Thigh Circumference': 8.6,
}

def calculate_distance(point1, point2, image_width, image_height):
    x1, y1 = int(point1.x * image_width), int(point1.y * image_height)
    x2, y2 = int(point2.x * image_width), int(point2.y * image_height)
    return math.hypot(x2 - x1, y2 - y1)

def update_measurements(landmarks, image_width, image_height):
    global last_measurements
    chest_factor = 2.5
    hip_factor   = 2.7
    thigh_factor = 2.5

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
            inches = value / conversion
            display_value = f"{inches:.2f} inch"
        else:
            display_value = "N/A"
        cv2.putText(image, f"{key}: {display_value}", (10, y0 + i * dy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    return image

def overlay_measurements(image, measurements):
    global conversion_factors
    y0 = 30
    dy = 30
    for i, (key, value) in enumerate(measurements.items()):
        if value is not None:
            conversion = conversion_factors.get(key, 1)
            inches = value / conversion
            display_value = f"{inches:.2f} inch"
        else:
            display_value = "N/A"
        cv2.putText(image, f"{key}: {display_value}", (10, y0 + i * dy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    return image

def gen_frames():
    global last_frame, snapshot_request
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1080)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    with mp_pose.Pose(min_detection_confidence=0.5, 
                      min_tracking_confidence=0.5) as pose:
        while True:
            success, frame = cap.read()
            if not success:
                break

            frame = cv2.flip(frame, 1)
            frame = cv2.resize(frame, (1080, 720))
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
                countdown_text = f"Snapshot in: {remaining}s"
                cv2.putText(frame_to_stream, countdown_text, (400, 360),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

            ret, buffer = cv2.imencode('.jpg', frame_to_stream)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    cap.release()
@app.route('/')
def index():
    # Pass the current conversion factors to the template
    return render_template('index.html', conversion_factors=conversion_factors)

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/snapshot')
def snapshot():
    global snapshot_request, last_frame
    duration = int(request.args.get('duration', 3))
    snapshot_request["active"] = True
    snapshot_request["duration"] = duration
    snapshot_request["start_time"] = time.time()
    time.sleep(duration)
    snapshot_request["active"] = False
    ret, buffer = cv2.imencode('.jpg', last_frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')


@app.route('/measurements')
def measurements():
    duration = int(request.args.get('duration', 3))
    time.sleep(duration)
    return jsonify(last_measurements)

@app.route('/update_conversion', methods=['POST'])
def update_conversion():
    global conversion_factors
    data = request.get_json()
    key = data.get('key')
    value = data.get('value')
    if key in conversion_factors and isinstance(value, (int, float)):
        conversion_factors[key] = float(value)
        return jsonify({'status': 'success', 'conversion_factors': conversion_factors})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid key or value'}), 400

if __name__ == '__main__':
    app.run(debug=True)
