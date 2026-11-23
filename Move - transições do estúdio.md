# Move — transições do estúdio APCE

Instalado **Move 3.2.2**, do Exeldro, usando o pacote específico para Windows/OBS 33. O OBS portátil permanece na versão 33.0.1, com o perfil APCE e a conta do YouTube conectada.

## Como usar

A transição ativa é **APCE · Move**, com duração de **650 ms** e aceleração/desaceleração cúbicas. Use as miniaturas do painel, os atalhos **1 a 7** ou a lista de cenas do próprio OBS.

- **Solo → Entrevista:** a câmera do apresentador diminui e se desloca para a esquerda; o convidado entra pela direita.
- **Entrevista → Solo:** o apresentador volta ao destaque e o convidado sai para a direita.
- **Solo/Entrevista → Mídia:** o apresentador se desloca e diminui para a janela lateral.
- Molduras e nomes acompanham esses deslocamentos. O nome do apresentador se adapta à versão compacta da cena Mídia.
- A abertura continua usando o vídeo leve, com avanço automático para a cena escolhida no painel.
- A Sala aberta mantém a composição coletiva do VDO.Ninja.

Os fundos e as artes completas usam esmaecimento durante a troca. Câmeras, molduras e nomes são elementos separados, que o Move consegue reconhecer entre os layouts.

Para ajustar a velocidade, use a área **Transições de cena** do OBS com **APCE · Move** selecionada. A configuração padrão persistente está em `move-transition.json`; **Reparar cenas** reaplica esse padrão.

## Prévia e demonstração

O movimento é renderizado na saída do OBS e nas gravações/transmissões. A prévia JPEG do painel continua sendo atualizada a cada dois segundos; ela não exibe todos os quadros de uma transição de 650 ms.

Confira diretamente no OBS ou abra [a demonstração local](evidencias/Move%20APCE%20-%20demonstração.mp4). O vídeo usa apenas cartões sintéticos, sem câmera ou microfone de pessoas reais.

## Configuração técnica

As fontes do apresentador são compartilhadas entre Solo, Entrevista e Mídia. Foram adicionadas duas fontes de moldura e três de identificação. As artes HTML antigas continuam disponíveis; os layouts em uso recebem `native=1` para evitar a duplicação das molduras e dos nomes.

O filtro **APCE · Regras Move** controla a entrada/saída do convidado e associa a identificação compacta à identificação principal. A correspondência aproximada de nomes e a busca em cenas aninhadas ficaram desativadas para evitar associar o fundo ou a cena auxiliar de áudio ao participante errado.

As novas camadas visuais têm todas as trilhas de áudio desmarcadas. As trilhas das vozes e do retorno foram preservadas.

O painel mantém a preferência pelo Move ao reparar as cenas. A instalação antiga do OBS não foi alterada. O pacote foi copiado para `obs/plugins/move-transition/`; a coleção anterior está em `private/backups/move-3.2.2/`.

## Verificação realizada

- Plugin carregado pelo OBS como versão 3.2.2 e transição ativa em 650 ms.
- Câmera e moldura compartilhadas nos três layouts; identificação compacta associada ao nome principal.
- Eventos nativos e amostras do cursor confirmam estados intermediários da transição.
- A análise da gravação encontrou **23 posições/tamanhos distintos em 67 quadros amostrados**.
- Layouts reais, vinheta leve e avanço automático testados.
- Conta APCE e trilhas de áudio preservadas; nenhuma live pública iniciada.
- Gravação de teste encerrada e cenas/fontes temporárias removidas.

Relatórios: `evidencias/verificacao-move.json` e `evidencias/analise-move.json`.

Fonte: [release oficial Move 3.2.2](https://github.com/exeldro/obs-move-transition/releases/tag/3.2.2). SHA-256 do pacote `windows-OBS33.zip`, conferido antes da instalação: `a7b14030bf525024644e0510fb4254db40c46378358adaac3a68cd23d7e99f8e`.
