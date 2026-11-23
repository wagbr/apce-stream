# Comentários na transmissão

Abra **Abrir Painel APCE.cmd**. Se o painel já estava aberto durante a atualização, recarregue a página com **F5**.

1. Em **Programa**, selecione a live do canal **@apcedf**.
2. A coluna **Comentários**, à esquerda, conecta ao chat dessa transmissão usando a autorização Google já existente. Ela permanece disponível também em **Sala e convidados**, nas mídias e no agendador.
3. Clique numa mensagem. Nome, foto disponível e comentário aparecem sobre o programa no OBS, com as cores da APCE. O cartão escolhido fica marcado como **NA TELA**.
4. Clique em outro comentário para substituí-lo. Para retirar o destaque, clique novamente na mensagem marcada ou use **Retirar da tela**. A mensagem continua no chat do YouTube.

O destaque acompanha a troca entre as sete cenas. Ele é retirado quando a live selecionada muda ou é concluída. Os convidados também o veem quando o retorno privado do estúdio está ligado.

Use **Buscar comentário** para filtrar por nome ou conteúdo. A coluna guarda até 300 mensagens recentes recebidas do YouTube. Comentários compridos têm a fonte ajustada no cartão; o espaço da transmissão comporta até oito linhas. No tema areia, abra ou recolha a coluna pelo botão de **Comentários**, no cabeçalho; use **×** ou **Escape** para fechá-la em telas estreitas.

Se ainda não há live selecionada, a coluna informa essa situação. Se o YouTube ainda não disponibilizou o chat, o painel aguarda. Uma queda de conexão aciona a reconexão com continuação das mensagens; **Reconectar** permite uma nova tentativa manual. Erros de autorização devem ser resolvidos em **Agendar live → Conectar YouTube**.

A fonte **APCE · Comentário em destaque** está instalada acima das demais fontes nas sete cenas. **Reparar cenas** também restaura essa integração. O arquivo do programa e as credenciais permanecem no computador; os tokens do Google ficam no servidor local.

## Validação

Os testes automatizados conferem seleção e retirada, troca de live, reconexão, continuação do histórico, mensagens removidas, memória limitada e transporte gRPC local. A conferência no OBS usou comentários simulados: o cartão foi renderizado, acompanhou a troca para Entrevista e desapareceu ao ser retirado. Também foram conferidos busca, texto literal seguro, acentos, emoji, disposição à esquerda e acesso no celular.

A leitura de um chat real depende de haver uma transmissão selecionada com chat disponível. Nenhuma live pública nem comentário no YouTube foi criado para esses testes.

Implementação baseada na [documentação oficial de leitura contínua do chat do YouTube](https://developers.google.com/youtube/data/live/streaming-live-chat) e na [referência de mensagens](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages).
