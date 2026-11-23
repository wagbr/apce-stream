# Autorização Google central no App APCE

O serviço está em `https://api.apceapp.com.br/stream-auth/`, na VM do App APCE. A aplicação Windows continua responsável pelo OBS, pelas cenas e pela transmissão. O serviço central guarda a identidade OAuth Web, troca códigos por tokens e renova autorizações, sem armazenar tokens dos usuários em disco.

O navegador recebe o callback Google em `http://127.0.0.1:3210/api/youtube/callback`. Esse endereço já cadastrado no cliente Google permanece o mesmo. O painel valida estado de uso único e PKCE; seu backend envia o código e o verificador ao serviço central por HTTPS. O serviço usa o segredo privado, confirma o ID do canal APCE e retorna os tokens e um comprovante HMAC vinculado ao refresh token. A aplicação salva esses dados com DPAPI do usuário Windows. A renovação exige o token e o comprovante válidos. O segredo Google não é devolvido aos computadores.

## Implantação

Arquivos públicos: `auth-service/server.mjs`, `Dockerfile`, `.dockerignore`, `compose.yml` e `enable-nginx.py`. Na VM, a pasta é `/opt/apce/apce-stream-auth`; o contêiner é `apce-stream-auth`, com porta `127.0.0.1:3291`. O Nginx encaminha somente `/stream-auth/`, sem registrar acessos dessa rota. O contêiner roda como usuário sem privilégios, com sistema de arquivos somente para leitura, limites de 128 MiB/0,25 CPU e sem capacidades adicionais. O serviço limita tamanho das requisições e tentativas por IP, rejeita origens de navegador e não registra corpos ou tokens.

A configuração privada fica em `/opt/apce/apce-stream-auth/private/oauth.json`, com proprietário UID 1000 e modo `600`, em diretório `700`, montada como segredo somente para leitura. Contém `client_id`, `client_secret`, `channel_id` e `ticket_key`. O `ticket_key` é aleatório e deve ser preservado em atualizações. O arquivo e os backups privados não pertencem ao repositório ou ao contexto Docker. O administrador deve incluir essa pasta no backup privado da VM.

Para atualizar o serviço após copiar os arquivos públicos:

```sh
docker compose --project-directory /opt/apce/apce-stream-auth -f /opt/apce/apce-stream-auth/compose.yml up -d --build
```

O script `enable-nginx.py` é executado na própria VM para a primeira ativação da rota. Ele guarda backup da configuração anterior em `deployment-backups/`, usa os comandos `sudo` permitidos ao usuário deploy, confere `nginx -t` e recarrega o Nginx. Se a verificação HTTPS falhar, restaura a configuração anterior. Não modifica os contêineres do App APCE.

## Operação e recuperação

`GET /stream-auth/health` informa a saúde do processo. `GET /stream-auth/v1/config` contém somente metadados públicos. `POST /v1/exchange` recebe código, verificador PKCE e retorno local fixo. `POST /v1/refresh` recebe refresh token e comprovante assinado. Corpos e respostas dessas operações não devem ser adicionados aos logs ou ao Git.

Se a VM ficar indisponível, um acesso local ainda válido pode continuar funcionando até expirar. Novos logins e renovações dependem do serviço central. Restaurar a configuração privada mantém os comprovantes existentes; trocar `ticket_key` invalida os comprovantes e exige novo login. Alterar/revogar o cliente Google também pode exigir autorização novamente. O estado **Em teste** do Google pode limitar a validade da autorização, conforme as [regras de expiração](https://developers.google.com/identity/protocols/oauth2#expiration).

Para retirar a rota, restaure o backup de Nginx identificado na implantação com `sudo /bin/cp`, confira `sudo /usr/sbin/nginx -t` e use `sudo /usr/bin/systemctl reload nginx`. Depois, pare somente este contêiner com `docker compose ... stop`. Preserve a configuração privada para recuperação.

## Verificação

Os testes `scripts/test-oauth-broker.mjs` verificam o fluxo completo com Google simulado, ausência do segredo nos metadados e na instalação local, PKCE/retorno, canal incorreto, autorização revogada, comprovante adulterado/trocado/expirado, renovação, limites HTTP e reinstalação. O teste de instalação limpa usa dados de usuário isolados e confirma a obtenção automática da identidade central sem copiar tokens do operador. A validação real solicita consentimento Google no navegador; não cria nem inicia lives.
