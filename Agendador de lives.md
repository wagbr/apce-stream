# Agendador de lives da APCE

Abra **Abrir Painel APCE.cmd** e clique no ícone de calendário **Agendar live** na barra lateral. O endereço direto é <http://127.0.0.1:3210/#agendador>.

O formulário prepara título, descrição, data/hora, visibilidade, classificação do público e thumbnail. O horário é sempre interpretado em **Brasília — America/Sao_Paulo**, mesmo que o navegador esteja em outro fuso. O painel aceita thumbs JPG e PNG de até **2 MB** e recomenda 1280 × 720.

O rascunho, incluindo a thumb, fica no IndexedDB deste navegador. Ao clicar em **Agendar no YouTube**, o servidor cria a transmissão na API oficial e envia a thumbnail. A confirmação **Encontro marcado** só aparece depois das duas etapas. O resultado inclui o link da chamada, e o botão **Agendar outra live** limpa o formulário para o próximo encontro.

## Conexão inicial

O agendador usa a autorização Google do painel. Essa mesma conexão permite iniciar e encerrar as lives, usando o perfil **APCE Painel** no OBS portátil. O perfil APCE anterior foi preservado. Para habilitar o envio pelo painel:

1. Entre no [Google Cloud](https://console.cloud.google.com/) com a conta que administrará o projeto da APCE. Crie ou escolha um projeto.
2. Ative a [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) nesse projeto.
3. Em **Google Auth Platform**, configure o nome do aplicativo, o e-mail de suporte, o público e o contato. Um nome possível é **Estúdio APCE**. Para conta pessoal, selecione público externo; se o app estiver em teste, inclua seu e-mail em **Público → Usuários de teste**.
4. Em [Clientes](https://console.cloud.google.com/auth/clients), crie um cliente OAuth **Aplicativo Web** e configure os endereços abaixo. O painel também aceita um cliente **Aplicativo para computador**. Baixe o JSON completo. Uma chave de API ou um arquivo de conta de serviço não substitui esse cliente OAuth.
5. No painel, clique em **Conectar agendador → Importar JSON OAuth**. Selecione o arquivo baixado.
6. Clique em **Conectar YouTube**, entre na conta Google e selecione o canal **@apcedf**. Autorize o acesso solicitado. O painel confere o ID do canal com o endereço @apcedf e rejeita uma conexão com outro canal.

Para **Aplicativo Web**, use exatamente:

| Campo no Google Cloud | Valor |
| --- | --- |
| Origens JavaScript autorizadas | `http://127.0.0.1:3210` — opcional neste fluxo, processado pelo servidor local. |
| URIs de redirecionamento autorizadas | `http://127.0.0.1:3210/api/youtube/callback` |

Depois de salvar, baixe o JSON atualizado e importe no painel. Se o cliente já atende outro aplicativo, preserve os endereços existentes e acrescente o retorno do estúdio. A correspondência da URI é exata: `localhost` e `127.0.0.1` são endereços diferentes; não acrescente `/` depois de `callback` nem `#agendador`. Essas regras seguem o [fluxo Web do OAuth do Google](https://developers.google.com/identity/protocols/oauth2/web-server).

Um cliente **Aplicativo para computador** usa o retorno local `http://127.0.0.1:3210/` e não tem campos de origens JavaScript para preencher. A chave `installed` de um JSON, isoladamente, não confirma que o cliente foi criado para computador; outros tipos instalados podem ter restrições diferentes. Confira o tipo em Clientes no Google Cloud.

Não é necessário publicar o painel na internet. O arquivo JSON é importado pela interface, sem colar senha ou token no chat. A configuração do agendador mostra o retorno em uso e, quando o Google retorna ao painel com uma falha, seu código de erro.

Se o projeto estiver no estado **Em teste**, o Google pode limitar a autorização a sete dias; nesse caso, use **Conectar YouTube** novamente quando solicitado. Consulte as [regras de expiração do OAuth](https://developers.google.com/identity/protocols/oauth2#expiration). A configuração e os tipos de credencial seguem a [documentação de autorização do YouTube](https://developers.google.com/youtube/v3/guides/authentication) e o [OAuth para aplicativos de computador](https://developers.google.com/identity/protocols/oauth2/native-app).

## No dia da transmissão

No painel, volte ao **Programa**, atualize a lista e selecione a chamada agendada. Confira a cena inicial e o áudio e use **Iniciar transmissão → Entrar ao vivo agora**. O painel configura o envio do OBS e publica o evento no YouTube. Para terminar, use **Encerrar transmissão**. O agendamento não inicia o computador nem transmite sozinho. Consulte [o guia de operação](Operar%20a%20live%20pelo%20painel.md).

**Atualizar do YouTube** consulta as próximas lives do canal. O painel também mantém os resultados dos envios feitos por ele. As alterações feitas diretamente no YouTube Studio aparecem na consulta da agenda; os registros locais preservam o resultado original do envio.

## Quando um envio falha

- **Thumb pendente:** a live já foi criada. Use **Reenviar somente a thumb**; o painel preserva o ID e repete apenas o upload.
- **Resultado a confirmar:** houve perda de resposta durante a criação. **Verificar resultado sem duplicar** procura o evento com os mesmos dados. Se não houver confirmação suficiente, o painel pede a conferência no YouTube Studio e não repete a criação automaticamente.
- **Envio recusado:** revise a mensagem do YouTube. Entre as causas estão API desativada, autorização revogada, recursos de live/thumbnail indisponíveis e cota da API esgotada.

Use a mesma tentativa, com os mesmos dados, para retomar um envio interrompido. O identificador da tentativa fica no rascunho e no registro do servidor. Envios idênticos, inclusive após reiniciar o painel, reaproveitam o resultado existente.

## Armazenamento e manutenção

Credenciais OAuth e tokens ficam em `private/youtube/connection.dpapi`, criptografados com a proteção **DPAPI do usuário atual do Windows**. A interface recebe apenas o estado da conexão e o nome/ID público do canal. Em outro computador ou usuário do Windows, conecte novamente. Para revogar também a autorização no Google, remova o acesso do aplicativo nas configurações da conta Google.

O registro dos envios fica em `private/youtube/schedules.json`; as thumbs ficam em `private/youtube/thumbs/`. Esses caminhos não são servidos como arquivos públicos. O painel escuta apenas em `127.0.0.1` e aceita operações de escrita somente da própria origem local.

## Verificação desta implementação

Foram aprovados 18 testes de integração do módulo com Google simulado e 9 verificações do servidor/interface, incluindo DPAPI real do Windows, rascunho com imagem, fuso diferente, recuperação de envio, falha de thumb e telas entre 320 e 1920 px. Relatório: `evidencias/verificacao-agendador.json`. Os ensaios não criaram lives no canal. A validação com o Google real depende da importação da credencial OAuth e da autorização da conta APCE.

Para repetir os testes locais:

```powershell
cd 'Estudio APCE'
npm run test:youtube
# Com o painel aberto e ainda sem credenciais reais importadas:
npm run test:scheduler-ui
```
