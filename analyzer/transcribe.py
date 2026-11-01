import json
import os
import sys

def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: transcribe.py INPUT OUTPUT_JSON')
    # PyAV 19 removed a keyword still passed by some faster-whisper releases.
    import av
    av_open = av.open
    av.open = lambda file, mode='r', **kwargs: av_open(file, mode=mode)
    from faster_whisper import WhisperModel
    model = WhisperModel(os.environ.get('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8')
    segments, info = model.transcribe(sys.argv[1], word_timestamps=True, vad_filter=True, beam_size=3)
    words = []
    utterances = []
    for segment in segments:
        segment_words = []
        for item in segment.words or []:
            token = item.word.strip()
            if token:
                word = {'word': token, 'start': round(item.start, 3), 'end': round(item.end, 3), 'probability': round(item.probability, 3)}
                words.append(word)
                segment_words.append(word)
        text = (segment.text or '').strip()
        if text and segment_words:
            utterances.append({'text': text, 'start': segment_words[0]['start'], 'end': segment_words[-1]['end'], 'words': segment_words})
    with open(sys.argv[2], 'w', encoding='utf-8') as out:
        json.dump({'language': info.language, 'words': words, 'utterances': utterances, 'model': os.environ.get('WHISPER_MODEL', 'base'), 'local': True}, out, ensure_ascii=False)

if __name__ == '__main__':
    main()
