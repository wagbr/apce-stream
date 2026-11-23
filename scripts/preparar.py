"""Prepara uma instância portátil isolada do OBS. Execute com o OBS APCE fechado."""
import configparser
import json
import pathlib
import secrets
import shutil
import uuid

BASE = pathlib.Path(__file__).resolve().parents[1]
ROOT = BASE.parent
OBS = BASE / 'obs'
CONFIG = OBS / 'config' / 'obs-studio'
PRIVATE = BASE / 'private'

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def prepare():
    if not (OBS / 'bin' / '64bit' / 'obs64.exe').is_file():
        raise SystemExit('Extraia o OBS portátil em obs/ antes de preparar a instância. Consulte README.md.')
    PRIVATE.mkdir(exist_ok=True)
    settings_file = PRIVATE / 'studio.json'
    if settings_file.exists():
        cfg = json.loads(settings_file.read_text(encoding='utf-8'))
    else:
        cfg = {
            'room': 'APCE' + secrets.token_hex(8),
            'password': secrets.token_urlsafe(18),
            'host': 'host' + secrets.token_hex(6),
            'guest': 'guest' + secrets.token_hex(6),
            'return': 'programa' + secrets.token_hex(6),
            'obsPassword': secrets.token_urlsafe(24),
            'port': 3210, 'obsPort': 4457,
            'labels': {'host': '', 'guest': '', 'topic': ''},
            'afterIntro': '03 · Entrevista',
            'intro': str(BASE / 'media' / 'abertura-leve.mp4'),
            'obsExe': str(OBS / 'bin' / '64bit' / 'obs64.exe')
        }
        write_json(settings_file, cfg)
    for name in ['public/assets', 'gravacoes', 'evidencias']:
        (BASE / name).mkdir(parents=True, exist_ok=True)
    for source, target in [
        ('Logo APCE - oficial.png', 'apce.png'),
        ('Logo Ateu Cast - principal.png', 'ateucast.png')
    ]:
        origin = ROOT / 'Identidade Visual APCE' / 'Assets' / source
        destination = BASE / 'public' / 'assets' / target
        if origin.is_file():
            shutil.copy2(origin, destination)
        elif not destination.is_file():
            raise SystemExit(f'Asset obrigatório ausente: public/assets/{target}')
    (OBS / 'portable_mode.txt').touch()
    profile = CONFIG / 'basic' / 'profiles' / 'APCE'
    profile.mkdir(parents=True, exist_ok=True)
    # Nunca sobrescrever a autenticação que o usuário eventualmente já concluiu.
    if not (profile / 'basic.ini').exists():
        ini = configparser.ConfigParser(interpolation=None)
        ini.optionxform = str
        ini.read_dict({
            'General': {'Name': 'APCE'},
            'Video': {'BaseCX': '1920', 'BaseCY': '1080', 'OutputCX': '1920', 'OutputCY': '1080', 'FPSType': '0', 'FPSCommon': '30', 'ScaleType': 'bicubic', 'ColorFormat': 'NV12', 'ColorSpace': '709', 'ColorRange': 'Partial'},
            'Audio': {'SampleRate': '48000', 'ChannelSetup': 'Stereo'},
            'Output': {'Mode': 'Simple'},
            'SimpleOutput': {'VBitrate': '6000', 'ABitrate': '160', 'StreamEncoder': 'x264', 'Preset': 'veryfast', 'RecQuality': 'Stream', 'RecFormat2': 'mkv', 'FilePath': str(BASE / 'gravacoes')},
            'AdvOut': {'TrackIndex': '1'},
        })
        with (profile / 'basic.ini').open('w', encoding='utf-8') as f:
            ini.write(f, space_around_delimiters=False)
    if not (profile / 'service.json').exists():
        write_json(profile / 'service.json', {'type': 'rtmp_common', 'settings': {'service': 'YouTube - RTMPS', 'server': 'rtmps://a.rtmps.youtube.com:443/live2', 'key': '', 'bwtest': False}})
    ini = configparser.ConfigParser(interpolation=None)
    ini.optionxform = str
    ini.read(profile / 'basic.ini', encoding='utf-8-sig')
    if not ini.has_section('VDONinjaGuestReturn'):
        ini['VDONinjaGuestReturn'] = {
            'StreamID': cfg['return'], 'RoomID': cfg['room'], 'Password': cfg['password'],
            'AudioTrack': '2', 'VideoBitrate': '2500', 'MaxViewers': '16',
            'VideoEncoder': 'obs_x264', 'MaxHeight': '720', 'FrameRateDivisor': '1',
            'ForceTURN': 'false', 'SignalingServer': '', 'Salt': '', 'CustomICEServers': ''
        }
        with (profile / 'basic.ini').open('w', encoding='utf-8') as f:
            ini.write(f, space_around_delimiters=False)
    panel_profile = CONFIG / 'basic' / 'profiles' / 'APCE_Painel'
    panel_profile.mkdir(parents=True, exist_ok=True)
    if not (panel_profile / 'basic.ini').exists():
        panel_ini = configparser.ConfigParser(interpolation=None)
        panel_ini.optionxform = str
        panel_ini.read(profile / 'basic.ini', encoding='utf-8-sig')
        for section in list(panel_ini.sections()):
            if section == 'Auth' or section.startswith('YouTube'):
                panel_ini.remove_section(section)
        panel_ini['General']['Name'] = 'APCE Painel'
        panel_ini['VDONinjaGuestReturn']['MaxViewers'] = '16'
        with (panel_profile / 'basic.ini').open('w', encoding='utf-8') as f:
            panel_ini.write(f, space_around_delimiters=False)
    if not (panel_profile / 'service.json').exists():
        write_json(panel_profile / 'service.json', {'type': 'rtmp_custom', 'settings': {'server': 'rtmps://a.rtmps.youtube.com:443/live2', 'key': '', 'use_auth': False}})
    if not (CONFIG / 'user.ini').exists():
        (CONFIG / 'user.ini').write_text(
            '[General]\nFirstRun=false\nLanguage=pt-BR\n\n[Basic]\nProfile=APCE Painel\nProfileDir=APCE_Painel\nSceneCollection=APCE\nSceneCollectionFile=APCE\nConfigOnNewProfile=false\n\n[BasicWindow]\nPreviewEnabled=true\nWarnBeforeStartingStream=true\nWarnBeforeStoppingStream=true\nExtraBrowserDocks=' + json.dumps([{'title': 'Estúdio APCE', 'url': 'http://127.0.0.1:3210/'}]) + '\n', encoding='utf-8')
    write_json(CONFIG / 'plugin_config' / 'obs-websocket' / 'config.json', {'alerts_enabled': False, 'auth_required': True, 'first_load': False, 'server_enabled': True, 'server_port': cfg['obsPort'], 'server_password': cfg['obsPassword']})
    collection = CONFIG / 'basic' / 'scenes' / 'APCE.json'
    if not collection.exists():
        transitions = []
        move_file = BASE / 'move-transition.json'
        if move_file.is_file():
            move = json.loads(move_file.read_text(encoding='utf-8'))
            transitions.append({'name': move['name'], 'uuid': str(uuid.uuid4()), 'id': move['id'], 'versioned_id': move['id'], 'settings': move['settings']})
        write_json(collection, {'name': 'APCE', 'current_scene': '00 · Preparação', 'current_program_scene': '00 · Preparação', 'scene_order': [{'name': '00 · Preparação'}], 'sources': [{'name': '00 · Preparação', 'id': 'scene', 'versioned_id': 'scene', 'settings': {'items': []}}], 'groups': [], 'transitions': transitions, 'current_transition': transitions[0]['name'] if transitions else 'Fade', 'transition_duration': 650 if transitions else 300})
    print('Configuração portátil preparada. Credenciais preservadas em private/studio.json.')

if __name__ == '__main__':
    prepare()
