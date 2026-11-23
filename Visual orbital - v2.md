# Estúdio orbital — atualização visual

## Abrir o painel

Dê dois cliques em **Abrir Painel APCE.cmd**, na raiz de `Canal APCE`. Há outra cópia na pasta `Estudio APCE`.

O atalho inicia o serviço local quando necessário, abre o OBS portátil no perfil **APCE Painel** e abre <http://127.0.0.1:3210>. Abrir novamente reutiliza o serviço e a instância do OBS. **Abrir Estudio APCE.cmd** também inicia o ambiente completo.

## Novo visual

- Duas artes originais geradas com a ferramenta integrada **ImageGen**: observatório orbital para Preparação/Encerramento e cenário discreto para Solo, Entrevista, Sala aberta e Mídia.
- Logos oficiais aplicados em HTML, sem redesenho ou alteração de proporções. Paleta APCE: rosa `#EF4D63`, grafite `#3B3C46` e bege `#E6D3CB`.
- Tarjas bege com detalhe rosa; nomes e assunto continuam editáveis no painel.
- Sete miniaturas produzidas a partir dos layouts reais, ícones SVG, barra de gravação fixa, contraste reforçado e adaptação para telas pequenas.
- Atalhos **1 a 7** na ordem das miniaturas. Ficam suspensos em campos de texto e janelas de ajuda.

A abertura continua usando o vídeo **Abertura Ateu Cast (leve).mp4**. Câmeras, trilhas de áudio, links da sala e autenticação do YouTube foram preservados.

## Artes e prompts

Os mestres estão em:

- `public/assets/orbital-v2/orbital-hero-v2.png`
- `public/assets/orbital-v2/orbital-stage-v2.png`

As versões `.webp` são conversões técnicas para carregamento mais leve. As imagens não foram redesenhadas com scripts. Os prompts integrais usados na ferramenta integrada estão em [prompts.json](public/assets/orbital-v2/prompts.json).

O primeiro prompt pede uma instalação de anéis orbitais em uma galeria modernista escura, com esfera grafite, faixa rosa e base em pedra bege, reservando a metade esquerda para o logo e a tipografia. O segundo pede um cenário de grafite com arcos e luz rosa nas bordas, mantendo o centro discreto para as câmeras. Ambos proíbem textos, marcas, pessoas e interfaces dentro da imagem gerada.

## Arquivos e preservação

O painel usa `public/index-v2.html`, `style-v2.css` e `app-v2.js`. As fontes do OBS usam `overlay-v2.html`, `overlay-v2.css` e `overlay-v2.js`.

Os arquivos originais continuam em `public/`. Uma cópia da interface anterior e dos endereços das fontes visuais foi guardada em `backups/interface-v1/`.

## Verificação

O relatório está em `evidencias/verificacao-visual-v2.json`. A checagem cobre o HUD, as dez fontes visuais, troca de cenas, atalhos, janelas de ajuda, ausência de rolagem horizontal de 320 a 1920 px, movimento reduzido, seis cenas em 1080p, transparência das tarjas e carregamento de todos os assets.

Prévias:

- `evidencias/painel-orbital-v2-desktop.png`
- `evidencias/painel-orbital-v2-celular.png`
- `evidencias/obs-orbital-v2.jpg`

Nenhuma transmissão ou gravação foi iniciada nessa revisão visual.
