"""Prepara cópias de exibição; o original recebido nunca é sobrescrito."""
import json
import pathlib
import subprocess
import sys
import shutil
from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
Image.MAX_IMAGE_PIXELS = 60_000_000

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

def thumbnail(image, output):
    thumb = ImageOps.contain(image.convert('RGB'), (320, 180))
    frame = Image.new('RGB', (320, 180), '#16161b')
    frame.paste(thumb, ((320-thumb.width)//2, (180-thumb.height)//2))
    frame.save(output, quality=86)

def run_tool(script, arguments):
    result = subprocess.run([sys.executable, str(script), *arguments], capture_output=True,
                            encoding='utf-8', errors='replace', timeout=90)
    if result.returncode:
        raise ValueError('Não foi possível ler o vídeo. Confira se o arquivo está íntegro e se o FFmpeg está disponível.')
    return json.loads(result.stdout)

def main():
    request = json.load(sys.stdin)
    source, output = pathlib.Path(request['source']), pathlib.Path(request['output'])
    output.mkdir(parents=True, exist_ok=True)
    kind = request['kind']
    if kind == 'pdf':
        import pymupdf
        with pymupdf.open(source) as document:
            if document.needs_pass:
                raise ValueError('O PDF tem senha. Exporte uma cópia sem senha para apresentar.')
            count = len(document)
            if not 1 <= count <= 200:
                raise ValueError('A apresentação deve ter de 1 a 200 páginas. Divida PDFs maiores.')
            for i, page in enumerate(document):
                if page.rect.width <= 0 or page.rect.height <= 0:
                    raise ValueError('O PDF contém uma página sem dimensões válidas.')
                scale = min(1920 / page.rect.width, 1080 / page.rect.height)
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
                destination = output / f'page-{i+1:04d}.png'
                pixmap.save(destination)
                with Image.open(destination) as image:
                    thumbnail(image, output / f'thumb-{i+1:04d}.jpg')
                emit({'progress': i+1, 'pageCount': count})
            emit({'done': True, 'pageCount': count})
    elif kind == 'image':
        with Image.open(source) as original:
            original.seek(0)
            image = ImageOps.exif_transpose(original).convert('RGBA')
            width, height = image.size
            if width < 1 or height < 1:
                raise ValueError('A imagem não tem dimensões válidas.')
            image.thumbnail((3840, 2160), Image.Resampling.LANCZOS)
            image.save(output / 'image.png')
            thumbnail(image, output / 'thumb.jpg')
            emit({'done': True, 'pageCount': 1, 'width': width, 'height': height})
    elif kind == 'video':
        tools = pathlib.Path(request['tools'])
        legacy_tools = (tools / 'probe.py').is_file()
        if legacy_tools:
            metadata = run_tool(tools / 'probe.py', [str(source), '--json'])
        else:
            ffprobe, ffmpeg = shutil.which('ffprobe'), shutil.which('ffmpeg')
            if not ffprobe or not ffmpeg:
                raise ValueError('Instale FFmpeg e FFprobe no PATH para preparar vídeos. Consulte README.md.')
            result = subprocess.run([ffprobe, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(source)], capture_output=True, encoding='utf-8', timeout=90)
            if result.returncode:
                raise ValueError('Não foi possível ler o vídeo. Confira se o arquivo está íntegro.')
            probed = json.loads(result.stdout)
            stream = next((s for s in probed.get('streams', []) if s.get('codec_type') == 'video'), {})
            metadata = {'video': {'width': stream.get('width'), 'height': stream.get('height'), 'codec': stream.get('codec_name')},
                        'duration': float(probed.get('format', {}).get('duration') or 0),
                        'audio': any(s.get('codec_type') == 'audio' for s in probed.get('streams', []))}
        video = metadata.get('video') or {}
        if not video.get('width') or not video.get('height'):
            raise ValueError('O arquivo não contém uma faixa de vídeo válida.')
        duration = metadata.get('duration') or 0
        arguments = [str(source), '--at', '0.2' if duration >= 0.5 else '0', '-o',
                     str(output / 'poster.png'), '--no-timecode', '--json', '--timeout', '60']
        poster = False
        try:
            if legacy_tools:
                run_tool(tools / 'look.py', [*arguments, '--dry-run'])
                run_tool(tools / 'look.py', arguments)
            else:
                subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', '0.2' if duration >= 0.5 else '0', '-i', str(source), '-frames:v', '1', str(output / 'poster.png')], check=True, capture_output=True, timeout=60)
            with Image.open(output / 'poster.png') as image:
                thumbnail(image, output / 'thumb.jpg')
            poster = True
        except (ValueError, OSError, subprocess.SubprocessError):
            pass  # Um vídeo íntegro continua disponível no OBS se a extração da capa falhar.
        emit({'done': True, 'pageCount': 1, 'width': video['width'], 'height': video['height'],
              'duration': duration, 'codec': video.get('codec'), 'hasAudio': bool(metadata.get('audio')),
              'poster': poster})
    else:
        raise ValueError('Tipo de mídia inválido.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        if isinstance(error, ValueError):
            message = str(error)
        else:
            message = 'Não foi possível preparar o arquivo. Confira se o PDF ou a imagem está íntegro e sem senha.'
        emit({'error': message})
        sys.exit(1)
