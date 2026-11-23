"""Valida a preparação em diretórios temporários, sem abrir ou alterar o OBS real."""
import configparser
import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest


class PrepararTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='apce-prepare-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = pathlib.Path(self.temp.name) / 'studio'
        self.base.mkdir()
        spec = importlib.util.spec_from_file_location('preparar_test_instance', pathlib.Path(__file__).with_name('preparar.py'))
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.module.BASE = self.base
        self.module.ROOT = self.base.parent
        self.module.OBS = self.base / 'obs'
        self.module.CONFIG = self.module.OBS / 'config' / 'obs-studio'
        self.module.PRIVATE = self.base / 'private'
        exe = self.module.OBS / 'bin' / '64bit' / 'obs64.exe'
        exe.parent.mkdir(parents=True)
        exe.write_bytes(b'fixture-not-executable')
        assets = self.base / 'public' / 'assets'
        assets.mkdir(parents=True)
        for name in ['apce.png', 'ateucast.png']:
            (assets / name).write_bytes(b'fixture-image')

    def prepare(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.module.prepare()

    def test_new_instance_uses_packaged_assets_and_panel_profile(self):
        self.prepare()
        cfg = json.loads((self.base / 'private/studio.json').read_text(encoding='utf-8'))
        self.assertEqual(cfg['intro'], str(self.base / 'media/abertura-leve.mp4'))
        self.assertGreaterEqual(len(cfg['obsPassword']), 24)
        profile = self.module.CONFIG / 'basic/profiles/APCE_Painel'
        ini = configparser.ConfigParser()
        ini.read(profile / 'basic.ini', encoding='utf-8')
        self.assertEqual(ini['General']['Name'], 'APCE Painel')
        self.assertEqual(ini['VDONinjaGuestReturn']['MaxViewers'], '16')
        self.assertEqual(ini['VDONinjaGuestReturn']['AudioTrack'], '2')
        service = json.loads((profile / 'service.json').read_text(encoding='utf-8'))
        self.assertEqual(service['type'], 'rtmp_custom')
        self.assertEqual(service['settings']['key'], '')
        self.assertIn('ProfileDir=APCE_Painel', (self.module.CONFIG / 'user.ini').read_text(encoding='utf-8'))

    def test_second_run_preserves_existing_settings_and_tokens(self):
        self.prepare()
        settings = self.base / 'private/studio.json'
        before = settings.read_bytes()
        profile = self.module.CONFIG / 'basic/profiles/APCE_Painel/basic.ini'
        original = profile.read_bytes()
        self.prepare()
        self.assertEqual(settings.read_bytes(), before)
        self.assertEqual(profile.read_bytes(), original)

    def test_original_obs_auth_is_not_copied_to_panel(self):
        profile = self.module.CONFIG / 'basic/profiles/APCE'
        profile.mkdir(parents=True)
        (profile / 'basic.ini').write_text('[General]\nName=APCE\n[Auth]\nType=YouTube\n[YouTube]\nToken=fixture-only\n', encoding='utf-8')
        self.prepare()
        original = (profile / 'basic.ini').read_text(encoding='utf-8')
        panel = (profile.parent / 'APCE_Painel/basic.ini').read_text(encoding='utf-8')
        self.assertIn('fixture-only', original)
        self.assertNotIn('fixture-only', panel)
        self.assertNotIn('[Auth]', panel)

    def test_missing_portable_obs_does_not_create_private_settings(self):
        (self.module.OBS / 'bin/64bit/obs64.exe').unlink()
        with self.assertRaises(SystemExit):
            self.prepare()
        self.assertFalse(self.module.PRIVATE.exists())


if __name__ == '__main__':
    unittest.main()
