# Instalação local e conexão Google

Em uma cópia extraída do APCE Stream, execute:

```powershell
& '.\Instalar APCE Stream.cmd'
```

Requer Windows x64 e internet. O instalador inclui Node.js 24.22.3, Python 3.14.10, FFmpeg/FFprobe 9.1, OBS 33.0.1, Move 3.2.2 e VDO.Ninja 1.1.85, além das bibliotecas descritas em `package-lock.json` e `requirements.txt`. Não exige Python, Node, Git ou FFmpeg previamente instalados. O Python é provisionado por uv em `runtime/`; o OBS fica em `obs/`. O runtime Visual C++, se ausente, é obtido da Microsoft e requer confirmação do Windows. Essa etapa confere a assinatura digital Microsoft; os demais arquivos portáteis têm SHA-256 fixado em `installer/dependencies.json`.

Para instalar sem abrir OBS/navegador ou para apenas conferir os componentes:

```powershell
& '.\Instalar APCE Stream.cmd' -SemAbrir
& '.\Instalar APCE Stream.cmd' -Verificar
```

Após instalar, use **Abrir Painel APCE.cmd** no dia a dia. O instalador prepara a coleção inicial e a transição Move; com o OBS conectado, cria as cenas automaticamente. A primeira execução do OBS pode pedir permissões do Windows ou confirmação de configurações. Se a conexão demorar, use **Configurações → Reparar cenas** no painel. O instalador não inicia transmissão nem gravação.

## Reinstalações

O instalador reaproveita componentes existentes e preserva `private/studio.json`, os perfis e as cenas já configurados. Não atualiza automaticamente um OBS existente para outra versão. Só executa o preparo inicial se faltar a configuração ou o perfil do painel. Transmissão ou gravação ativa impede a instalação.

Para manter também a biblioteca de mídias, os identificadores da sala e o histórico ao trocar de pasta, preserve a pasta `private/` da instalação anterior. Isso é independente da configuração OAuth.

## OAuth sem repetir a importação

A instalação consulta automaticamente a identidade pública do aplicativo Google em `https://api.apceapp.com.br/stream-auth/v1/config`. O segredo do cliente Web fica somente no serviço central do App APCE. A troca do código de autorização e a renovação do acesso passam por esse serviço, por HTTPS. O serviço confere se o canal selecionado é o canal APCE e exige um comprovante assinado, vinculado ao token, para renovar a conexão. Ele não persiste tokens de usuários.

Em um computador novo, use **Agenda → Conectar YouTube**, entre no Google e escolha **@apcedf**. Não é necessário baixar, copiar ou importar JSON. O login e o consentimento do Google continuam necessários; o instalador não concede acesso à conta automaticamente.

A identidade pública e a autorização local do canal ficam criptografadas com DPAPI em:

```text
%LOCALAPPDATA%\APCE Stream\youtube\connection.dpapi
```

Essa pasta pertence ao usuário do Windows e fica fora da instalação. O instalador e o servidor migram automaticamente a configuração legada de `private/youtube/connection.dpapi` quando o armazenamento persistente ainda não existe. A migração valida a descriptografia antes de salvar e mantém o arquivo anterior.

Uma reinstalação em outra pasta do **mesmo usuário do Windows** recupera a configuração sem copiar o JSON. Se o Google exigir nova autorização, use **Agenda → Conectar YouTube**. Desconectar o canal preserva a identidade OAuth para o próximo login. A proteção não permite transferir esse arquivo para outro computador ou usuário.

Ao reconectar uma instalação antiga, a autorização passa a usar o serviço central e o armazenamento ativo deixa de conter o segredo Web. A cópia legada é mantida como configuração anterior. Se o serviço central ou a internet estiver indisponível, aguarde e tente conectar novamente; não é necessário importar JSON. A configuração Google do servidor é uma tarefa administrativa, feita uma vez. A separação do segredo segue as [políticas OAuth do Google](https://developers.google.com/identity/protocols/oauth2/policies).

O OBS e o processamento das cenas continuam no computador local. A VM hospeda somente a autorização Google deste fluxo. Consulte [Operação do serviço central](oauth-central.md).

## Verificação

`installer/test-functions.ps1` verifica rejeição de caminhos externos, arquivos ZIP com travessia de diretório, pacotes adulterados e preservação de componentes existentes. `scripts/test-installer-clean.ps1` instala em uma pasta temporária com `PATH` sem Node/Python/FFmpeg globais e dados OAuth isolados; não usa a conta do operador nem transmite. O relatório resumido fica em `evidencias/instalacao-limpa.json`. São verificações locais; uma VM Windows recém-formatada ainda é necessária para testar a etapa de instalação do Visual C++ ausente.
