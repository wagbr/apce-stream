"""Habilita somente a rota OAuth no host APCE, com backup e reversão se falhar."""
import datetime
import json
import pathlib
import subprocess
import time
import urllib.request

SITE = pathlib.Path('/etc/nginx/sites-enabled/apce-api').resolve()
BACKUPS = pathlib.Path('/opt/apce/apce-stream-auth/deployment-backups')
URL = 'https://api.apceapp.com.br/stream-auth/v1/config'
BLOCK = '''
    # APCE Stream: credencial Google mantida no servidor.
    location ^~ /stream-auth/ {
        client_max_body_size 16k;
        proxy_pass http://127.0.0.1:3291/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-APCE-Client-IP $remote_addr;
        proxy_connect_timeout 5s;
        proxy_read_timeout 50s;
        access_log off;
        add_header Cache-Control "no-store" always;
    }
'''


def check_https():
    last = None
    for attempt in range(12):
        try:
            with urllib.request.urlopen(URL, timeout=5) as response:
                data = json.load(response)
                if response.status != 200 or data.get('channel') != '@apcedf' or 'client_secret' in data:
                    raise RuntimeError('Resposta de autorização inesperada.')
                return
        except Exception as error:
            last = error
            time.sleep(0.5)
    raise last


def enable():
    original = SITE.read_text(encoding='utf-8')
    if '/stream-auth/' in original:
        check_https()
        print('A rota de autorização já está disponível por HTTPS.')
        return
    anchor = '    client_max_body_size 20m;\n'
    if original.count(anchor) != 1:
        raise SystemExit('Configuração inesperada; nenhum arquivo alterado.')
    BACKUPS.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / f'nginx-apce-api-{stamp}.conf'
    backup.write_text(original, encoding='utf-8')
    backup.chmod(0o600)
    candidate = BACKUPS / 'nginx-candidate.conf'
    candidate.write_text(original.replace(anchor, anchor + BLOCK), encoding='utf-8')
    try:
        subprocess.run(['sudo', '-n', '/bin/cp', str(candidate), str(SITE)], check=True)
        subprocess.run(['sudo', '-n', '/usr/sbin/nginx', '-t'], check=True)
        subprocess.run(['sudo', '-n', '/usr/bin/systemctl', 'reload', 'nginx'], check=True)
        check_https()
        print(json.dumps({'https': True, 'secret_exposed': False, 'backup': str(backup)}))
    except Exception:
        subprocess.run(['sudo', '-n', '/bin/cp', str(backup), str(SITE)], check=True)
        subprocess.run(['sudo', '-n', '/usr/sbin/nginx', '-t'], check=True)
        subprocess.run(['sudo', '-n', '/usr/bin/systemctl', 'reload', 'nginx'], check=True)
        raise
    finally:
        candidate.unlink(missing_ok=True)
    for suffix in ['/painel/', '/loja/']:
        with urllib.request.urlopen('https://api.apceapp.com.br' + suffix, timeout=10) as response:
            print('Aplicação existente:', suffix, response.status)


if __name__ == '__main__':
    enable()
