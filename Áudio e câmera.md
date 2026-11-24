# Câmera, microfones e som das mídias

Na mesa de **Programa**, use **Entrar com câmera e microfone**. A seleção dos dispositivos aparece dentro do painel. Permita o acesso solicitado pelo navegador, escolha câmera e microfone e entre com a câmera. A direção da sala é aberta junto com essa entrada.

Se a entrada precisar de aprovação, clique em **Conferir aprovação na direção** e aprove o pedido na seção Convidados. A indicação de apresentador conectado aparece quando a direção confirma sua presença no estúdio. Use a prévia do programa e os medidores para conferir o sinal; entrar na sala não substitui essa conferência.

**Voltar ao painel** mantém câmera e microfone conectados. **Desligar minha câmera e sair da sala** encerra essa entrada. Se não houver dispositivos na seleção, confira a conexão física e as permissões do navegador/Windows. O seletor precisa receber um dispositivo disponível antes de conseguir capturar a imagem ou a voz. Consulte [as orientações do VDO.Ninja sobre permissões](https://docs.vdo.ninja/common-errors-and-known-issues/enable-camera-microphone-permissions).

## Áudio e volume

O botão **Áudio e volume** abre os controles de:

- Abertura.
- Vídeos e áudios.
- Conversa no programa.
- Tela compartilhada.

Cada fonte tem medidor, volume e botão **Silenciar / Ativar som**. Os controles refletem o OBS. As escolhas de volume, mute e escuta ficam salvas para a próxima abertura. Reparar as cenas mantém essas escolhas explícitas.

A abertura, os vídeos e o compartilhamento são preparados para sair na transmissão e no retorno dos convidados, com escuta local habilitada. **Ouvir no computador** altera a reprodução no computador e mantém a trilha enviada ao público. A conversa sai na transmissão; sua escuta extra no OBS começa desligada porque o apresentador já ouve os convidados pela própria sala. Ligar essa escuta extra pode repetir sua própria voz. Use fones.

O mute do apresentador ou de um convidado na mesa corta aquela voz no programa. O controle de microfone na entrada VDO.Ninja desliga a captura para a conversa da sala. O botão **Conversa no programa** silencia a mixagem das vozes no programa, preservando abertura e mídias.

Na biblioteca, a prévia do vídeo começa com áudio habilitado. Ao usar **Exibir no programa**, a prévia é pausada e o áudio vem do OBS, para evitar duas reproduções ao mesmo tempo. O botão de mute do vídeo mostra o estado real do OBS. Um arquivo identificado como **Vídeo sem áudio** não contém uma trilha sonora para reproduzir.

Para os convidados acompanharem imagem e som das mídias, ligue **Convidados → Retorno do estúdio → Ligar retorno**. A trilha 2 leva abertura, mídia e compartilhamento; as vozes chegam pela sala, sem devolver as próprias vozes com atraso. Ao compartilhar uma tela ou aba, inclua o áudio nas opções de compartilhamento quando desejar transmiti-lo.

## Antes de entrar no ar

Confira sua imagem na prévia, fale e veja o nível da conversa. Selecione Abertura ou um vídeo com áudio e confira o respectivo medidor. Verifique os botões de mute. A confirmação de início da live informa quando a direção ainda não confirmou o apresentador; é possível iniciar somente com abertura ou mídias, quando essa for a intenção.

## Verificação da correção

Foram verificadas duas câmeras simuladas chegando às fontes nativas do OBS e sete gravações locais: vozes em Solo, Entrevista e Sala; silêncio após mute da conversa; mídia com áudio; mídia silenciada; abertura com áudio. A análise do áudio decodificado confirmou som nos casos ativos e silêncio nos casos de mute. Relatório e gravações: `evidencias/audio-video/resultado.json` e a mesma pasta. Nenhum envio ao YouTube é iniciado por esse ensaio.

Os controles também foram verificados com respostas simuladas no computador e no celular. Esses ensaios confirmam o caminho de vídeo/áudio da aplicação; o uso da câmera e do microfone físicos exige que o navegador os reconheça e receba permissão de acesso.

```powershell
npm run test:unit
npm run test:audio-ui
# Somente com o estúdio vazio e autorização para testar a sala privada:
node scripts/verificar-audio-video.mjs --autorizado
```

O ensaio nativo usa fontes sintéticas, exige transmissão/gravação desligadas e restaura cena, diretório de gravação, mídia, volumes e mutes anteriores.
