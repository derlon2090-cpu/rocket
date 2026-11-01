# MEDAD — Intelligent local video editing report

## What is implemented

- Kept the existing React/Remotion editor, uploads, projects, multi-track timeline, effects, and local job queue.
- Added local `faster-whisper` word and utterance timestamps, local `PySceneDetect` boundaries, and OpenCV frame sampling for motion, sharpness, brightness, face visibility, scene thumbnails, and optional face-guided vertical crop.
- Added Ollama semantic clip suggestions and editing recommendations. Suggestions are range-checked against the media and Whisper words, snapped to complete utterance boundaries, scored with visible factors, and can be selected, approved, rejected, or reordered. Suggested effects are applied only after approval through the existing `EffectEngine`.
- Added mixed-language RTL-aware captions, active-word templates, word correction while preserving timestamps, and project persistence for the selected caption style.
- Added truthful local AI status: Ollama/model, faster-whisper availability, GPU/RAM, and current job state. Ollama vision is optional and requires configuring an image-capable local model.
- Reduced Remotion render memory pressure and isolated integration-test media/projects in a temporary data directory so tests do not touch the user's projects.

## Verification on this computer

- `npm run build`: passed after the final editor/effect changes. Vite prints only the existing lucide-react `use client` directive warnings.
- `npm test`: **8/8 passed**. Includes effect/timeline tests, utterance-boundary validation, and an integration test that uploads the Arabic sample, persists/duplicates/reloads a multi-track project, applies six effects and text, renders MP4, probes it, decodes it with FFmpeg, and extracts frames.
- Real Arabic transcription: `faster-whisper base` processed the 14.549-second `final.mp4`; detected Arabic and returned 24 words across 6 utterances. Some words were mistranscribed, so users should review and correct the transcript.
- Real scene analysis: PySceneDetect/OpenCV analyzed the same file and returned one scene and 15 frame samples. The footage contains no obvious scene cut or face, so cut detection and face-following crop quality were not demonstrated on this clip.
- Real local semantic inference: Ollama `qwen3:1.7b` analyzed the actual Arabic Whisper transcript through `/api/ai/clips`, returned a timestamped suggestion, and the server validated/snap-aligned it to the full utterance (0–10.84 s in the observed API run). A separate API call to `/api/ai/edits` returned a timestamped, whitelisted editing recommendation.
- Real export from the unnormalized sample: Remotion produced a 3.008-second MP4. FFprobe reported H.264, 1080×1920, 30 fps, AAC stereo at 48 kHz; FFmpeg decoded it and an extracted frame was visually inspected. The integration suite also verified a multi-clip export with subtitles/effects and extracted three frames.

## Known limits and unverified acceptance items

- This computer has 7.7 GB RAM and an RTX 2050 with 4 GB VRAM. Ollama has `qwen3:8b` installed, but inference with that configured default was **not verified** here. The successful semantic/API test used `qwen3:1.7b`; select it with `OLLAMA_MODEL=qwen3:1.7b` on this machine or use a larger-memory device for 8B.
- The optional Ollama vision inference path is implemented but was not verified. The currently available local models did not include a tested vision model. OpenCV metrics are not a substitute for vision-language understanding.
- The Arabic sample's speech recognition has errors; clip confidence measures the model's editorial judgement, not factual certainty or virality.
- The sample had one scene and no detectable face; the face-follow crop still needs a face-containing test video.
- The project references `Thmanyah Sans` first, but the font files are not bundled. Without the user's locally installed official font, the browser/renderer uses its fallback Arabic font.
- YouTube page downloading is not supported; direct public video-file URLs and uploads are supported.
- The integration suite exercises the editor's API and export pipeline, not a full browser click-through of every approval/reorder control.

## Run locally

Install Python dependencies with `python -m pip install -r analyzer/requirements.txt`. For semantic suggestions, run Ollama locally and set `OLLAMA_MODEL` to an installed model. `npm test` uses isolated temporary media storage; it does not overwrite user projects.
