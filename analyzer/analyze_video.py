"""Bounded local scene, motion, quality, face, and subject sampling."""
import json
import os
import sys

import cv2
import numpy as np
from scenedetect import SceneManager, open_video
from scenedetect.detectors import ContentDetector


def main():
    if len(sys.argv) != 4:
        raise SystemExit('Usage: analyze_video.py INPUT THUMB_DIR OUTPUT_JSON')
    source, thumb_dir, output = sys.argv[1:]
    os.makedirs(thumb_dir, exist_ok=True)

    manager = SceneManager()
    manager.add_detector(ContentDetector(threshold=27.0, min_scene_len=12))
    manager.detect_scenes(open_video(source), show_progress=False)
    detected_scenes = manager.get_scene_list()

    capture = cv2.VideoCapture(source)
    fps = capture.get(cv2.CAP_PROP_FPS) or 25
    total_frames = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    duration = total_frames / fps if total_frames else 0
    if not detected_scenes and duration > 0:
        detected_scenes = [(type('T', (), {'get_seconds': lambda self: 0})(),
                            type('T', (), {'get_seconds': lambda self: duration})())]
    scene_ranges = [(float(a.get_seconds()), min(float(b.get_seconds()), duration))
                    for a, b in detected_scenes[:120]]

    requested_interval = max(0.2, float(os.environ.get('MEDAD_FRAME_SAMPLE_SECONDS', '1')))
    interval = max(requested_interval, duration / 720) if duration else requested_interval
    cascade_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
    face_detector = cv2.CascadeClassifier(cascade_path) if os.path.exists(cascade_path) else None
    samples = []
    previous_gray = None
    tracked_x = None
    timestamp = 0.0
    while duration and timestamp < duration and len(samples) < 720:
        capture.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
        ok, frame = capture.read()
        if not ok:
            timestamp += interval
            continue
        height, width = frame.shape[:2]
        scale = min(320 / max(width, height), 1)
        small = cv2.resize(frame, (max(1, int(width * scale)), max(1, int(height * scale))))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        motion = 0.0 if previous_gray is None or previous_gray.shape != gray.shape else float(np.mean(cv2.absdiff(gray, previous_gray)) / 255)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        faces = []
        if face_detector is not None and not face_detector.empty():
            faces = face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4,
                                                   minSize=(max(20, gray.shape[1] // 14), max(20, gray.shape[1] // 14)))
        face_x = None
        face_area = 0
        if len(faces):
            chosen = max(faces, key=lambda rect: rect[2] * rect[3]) if tracked_x is None else min(
                faces, key=lambda rect: abs((rect[0] + rect[2] / 2) / gray.shape[1] - tracked_x))
            measured = float((chosen[0] + chosen[2] / 2) / gray.shape[1])
            tracked_x = measured if tracked_x is None else tracked_x * 0.65 + measured * 0.35
            face_x = round(tracked_x, 4)
            face_area = round(float(chosen[2] * chosen[3] / (gray.shape[0] * gray.shape[1])), 4)
        else:
            tracked_x = None
        samples.append({'time': round(timestamp, 3), 'motion': round(motion, 4),
                        'sharpness': round(sharpness, 2), 'brightness': round(brightness, 2),
                        'black': brightness < 12, 'faceX': face_x, 'faceArea': face_area})
        previous_gray = gray
        timestamp += interval
    capture.release()

    rows = []
    for idx, (start, end) in enumerate(scene_ranges):
        at = min(max(0, (start + end) / 2), max(0, duration - .04))
        capture = cv2.VideoCapture(source)
        capture.set(cv2.CAP_PROP_POS_MSEC, at * 1000)
        ok, frame = capture.read()
        capture.release()
        thumb = None
        if ok:
            h, w = frame.shape[:2]
            scale = min(320 / max(w, h), 1)
            frame = cv2.resize(frame, (max(1, int(w * scale)), max(1, int(h * scale))))
            thumb = f'scene-{idx:02d}.jpg'
            cv2.imwrite(os.path.join(thumb_dir, thumb), frame, [cv2.IMWRITE_JPEG_QUALITY, 78])
        local = [item for item in samples if start <= item['time'] < end]
        visible_faces = [item for item in local if item['faceX'] is not None]
        rows.append({'start': round(start, 3), 'end': round(end, 3), 'thumbnail': thumb,
                     'motion': round(float(np.mean([x['motion'] for x in local])), 4) if local else 0,
                     'visualQuality': round(float(np.mean([min(1, x['sharpness'] / 300) for x in local])), 3) if local else 0,
                     'blackFrameRatio': round(sum(x['black'] for x in local) / len(local), 3) if local else 0,
                     'faceVisibility': round(len(visible_faces) / len(local), 3) if local else 0,
                     'subjectX': round(float(np.median([x['faceX'] for x in visible_faces])), 4) if visible_faces else None})

    with open(output, 'w', encoding='utf-8') as out:
        json.dump({'duration': round(duration, 3), 'fps': round(fps, 3), 'sampleInterval': round(interval, 3),
                   'scenes': rows, 'samples': samples, 'local': True}, out, ensure_ascii=False)


if __name__ == '__main__':
    main()
