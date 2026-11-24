# Operar a live pelo painel

Abra **Abrir Painel APCE.cmd**, na raiz de `Canal APCE`. O atalho abre o OBS portátil no perfil **APCE Painel**, o serviço local e o painel. O perfil APCE anterior foi preservado. O novo perfil permite que a autorização do painel controle o YouTube sem exigir a seleção nativa de transmissão no OBS. Deixe o computador ligado, conectado à internet e sem suspensão durante o programa.

O painel controla a produção; o OBS monta e codifica o programa; o VDO.Ninja conecta os participantes; o YouTube distribui a transmissão ao público. Os convidados usam o navegador deles. Não é necessário abrir portas do roteador nem compartilhar o endereço `127.0.0.1`.

## Preparar o programa

1. Na navbar, abra **Agenda → Nova transmissão**, preencha título, descrição, data/hora, visibilidade, público infantil e thumb. Envie o agendamento ao YouTube.
2. Em **Programa**, clique na faixa **Transmissão do YouTube**, atualize a lista e selecione a live agendada. Confira o título, a visibilidade e o canal **@apcedf**. Feche o painel para voltar à mesa.
3. Abra **Sala e convidados → Abrir sala e direção**. Mantenha essa página do painel aberta durante o evento; você pode navegar entre as seções sem fechar a direção.
4. Use **Entrar com câmera e microfone**, na mesa de Programa, ou **Entrar como apresentador** na seção Convidados. A seleção abre dentro do painel. Autorize câmera e microfone, escolha os dispositivos e entre. Se necessário, use **Conferir aprovação na direção** para aprovar também o apresentador. Voltar ao painel mantém a captura conectada.
5. Abra **Retorno do estúdio → Ligar retorno do estúdio**. Esse comando liga somente o retorno privado do plugin VDO.Ninja no OBS. Se o retorno aparecer como pedido de entrada na direção, aprove-o. Ele não ocupa lugar na grade de pessoas.
6. Confira sua imagem na prévia. Em **Áudio e volume**, veja os medidores, teste a abertura e as mídias e ajuste mute, volume e escuta local. Use fones. Veja [Câmera, microfones e som das mídias](Áudio%20e%20câmera.md).

## Chamar pessoas pelo chat

Em **Sala e convidados**, use **Copiar link para o chat** e cole o convite no chat do YouTube. Cada pessoa pode abrir o mesmo convite em seu navegador, informar o nome e escolher câmera/microfone.

Na **Direção da sala**, aprove ou recuse os pedidos. Os aprovados aparecem nos bastidores do painel. Clique em **Adicionar ao estúdio** para colocar a pessoa na composição. Há **12 lugares ao todo, contando todos os apresentadores**. Para trocar uma pessoa com a grade cheia, retire alguém primeiro.

Na cena **Sala aberta**, a grade se adapta às pessoas adicionadas. **Usar na entrevista** escolhe a segunda câmera da cena Entrevista. **Silenciar no programa** corta o áudio daquela pessoa no programa, inclusive nas cenas Solo, Entrevista e Mídia. Os controles do apresentador e da entrevista acompanham esse estado. A conversa privada continua separada; a direção do VDO.Ninja permite também desativar microfones e remover conexões.

Os participantes acompanham o programa final no retorno: abertura, composição, troca de cenas e mídias. As vozes são recebidas diretamente pela sala; o áudio de retorno leva abertura e mídias, sem devolver as próprias vozes com atraso. O convidado vê o programa e a própria câmera; os controles de produção permanecem no painel do operador.

## Exibir comentários do público

A coluna **Comentários**, à esquerda, acompanha o chat da live selecionada em Programa. Clique numa mensagem para colocá-la na transmissão, clique em outra para substituir ou use **Retirar da tela**. O destaque acompanha a troca de cenas e aparece também no retorno dos convidados. Em janelas estreitas, abra a coluna pelo botão **Comentários**. Veja os detalhes em [Comentários na transmissão](Comentários%20na%20transmissão.md).

## Iniciar e encerrar

Em **Programa**, clique em **Iniciar transmissão**. A janela mostra a live selecionada e a visibilidade. Ao confirmar **Entrar ao vivo agora**, o painel configura a entrada do evento no OBS, inicia o sinal, aguarda o YouTube recebê-lo e publica a live. A data do agendamento não inicia o computador nem transmite sozinha.

Deixe a cena **Preparação** enquanto o sinal conecta. Quando aparecer **Ao vivo**, selecione **Abertura** para o público assistir à vinheta completa; ao terminar, ela avança para a cena escolhida no painel.

Durante a preparação, **Enviando sinal** significa que o OBS está enviando vídeo; **Ao vivo** confirma o estado retornado pelo YouTube. Se houver demora, consulte a mensagem do painel antes de repetir o comando. **Atualizar** confere a lista e o estado remoto.

Para terminar, selecione a cena Encerramento se desejar, aguarde a despedida e clique em **Encerrar transmissão → Encerrar live agora**. O painel encerra o evento no YouTube e para o sinal do OBS. A sala e o retorno privado continuam disponíveis para a conversa depois da live. Use **Desligar retorno** ao terminar essa conversa.

Se a API Google falhar durante o encerramento, o painel ainda tenta cortar o sinal que ele iniciou no OBS. A mensagem indica a falha; confirme o estado no YouTube Studio e repita o encerramento quando a conexão voltar. Uma live concluída não pode ser reaberta como o mesmo evento.

## Capacidade e acesso

O limite da grade é de 12 pessoas. O retorno permite conexões extras para monitores técnicos. A aprovação e o limite de admissão do VDO.Ninja dependem da direção conectada; mantenha o painel aberto e aprove apenas os participantes desejados. A entrada na sala, sozinha, não coloca ninguém na grade do programa.

O retorno usa 720p, 30 fps e até 2.500 kbps por conexão. Doze retornos podem consumir aproximadamente 30 Mbps de upload, além do envio ao YouTube, dos microfones e das câmeras. A capacidade prática depende da conexão, do processador e dos dispositivos. Faça um ensaio com os participantes e suas redes antes de anunciar uma produção com 12 câmeras.

O convite do chat contém o acesso à sala. Compartilhe somente o **convite de participação**, sem publicar o endereço da direção, a pasta `private`, as credenciais OAuth ou a chave do YouTube.

## Validação realizada

Foram aprovados os testes dos controles de início e encerramento com serviços simulados, da interface com 12 lugares e do envio nativo do OBS para um receptor RTMP local. Na sala real do VDO.Ninja, duas câmeras simuladas chegaram ao OBS, o silêncio individual funcionou e um convidado recebeu o retorno do programa.

O teste de carga no mesmo computador não completou 12 participantes: atingiu nove entradas com duas câmeras e as demais em áudio, mas houve falhas no retorno de algumas entradas e a captura simulada seguinte não iniciou. O teste com 12 câmeras também não foi aprovado. Portanto, os 12 lugares estão implementados, mas a operação simultânea com 12 pessoas ainda precisa de um ensaio com convidados em dispositivos e redes separados. Nenhuma transmissão pública foi iniciada nesses testes.

Referências: [YouTube — vincular a entrada de vídeo](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/bind), [YouTube — mudar o estado da live](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/transition), [VDO.Ninja — aprovação de entrada](https://docs.vdo.ninja/advanced-settings/director-parameters/and-requireapproval), [VDO.Ninja — retorno do OBS para convidados](https://docs.vdo.ninja/guides/live-studio-obs-return).
