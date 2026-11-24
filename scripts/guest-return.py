"""Controla somente a saída privada Guest Return da instância portátil APCE."""
import json
import sys
import time
from obs_ui import windows, Application, BASE

def run(command):
    if command not in ('start', 'stop', 'status'):
        raise ValueError('Comando de retorno inválido.')
    import ctypes
    from ctypes import wintypes
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    def executable(pid):
        handle=kernel.OpenProcess(0x1000,False,pid)
        if not handle: return ''
        try:
            value=ctypes.create_unicode_buffer(32768);size=wintypes.DWORD(len(value))
            return value.value.lower() if kernel.QueryFullProcessImageNameW(handle,0,value,ctypes.byref(size)) else ''
        finally: kernel.CloseHandle(handle)
    expected = str(BASE / 'obs/bin/64bit/obs64.exe').lower()
    candidates = [w for w in windows() if executable(w.element_info.process_id) == expected]
    if not candidates:
        raise ValueError('Abra o OBS APCE para ligar o retorno.')
    main = next((w for w in candidates if 'Perfil: APCE' in w.window_text() or 'Profile: APCE' in w.window_text()), None)
    dock = next((w for w in candidates if any('Guest Return' in c.window_text() for c in w.descendants(control_type='TabItem'))), None)
    if not dock:
        if not main:
            raise ValueError('Não foi possível localizar o perfil APCE no OBS.')
        app = Application(backend='uia').connect(process=main.element_info.process_id)
        spec = app.window(handle=main.handle)
        tools=next((c for c in main.descendants(control_type='MenuItem') if c.window_text().startswith(('Ferramentas','Tools'))),None)
        if not tools: raise ValueError('O menu Ferramentas não foi encontrado.')
        spec.menu_select(tools.window_text()+'->VDO.Ninja Studio')
        time.sleep(.6)
        dock = next((w for w in windows() if w.element_info.process_id == main.element_info.process_id and any('Guest Return' in c.window_text() for c in w.descendants(control_type='TabItem'))), None)
    if not dock:
        raise ValueError('Abra Ferramentas → VDO.Ninja Studio no OBS APCE.')
    tabs = [c for c in dock.descendants(control_type='TabItem') if 'Guest Return' in c.window_text()]
    if tabs: tabs[0].select()
    def controls():
        items = {key:c for c in dock.descendants() for key in ('GuestReturnStart','GuestReturnStop','GuestReturnStatus') if (c.element_info.automation_id or '').endswith('.'+key) or c.element_info.automation_id==key}
        if 'GuestReturnStart' not in items or 'GuestReturnStop' not in items:
            raise ValueError('O plugin de retorno não está disponível nesta janela.')
        return items
    items=controls()
    if command=='start' and items['GuestReturnStart'].is_enabled(): items['GuestReturnStart'].invoke()
    if command=='stop' and items['GuestReturnStop'].is_enabled(): items['GuestReturnStop'].invoke()
    if command!='status': time.sleep(1)
    items=controls()
    return {'running':items['GuestReturnStop'].is_enabled(),'status':items.get('GuestReturnStatus').window_text() if items.get('GuestReturnStatus') else ''}

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    try: print(json.dumps(run(sys.argv[1]),ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error':str(e)},ensure_ascii=False));sys.exit(1)
