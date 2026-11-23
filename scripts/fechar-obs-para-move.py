"""Fecha normalmente apenas o OBS portátil APCE para carregar o novo plugin."""
import ctypes
import json
import sys
import time
import requests
from obs_ui import Desktop

state = requests.get('http://127.0.0.1:3210/api/state', timeout=5).json()
if not state.get('connected') or state.get('streaming') or state.get('recording'):
    raise SystemExit('OBS desconectado ou saída ativa; reinício cancelado.')
windows = [w for w in Desktop(backend='uia').windows() if w.window_text().startswith('OBS 33.') and 'Perfil: APCE - Cenas: APCE' in w.window_text()]
if len(windows) != 1:
    raise SystemExit('Não foi possível identificar uma única janela do estúdio APCE.')
window = windows[0]
pid = window.element_info.process_id
handle = ctypes.windll.kernel32.OpenProcess(0x00100000, False, pid)
try:
    ctypes.windll.user32.PostMessageW(window.handle, 0x0010, 0, 0)
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        if ctypes.windll.kernel32.WaitForSingleObject(handle, 0) == 0:
            print('OBS APCE encerrado normalmente.')
            break
        for popup in Desktop(backend='uia').windows():
            if popup.element_info.process_id != pid:
                continue
            for button in popup.descendants(control_type='Button'):
                if button.window_text() in ('Sim', '&Sim', 'Yes', '&Yes', 'Sair', 'Exit'):
                    button.invoke()
        time.sleep(.25)
    else:
        raise SystemExit('O OBS ainda está encerrando; a instalação foi adiada sem forçar o processo.')
finally:
    if handle:
        ctypes.windll.kernel32.CloseHandle(handle)
