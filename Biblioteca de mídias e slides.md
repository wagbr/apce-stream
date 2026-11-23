# Biblioteca de mídias e apresentador de slides

Abra **Abrir Painel APCE.cmd** e escolha **Biblioteca de mídias** na barra lateral. Endereço direto: <http://127.0.0.1:3210/#biblioteca>.

A biblioteca tem upload por seleção de arquivos ou arrastar e soltar, cartões com miniaturas, categorias, busca e uma mesa de apresentação. O upload e o botão **Preparar** mantêm o programa atual. **Exibir no programa** é o comando que coloca a mídia na cena **05 · Mídia** do OBS, com a identidade da APCE e a posição do apresentador já configuradas.

## Adicionar e exibir

1. Clique em **Adicionar arquivos** ou arraste os arquivos para a área de upload. É possível selecionar vários de uma vez.
2. Aguarde a preparação. PDFs geram uma imagem de exibição e uma miniatura para cada página. Imagens recebem uma cópia de exibição com orientação corrigida. Vídeos são conferidos e recebem uma miniatura.
3. Clique em **Preparar** no cartão. Confira o arquivo na mesa de apresentação.
4. Clique em **Exibir no programa**. Se outra mídia já estiver em exibição, o botão informa **Substituir no programa**.
5. Use **Retirar do programa** para voltar à cena que estava selecionada antes de entrar na exibição de mídia.

**No programa** identifica o conteúdo presente na saída do OBS. Para iniciar ou encerrar a transmissão pública, use os controles de transmissão na seção **Programa** do painel.

| Tipo | Formatos e limites do painel |
| --- | --- |
| PDF | Até 100 MB e 200 páginas; exporte uma cópia sem senha. |
| Imagem | JPG, JPEG, PNG ou WebP estático, até 25 MB. |
| Vídeo | MP4, M4V, MOV, WebM, MKV ou AVI, até 1 GB. |

Para apresentações do PowerPoint, LibreOffice ou Google Slides, exporte o material para **PDF** antes de importar. O painel apresenta as páginas exportadas; animações de slides, links interativos e vídeos incorporados ao PDF não são reproduzidos. Os vídeos devem ser enviados como arquivos próprios.

## Apresentar um PDF

Ao preparar um PDF, a mesa mostra a página selecionada, o próximo slide, a sequência de miniaturas e o contador. É possível voltar, avançar, clicar em uma miniatura ou informar o número da página.

O botão **Abrir modo apresentação** amplia essa interface. Somente as páginas da apresentação entram na imagem do OBS; os controles e as miniaturas ficam no painel do operador.

| Tecla | Ação |
| --- | --- |
| →, ↓, Page Down ou espaço | Próximo slide. |
| ←, ↑ ou Page Up | Slide anterior. |
| Home / End | Primeiro / último slide. |
| Esc | Fechar o modo apresentação. |

Os atalhos são suspensos ao escrever em campos ou abrir outro diálogo. Os atalhos numéricos de troca de cena ficam suspensos enquanto a biblioteca está aberta.

Com **Atualizar o programa ao navegar** marcado, a navegação muda a página no OBS quando essa mesma apresentação já está no programa. Desmarque para ensaiar outra página sem mudar a saída; **Exibir este slide** aplica a página escolhida. Preparar outro arquivo também preserva a mídia em exibição. Uma apresentação que saiu do programa não é recolocada automaticamente por uma seta pressionada depois.

## Criar uma apresentação com imagens

Clique em **Criar apresentação**, dê um nome, selecione imagens da biblioteca e organize a sequência pelos botões de subir, descer e remover slides. O editor também permite adicionar novas imagens. Clique em **Salvar apresentação** e use os mesmos controles de exibição dos PDFs.

O botão **Reorganizar slides** abre novamente a sequência. Retire a apresentação do programa antes de alterar sua ordem. As cópias das imagens usadas nos slides são preservadas mesmo quando um cartão é removido da biblioteca.

## Reproduzir vídeos

A prévia do navegador fica sem som para evitar áudio duplicado. Depois de colocar o vídeo no programa, os controles abaixo da prévia atuam no **OBS**: reproduzir/pausar, reiniciar, buscar posição, volume, silêncio e repetição.

A busca usa os pontos disponíveis no arquivo e pode se ajustar ao quadro-chave anterior; a posição é aproximada. A pausa e o estado de áudio são preservados. Isso acompanha o [comportamento do reprodutor nativo do OBS](https://github.com/obsproject/obs-studio/blob/33.0.1/shared/media-playback/media-playback/media.c).

O vídeo original é usado na exibição. O suporte à prévia depende dos codecs disponíveis no navegador; se ele não conseguir abrir um MOV, MKV ou AVI, o painel informa que a prévia está disponível no OBS. A fonte mantém as trilhas já configuradas: áudio público na trilha 1 e retorno de mídias na trilha 2.

## Arquivos e manutenção

Os uploads são cópias locais em `Estudio APCE/Biblioteca de mídias/Arquivos`. As páginas e miniaturas ficam em `Biblioteca de mídias/Prévias`. O catálogo fica em `private/media-library.json`. Os arquivos selecionados no computador e o acervo antigo não são movidos ou apagados.

**Remover da biblioteca** arquiva o cartão e preserva a cópia do arquivo. O aviso oferece **Desfazer**. Não é possível remover o cartão da mídia que está no programa. Uploads com os mesmos bytes reaproveitam o item existente, evitando cópias duplicadas no catálogo ativo.

A preparação usa Python com **PyMuPDF** e **Pillow**, já disponíveis neste computador. Os vídeos usam os helpers `probe.py` e `look.py` da skill **ffmpeg-skill** instalada em `%USERPROFILE%\.codex\skills\ffmpeg-skill`, com FFmpeg local. Consulte as referências de [renderização de páginas do PyMuPDF](https://pymupdf.readthedocs.io/en/latest/recipes-images.html) e de [fontes de mídia do OBS](https://obsproject.com/kb/media-sources).

## Verificação

Foram aprovados 10 testes do módulo e 16 verificações com navegador e OBS real. O ensaio cobriu PDF de três páginas, PDF protegido, imagens, montagem e ordem de slides, acompanhamento no programa, reprodução de vídeo com áudio, intervalos HTTP, remoção/desfazer, layouts de 320 a 1920 px e navegação entre estúdio, biblioteca e agendador.

A transmissão pública permaneceu desligada. As fontes e a cena anterior foram restauradas; os uploads sintéticos foram removidos do catálogo. Relatório: `evidencias/verificacao-biblioteca.json`. Capturas: `evidencias/biblioteca-midias-desktop.png`, `evidencias/apresentador-slides-desktop.png`, `evidencias/biblioteca-midias-celular.png` e `evidencias/biblioteca-pdf-no-obs.png`.

```powershell
cd 'Estudio APCE'
npm run test:media
```

O teste de integração `scripts/verificar-biblioteca.mjs` exige OBS conectado, transmissão e gravação desligadas e os arquivos de ensaio em `evidencias/midias-teste`. Ele restaura as fontes e o catálogo e informa ao final que o servidor do painel deve ser reiniciado para recarregar a configuração restaurada.
