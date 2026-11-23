# Estúdio APCE

Para acessar o painel, use **Abrir Painel APCE.cmd**, na raiz de `Canal APCE`. O atalho inicia o serviço local, o OBS portátil APCE e o painel no navegador. Consulte o [guia de operação pelo painel](Operar%20a%20live%20pelo%20painel.md) para iniciar e encerrar transmissões, chamar convidados pelo chat e operar a sala com até 12 pessoas. A [atualização visual orbital](Visual%20orbital%20-%20v2.md) descreve as artes, os atalhos e as prévias.

As trocas de layout usam **APCE · Move**, com câmeras, molduras e nomes em movimento suave de 650 ms. Consulte [o guia do Move e a demonstração](Move%20-%20transições%20do%20estúdio.md).

Abra **Abrir Estudio APCE.cmd** nesta pasta. Ele inicia o painel em <http://127.0.0.1:3210> e o OBS portátil com o perfil **APCE Painel** e a coleção **APCE**. O perfil APCE anterior e a instalação anterior do OBS foram preservados.

## Cenas

| Cena | Uso |
| --- | --- |
| 00 · Preparação | Marca do programa enquanto a produção se prepara. |
| 01 · Abertura | Arquivo original `Ateu Cast/Abertura/Abertura Ateu Cast (leve).mp4`, com áudio. Ao terminar, segue para a cena escolhida no painel. |
| 02 · Solo | Apresentador em destaque. |
| 03 · Entrevista | Apresentador e convidado lado a lado. |
| 04 · Sala aberta | Grade de até 12 pessoas adicionadas ao estúdio pelo painel. |
| 05 · Mídia | Vídeo, áudio, imagem ou compartilhamento, com apresentador ao lado. |
| 06 · Encerramento | Tela de agradecimento. |

Nomes e assunto começam vazios. Preencha os campos do painel e clique em **Atualizar na tela**. As fontes das marcas são as imagens atuais de `Identidade Visual APCE/Assets`; não foram usados os logos antigos.

## Câmeras, convidados e retorno

1. No painel, clique em **Entrar** ao lado de Apresentador. Selecione câmera e microfone, autorize o navegador e entre na sala. Use fones de ouvido.
2. Para uma entrevista, copie o link individual do **Convidado**. A câmera desse link corresponde à segunda posição da cena Entrevista. Cada link individual deve ser usado por uma pessoa de cada vez.
3. Para mais participantes, abra **Sala e convidados → Abrir sala e direção**. Copie o convite para o chat, aprove as entradas na direção e use **Adicionar ao estúdio**. O limite de 12 inclui os apresentadores.
4. No painel, use **Ligar retorno do estúdio**. O perfil contém sala, senha, ID de retorno, trilha **2**, 720p e 2500 kbps. O retorno pode funcionar com o YouTube desligado. O controle original fica em **Ferramentas → VDO.Ninja Studio → Guest Return** no OBS.
5. Os convidados veem a composição e ouvem as mídias pelo retorno. As vozes chegam diretamente pela sala. Não adicione o próprio retorno como fonte da transmissão.

O retorno permite 16 conexões para acomodar os 12 participantes e monitores técnicos. Cada conexão consome upload; a capacidade efetiva depende da conexão e do computador. Redes externas e dispositivos reais precisam de um ensaio antes da estreia.

Os botões Mic do apresentador e da entrevista controlam as fontes individuais e o lugar correspondente na Sala aberta. Cada cartão da sala também permite silenciar sua pessoa; quando ela é a câmera da entrevista, os controles acompanham esse estado. A direção permite controlar o microfone da pessoa na conversa privada. Silenciar no programa preserva a conversa privada no navegador.

## Exibição de mídia

Use **Biblioteca de mídias** na barra lateral para subir PDFs, imagens e vídeos. **Preparar** abre a prévia; **Exibir no programa** coloca o arquivo na cena Mídia. PDFs ganham navegação por página, miniaturas e um modo próprio de apresentação. Também é possível montar slides com uma sequência de imagens. Consulte o [guia da biblioteca e do apresentador de slides](Biblioteca%20de%20mídias%20e%20slides.md).

- **Vídeo ou áudio** abre o seletor do Windows; o arquivo permanece em sua pasta original.
- **Imagem** seleciona uma imagem local.
- **Compartilhar tela** abre uma página separada. Autorize a janela/tela que deseja mostrar e selecione **Usar tela** no painel. O compartilhamento não integra a conversa da sala, para evitar áudio duplicado no retorno.
- Escolha a cena **Mídia** para exibir o conteúdo. Use os controles de reprodução do painel para vídeos.
- Slides em PDF podem ser apresentados diretamente pela biblioteca. O compartilhamento de janela continua disponível para aplicativos e materiais externos.

## Conectar o YouTube

No painel, abra **YouTube → Agendar live** e conecte o canal **@apcedf**. Essa autorização já foi concluída pelo responsável. O perfil **APCE Painel** recebe a entrada de vídeo automaticamente quando você inicia a transmissão pelo painel.

O painel mostra o nome público da conta salvo no OBS. A conta APCE foi conectada pelo responsável e conferida neste perfil. Para operar pelo painel, conecte também o Agendador, selecione a live no controle de transmissão e use **Iniciar transmissão** e **Encerrar transmissão**. O painel vincula a entrada de vídeo do evento ao OBS e controla o estado do YouTube.

Para criar chamadas futuras, use **Agendar live** no calendário da barra lateral do painel. Preencha título, descrição, data/hora de Brasília e thumb e clique em **Agendar no YouTube**. O agendador tem conexão Google própria, com importação do JSON OAuth e login no navegador. Consulte o [guia de conexão e uso do agendador](Agendador%20de%20lives.md).

## Áudio e gravação

| Fonte | Trilha 1: público/gravação | Trilha 2: retorno |
| --- | --- | --- |
| Vozes individuais e sala | Sim | Não |
| Abertura, vídeo e compartilhamento | Sim | Sim |

O áudio de desktop e o microfone global não são usados: o apresentador entra com câmera e microfone pelo navegador. Isso evita capturar novamente o som da sala.

**Gravar localmente** grava em MKV em `gravacoes/`. A saída está em 1920 × 1080, 30 fps, H.264, 6000 kbps, áudio estéreo a 48 kHz. A abertura usa o vídeo original solicitado, sem transcodificação.

## Arquivos e manutenção

- `obs/`: OBS Studio 33.0.1 portátil e plugin VDO.Ninja 1.1.85.
- `public/`: painel e overlays HTML/CSS editáveis.
- `server.mjs` e `studio.mjs`: comunicação local com o OBS e construção dos links.
- `private/studio.json`: credenciais e configuração da sala. Não compartilhe essa pasta.
- `obs/config/`: perfil, coleção, configurações de retorno e autenticação do OBS. Não publique essa pasta.
- `evidencias/`: capturas e relatório da verificação.

O painel escuta apenas em `127.0.0.1`; senhas do OBS não são enviadas ao navegador. O convite de participação pode ser colocado no chat. Mantenha a direção aberta para aprovar entradas; não publique links da direção nem fontes internas. A comunicação remota usa a infraestrutura do VDO.Ninja.

Para reconstruir fontes da coleção APCE, use **Reparar cenas**, com live e gravação desligadas. Esse comando reposiciona as fontes gerenciadas e volta à preparação. Ele não altera outras coleções.

Skill instalada no projeto: `.agents/skills/cli-anything-obs-studio/SKILL.md`, do repositório HKUDS/CLI-Anything. Disponível para descoberta automática pelo Codex no próximo turno.

Fontes técnicas consultadas: [OBS Studio](https://github.com/obsproject/obs-studio/releases/tag/33.0.1), [protocolo obs-websocket](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md), [VDO.Ninja — retorno em sala](https://github.com/steveseguin/ninja-obs-plugin/blob/main/QUICKSTART.md#return-the-obs-program-to-a-group-room), [VDO.Ninja — salas](https://docs.vdo.ninja/guides/how-does-group-chat-work).

## Verificação realizada

O relatório em `evidencias/verificacao.json` registra nove verificações locais aprovadas: criação das sete cenas, trilhas de áudio, proteção dos comandos e credenciais, funcionamento do painel em dois tamanhos, renderização dos overlays e reprodução da abertura com passagem automática para a entrevista. Nenhuma transmissão pública foi iniciada.

O login da conta APCE foi concluído pelo responsável. A gravação local também foi validada: MKV com vídeo H.264 em 1920 × 1080 a 30 fps e áudio AAC a 48 kHz, conforme `evidencias/gravacao.json`.

O teste dos links privados do VDO.Ninja foi autorizado pelo responsável. Dois participantes entraram em sessões independentes com dispositivos simulados. A chegada das duas imagens ao OBS foi verificada pelos pixels dos sinais de teste e registrada em `evidencias/entrevista-simulada.jpg`. O retorno do programa foi recebido e decodificado no navegador em 1280 × 720. Os relatórios técnicos ficam em `evidencias/retorno.json` e `evidencias/convidados.json`.

Ao encerrar as verificações, os participantes simulados são desconectados e o programa volta para Preparação. Para uma produção real, abra a direção, ligue o retorno pelo painel e selecione a live no controle de transmissão.

Essas verificações não substituem um ensaio com câmera, microfone, fones e convidados em redes externas. Os testes automatizados usaram dispositivos simulados neste computador. Nenhuma live no YouTube foi iniciada.
