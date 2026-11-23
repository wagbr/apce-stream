"""Inspeção e controle da instância OBS APCE, sem ler credenciais da interface."""
import ctypes
import os
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parents[1]
VENDOR = BASE / 'vendor'
sys.path[:0] = [str(VENDOR), str(VENDOR/'win32'), str(VENDOR/'win32/lib'), str(VENDOR/'Pythonwin'), str(VENDOR/'pywin32_system32')]
_dll = os.add_dll_directory(str(VENDOR/'pywin32_system32')) if (VENDOR/'pywin32_system32').is_dir() else None
from pywinauto import Desktop, Application

def windows():
    return [w for w in Desktop(backend='uia').windows() if 'OBS' in w.window_text() or 'VDO.Ninja' in w.window_text()]

if __name__ == '__main__':
    for w in windows():
        print(w.element_info.process_id, ascii(w.window_text()))
        if '--tree' in sys.argv:
            for c in w.descendants():
                if c.element_info.control_type in ['Button','MenuItem','TabItem','ListItem','TreeItem']:
                    print(c.element_info.control_type, ascii(c.window_text()), c.rectangle())
