"""Instala o pacote OBS 33 e registra a transição com o OBS APCE fechado."""
import hashlib
import json
import pathlib
import shutil
import uuid

BASE = pathlib.Path(__file__).resolve().parents[1]
OBS = BASE / 'obs'
DOWNLOAD = BASE / 'downloads' / 'move'
BACKUP = BASE / 'private' / 'backups' / 'move-3.2.2'
release = json.loads((DOWNLOAD / 'release.json').read_text(encoding='utf-8'))
asset = next(a for a in release['assets'] if a['name'].endswith('windows-OBS33.zip'))
digest = hashlib.sha256((DOWNLOAD / asset['name']).read_bytes()).hexdigest()
assert 'sha256:' + digest == asset['digest'], 'SHA-256 inválido'
BACKUP.mkdir(parents=True, exist_ok=True)
collection = OBS / 'config' / 'obs-studio' / 'basic' / 'scenes' / 'APCE.json'
backup_file = BACKUP / 'APCE-antes.json'
if not backup_file.exists():
    shutil.copy2(collection, backup_file)
shutil.copytree(DOWNLOAD / 'pacote' / 'plugins' / 'move-transition', OBS / 'plugins' / 'move-transition', dirs_exist_ok=True)
doc = json.loads(collection.read_text(encoding='utf-8-sig'))
spec = json.loads((BASE / 'move-transition.json').read_text(encoding='utf-8'))
old_state = json.loads((BACKUP / 'estado-antes.json').read_text(encoding='utf-8'))
fade = next((t['transitionName'] for t in old_state['transitions']['transitions'] if t['transitionKind'] == 'fade_transition'), '')
settings = dict(spec['settings'])
if fade:
    settings.update(transition_in=fade, transition_out=fade, transition_match=fade)
transitions = doc.setdefault('transitions', [])
transition = next((t for t in transitions if t.get('name') == spec['name']), None)
if transition is None:
    transition = {'name': spec['name'], 'uuid': str(uuid.uuid4()), 'id': spec['id'], 'versioned_id': spec['id'], 'settings': settings}
    transitions.append(transition)
else:
    transition.update(id=spec['id'], versioned_id=spec['id'], settings=settings)
doc['current_transition'] = spec['name']
doc['transition_duration'] = spec['duration']
collection.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding='utf-8')
print('Move 3.2.2 instalado no OBS portátil; transição registrada em 650 ms.')
