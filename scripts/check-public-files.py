"""Confere o índice Git antes da publicação, sem imprimir valores sensíveis."""
import json
import pathlib
import re
import subprocess
import sys
from urllib.parse import quote

base = pathlib.Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(['git', *args], cwd=base)

paths = [p.decode('utf-8') for p in git('ls-files', '-z').split(b'\0') if p]
blocked = {'private', 'obs', 'vendor', 'node_modules', 'evidencias', 'backups', 'downloads', 'gravacoes', 'Biblioteca de mídias', '__pycache__'}
binary = {'.png', '.jpg', '.jpeg', '.webp', '.mp4'}
patterns = [
    rb'-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----',
    rb'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b',
    rb'\bgithub_pat_[A-Za-z0-9_]{40,}\b',
    rb'\bGOCSPX-[A-Za-z0-9_-]{20,}\b',
    rb'\bdop_v1_[a-fA-F0-9]{50,}\b',
]
local_secrets = []
cfg = base / 'private/studio.json'
if cfg.exists():
    data = json.loads(cfg.read_text(encoding='utf-8'))
    for key in ['password', 'obsPassword', 'roomApi', 'roomSourceKey', 'room', 'host', 'guest', 'return']:
        value = data.get(key)
        if isinstance(value, str) and len(value) >= 12:
            local_secrets.extend([value.encode(), quote(value, safe='').encode()])
errors = []
total = 0
for name in paths:
    path = pathlib.PurePosixPath(name)
    if blocked.intersection(path.parts) or path.suffix.lower() in {'.dpapi', '.pem', '.key', '.p8', '.p12', '.pfx', '.log'} or path.name.startswith('.env'):
        errors.append((name, 'arquivo privado ou gerado'))
        continue
    size = int(git('cat-file', '-s', ':' + name))
    total += size
    if size > 100 * 1024 * 1024:
        errors.append((name, 'arquivo acima do limite de tamanho'))
    if path.suffix.lower() in binary:
        continue
    contents = git('show', ':' + name)
    try:
        contents.decode('utf-8-sig')
    except UnicodeDecodeError:
        errors.append((name, 'texto sem UTF-8 válido'))
    if any(re.search(pattern, contents) for pattern in patterns):
        errors.append((name, 'padrão de credencial detectado'))
    if any(value in contents for value in local_secrets):
        errors.append((name, 'dado privado desta instância detectado'))
if errors:
    for name, reason in errors:
        print(f'{name}: {reason}')
    sys.exit(1)
print(json.dumps({'checkedFiles': len(paths), 'bytes': total, 'credentialPatternsFound': 0, 'privatePathsTracked': 0}))
