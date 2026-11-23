param([ValidateSet('video','image')][string]$Kind='video')
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'APCE — Selecionar mídia para exibição'
$dialog.Filter = if ($Kind -eq 'image') { 'Imagens|*.png;*.jpg;*.jpeg;*.bmp;*.webp' } else { 'Vídeos e áudios|*.mp4;*.mkv;*.mov;*.webm;*.mp3;*.wav;*.m4a' }
if ($dialog.ShowDialog() -eq 'OK') { [Console]::Write($dialog.FileName) }
$dialog.Dispose()
