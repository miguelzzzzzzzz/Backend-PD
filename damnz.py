import cv2
import mediapipe as mp
import math
import time
import tkinter as tk
from PIL import Image, ImageTk

# Initialize MediaPipe Pose and drawing utilities.
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# Global variable to store the last computed measurements and pose landmarks.
last_measurements = {
    'Chest Circumference': None,
    'Shoulder Length': None,
    'Hip Circumference': None,
    'Thigh Circumference': None,
}
last_pose_landmarks = None  # Stores the last detected pose landmarks

# Function to calculate Euclidean distance between two normalized landmarks in pixel space.
def calculate_distance(point1, point2, image_width, image_height):
    x1, y1 = int(point1.x * image_width), int(point1.y * image_height)
    x2, y2 = int(point2.x * image_width), int(point2.y * image_height)
    return math.hypot(x2 - x1, y2 - y1)

# Function to update measurements based on detected landmarks.
def update_measurements_extended(landmarks, image_width, image_height):
    global last_measurements
    # Calibration factors (adjust these as needed).
    chest_factor = 2.5
    hip_factor   = 2.7
    thigh_factor = 2.5

    # Chest Circumference: distance between left and right shoulders times factor.
    chest_width = calculate_distance(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        image_width, image_height)
    chest_circumference = chest_width * chest_factor

    # Shoulder Length: raw distance between left and right shoulders.
    shoulder_length = chest_width


    hip_length = calculate_distance(
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        image_width, image_height)
  

    # Thigh Circumference: distance from left hip to left knee times factor.
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

# Function to overlay measurements on an image (converted to inches with 2 decimal places).
def overlay_measurements(image, measurements):
    # Conversion factors (pixels per inch) for each measurement—adjust as needed.
    conversion_factors = {
        'Chest Circumference': 10.2,#32
        'Shoulder Width': 8.4,#16-17
        'Hip Length': 5.8,#13
        'Thigh Circumference': 9.3,#21
    }
    
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

# Function to display the snapshot in a Tkinter window with a "Take Snapshot Again" button.
def show_snapshot(snapshot):
    snapshot_rgb = cv2.cvtColor(snapshot, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(snapshot_rgb)
    root = tk.Tk()
    root.title("Snapshot")
    tk_image = ImageTk.PhotoImage(pil_image)
    label = tk.Label(root, image=tk_image)
    label.pack()
    def retake():
        root.destroy()
    button = tk.Button(root, text="Take Snapshot Again", command=retake, font=("Helvetica", 14))
    button.pack(pady=10)
    root.mainloop()

# Open the webcam feed, set resolution to 1080x720, and flip horizontally.
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1080)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("No frame available from camera.")
            break

        # Flip frame horizontally for a mirror view.
        frame = cv2.flip(frame, 1)
        frame = cv2.resize(frame, (1080, 720))
        display_frame = frame.copy()
        image_height, image_width, _ = display_frame.shape

        # Process frame with MediaPipe.
        image_rgb = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False
        results = pose.process(image_rgb)
        image_rgb.flags.writeable = True
        display_frame = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        # Update measurements if pose landmarks are detected.
        if results.pose_landmarks:
            update_measurements_extended(results.pose_landmarks.landmark, image_width, image_height)
            last_pose_landmarks = results.pose_landmarks
            mp_drawing.draw_landmarks(display_frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
        elif last_pose_landmarks is not None:
            mp_drawing.draw_landmarks(display_frame, last_pose_landmarks, mp_pose.POSE_CONNECTIONS)

        # Overlay the computed measurements.
        display_frame = overlay_measurements(display_frame, last_measurements)

        # Overlay instructions.
        instruction_text = "Press '3' for 3s, '5' for 5s, '0' for 10s snapshot, 'q' to quit"
        cv2.putText(display_frame, instruction_text, (10, image_height - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow('Dell Webcam WB7022 - MediaPipe Pose', display_frame)
        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            break

        # If a snapshot key is pressed, begin countdown with overlays.
        if key in [ord('3'), ord('5'), ord('0')]:
            countdown = 3 if key == ord('3') else 5 if key == ord('5') else 10
            start_time = time.time()
            while True:
                elapsed = time.time() - start_time
                remaining = countdown - int(elapsed)
                if remaining < 0:
                    remaining = 0
                ret, countdown_frame = cap.read()
                if not ret:
                    break
                countdown_frame = cv2.resize(countdown_frame, (1080, 720))
                countdown_frame = cv2.flip(countdown_frame, 1)
                # Process the frame to overlay pose and measurements during countdown.
                img_rgb = cv2.cvtColor(countdown_frame, cv2.COLOR_BGR2RGB)
                img_rgb.flags.writeable = False
                countdown_results = pose.process(img_rgb)
                img_rgb.flags.writeable = True
                countdown_frame = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
                if countdown_results.pose_landmarks:
                    update_measurements_extended(countdown_results.pose_landmarks.landmark, image_width, image_height)
                    last_pose_landmarks = countdown_results.pose_landmarks
                    mp_drawing.draw_landmarks(countdown_frame, countdown_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                elif last_pose_landmarks is not None:
                    mp_drawing.draw_landmarks(countdown_frame, last_pose_landmarks, mp_pose.POSE_CONNECTIONS)
                countdown_frame = overlay_measurements(countdown_frame, last_measurements)
                cv2.putText(countdown_frame, f"Snapshot in: {remaining}s", (780, 100),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                cv2.imshow('Dell Webcam WB7022 - MediaPipe Pose', countdown_frame)
                cv2.waitKey(30)
                if elapsed >= countdown:
                    break

            # Capture snapshot after countdown.
            ret, snapshot = cap.read()
            if ret:
                snapshot = cv2.resize(snapshot, (1080, 720))
                snapshot = cv2.flip(snapshot, 1)
                snapshot_rgb = cv2.cvtColor(snapshot, cv2.COLOR_BGR2RGB)
                snapshot_rgb.flags.writeable = False
                snapshot_results = pose.process(snapshot_rgb)
                snapshot_rgb.flags.writeable = True
                snapshot = cv2.cvtColor(snapshot_rgb, cv2.COLOR_RGB2BGR)
                if snapshot_results.pose_landmarks:
                    update_measurements_extended(snapshot_results.pose_landmarks.landmark, image_width, image_height)
                    mp_drawing.draw_landmarks(snapshot, snapshot_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                elif last_pose_landmarks is not None:
                    mp_drawing.draw_landmarks(snapshot, last_pose_landmarks, mp_pose.POSE_CONNECTIONS)
                snapshot = overlay_measurements(snapshot, last_measurements)
                show_snapshot(snapshot)

cap.release()
cv2.destroyAllWindows()
