def gen_frames():
    global last_frame, snapshot_request
    cap = cv2.VideoCapture(0)
    
    # Set a high resolution (e.g., 1920x1080 for cropping flexibility)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
    
    # Target portrait dimensions (9:16 aspect ratio)
    PORTRAIT_WIDTH = 720
    PORTRAIT_HEIGHT = 1280
    
    with mp_pose.Pose(min_detection_confidence=0.5, 
                      min_tracking_confidence=0.5) as pose:
        while True:
            success, frame = cap.read()
            if not success:
                break

            frame = cv2.flip(frame, 1)  # Mirror effect (optional)
            
            # Get frame dimensions
            height, width = frame.shape[:2]
            
            # Calculate crop dimensions (center-crop to portrait aspect ratio)
            crop_width = int(height * (PORTRAIT_WIDTH / PORTRAIT_HEIGHT))
            start_x = (width - crop_width) // 2  # Center horizontally
            
            # Crop to portrait aspect ratio (no stretching)
            cropped_frame = frame[:, start_x:start_x + crop_width]
            
            # Resize cropped frame to target portrait dimensions
            frame = cv2.resize(cropped_frame, (PORTRAIT_WIDTH, PORTRAIT_HEIGHT))
            image_height, image_width, _ = frame.shape

            # Process pose estimation
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
                cv2.putText(frame_to_stream, countdown_text, 
                            (int(PORTRAIT_WIDTH * 0.2), int(PORTRAIT_HEIGHT * 0.5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

            ret, buffer = cv2.imencode('.jpg', frame_to_stream)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    cap.release()