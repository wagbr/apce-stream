"""Exporta a demonstração e mede o deslocamento real nos quadros gravados."""
import json
import pathlib
import subprocess
from PIL import Image

BASE = pathlib.Path(__file__).resolve().parents[1]
report = json.loads((BASE / 'evidencias' / 'verificacao-move.json').read_text(encoding='utf-8'))
recording = pathlib.Path(report['recordingPath']).resolve()
assert recording.is_relative_to((BASE / 'gravacoes').resolve()), 'Gravação fora da pasta esperada'
video = BASE / 'evidencias' / 'Move APCE - demonstração.mp4'
frames = BASE / 'evidencias' / 'move-frames'
frames.mkdir(exist_ok=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(recording), '-c', 'copy', '-movflags', '+faststart', str(video)], check=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(recording), '-vf', 'fps=12,scale=320:180', '-threads', '1', str(frames / 'quadro-%04d.png')], check=True)
samples = []
for file in sorted(frames.glob('quadro-*.png')):
    image = Image.open(file).convert('RGB')
    points = [(i % image.width, i // image.width) for i, (r, g, b) in enumerate(image.getdata()) if r > 160 and r > 1.4 * g and r > 1.3 * b]
    if len(points) < 300:
        continue
    xs, ys = zip(*points)
    box = [min(xs), min(ys), max(xs), max(ys)]
    samples.append({'frame': file.name, 'box': box, 'width': box[2] - box[0] + 1, 'centerX': round((box[0] + box[2]) / 2, 1)})
unique = {tuple(sample['box']) for sample in samples}
assert len(unique) >= 10, f'Poucos estados intermediários: {len(unique)}'
result = {'passed': True, 'sampledFrames': len(samples), 'distinctPositionsAndSizes': len(unique), 'video': str(video.relative_to(BASE)), 'samples': samples}
(BASE / 'evidencias' / 'analise-move.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'samples'}, ensure_ascii=True))
