# APCE Stream

Estúdio de transmissão da APCE: painel em tema areia, controle do OBS, agendamento e início/fim de lives no YouTube, comentários em destaque, convidados por link e biblioteca de mídias com PDFs e slides.

Esta versão opera em **Windows com OBS local**. A migração para a nuvem está analisada em [Viabilidade na DigitalOcean](docs/viabilidade-digitalocean.md); o repositório ainda não é um serviço pronto para exposição pública.

## Funcionalidades

- Sete cenas: preparação, abertura leve, solo, entrevista, sala aberta, mídia e encerramento.
- Transições com Move; identificação, microfones, prévia e gravação local.
- Entrada de câmera/microfone dentro do painel e mixer com medidores, mute, volume e escuta local para abertura, mídias, conversa e compartilhamento.
- Agendamento com título, descrição, horário de Brasília, visibilidade, público infantil e thumbnail.
- Início e encerramento da live selecionada pelo painel, com confirmação.
- Comentários do YouTube em coluna lateral e destaque sobre a transmissão.
- Aprovação de convidados, 12 lugares incluindo apresentadores e retorno privado do programa.
- Upload de imagens, vídeos e PDFs, apresentador de slides e criação de sequências de imagens.
- Navbar, formulários sob demanda e painéis móveis; layout para computador e celular.

Os 12 lugares estão implementados, mas a operação real com 12 câmeras simultâneas ainda exige ensaio. As verificações locais aprovadas incluíram duas câmeras e retorno; o teste de carga completo não foi aprovado. Consulte [Operar a live pelo painel](Operar%20a%20live%20pelo%20painel.md).

## Instalação local

Baixe e extraia o repositório em uma pasta do **Windows x64**. Com internet disponível, execute este único comando nessa pasta, ou dê dois cliques no arquivo de mesmo nome:

```powershell
& '.\Instalar APCE Stream.cmd'
```

O instalador baixa e prepara **Node.js, Python, FFmpeg/FFprobe, OBS, Move e VDO.Ninja**, instala as dependências JavaScript/Python, cria a configuração e abre o estúdio. Os runtimes ficam dentro da aplicação; não é necessário instalar Python ou Node antes. Caso falte o runtime Visual C++ da Microsoft, o Windows pedirá permissão para instalá-lo. Os pacotes têm versões fixas e SHA-256 conferido.

Nas próximas utilizações, abra **Abrir Painel APCE.cmd**. Ele inicia o serviço local, o OBS no perfil **APCE Painel** e o navegador em `http://127.0.0.1:3210`. A instalação inicial prepara as cenas quando o OBS conecta. Se ainda estiver iniciando, use **Configurações → Reparar cenas**, com transmissão e gravação desligadas.

**Nenhuma instalação precisa receber o JSON OAuth.** A identidade Google é fornecida pelo serviço central no App APCE; em computadores novos, use **Agenda → Conectar YouTube** e autorize o canal **@apcedf**. A chave privada do aplicativo fica na VM e não acompanha o repositório. Reinstalações no mesmo usuário do Windows também recuperam a conexão já autorizada de `%LOCALAPPDATA%\APCE Stream\youtube\connection.dpapi`, protegida pelo Windows e fora da pasta da aplicação. Se o Google exigir nova autorização, basta repetir o login. Consulte [Instalação e OAuth](docs/instalacao-windows.md).

A configuração inicial gera senhas e identificadores novos em `private/studio.json`, sem exibi-los. A abertura leve está em `media/abertura-leve.mp4`; os assets utilizados pelo painel e pelas cenas estão em `public/assets/`. O preparo preserva configurações existentes, inclusive o OBS original.

## Operação

- [Guia completo de operação](Operar%20a%20live%20pelo%20painel.md)
- [Câmera, microfones e som das mídias](Áudio%20e%20câmera.md)
- [Tema areia e painéis móveis](Painel%20areia.md)
- [Fundos das cenas na identidade areia, sem frases](Cenas%20areia.md)
- [Comentários na transmissão](Comentários%20na%20transmissão.md)
- [Desempenho e participação no YouTube](Desempenho%20e%20participação.md)
- [Biblioteca e apresentador de slides](Biblioteca%20de%20mídias%20e%20slides.md)
- [Configuração do Move](Move%20-%20transições%20do%20estúdio.md)

Alguns guias e roteiros de diagnóstico registram a implantação original no computador do responsável. Caminhos de acervo, relatórios, configurações privadas e binários citados nesses registros não são distribuídos pelo Git.

## Desenvolvimento e testes

```powershell
npm run test:unit
python -m unittest discover -s scripts -p "test_preparar.py"
```

Os testes unitários usam serviços simulados e não publicam lives. Para as verificações da interface:

```powershell
npx playwright install msedge
npm run test:panel
npm run test:comments-ui
```

Esses roteiros exigem o painel local aberto; o teste de comentários também usa o OBS e recusa a execução com transmissão/gravação ativa. Outros roteiros em `scripts/` verificam cenas, Move, áudio, retorno e dispositivos simulados; leia suas condições antes de executá-los.

## Configuração e privacidade

O servidor escuta somente em loopback. A pasta `private/` armazena acesso ao OBS, sala e estado. A configuração OAuth e os tokens Google ficam na pasta de dados do usuário, protegidos com DPAPI do Windows; eles não podem ser simplesmente copiados para outro usuário ou Linux. A chave de transmissão circula apenas entre o backend e o OBS.

Credenciais, configuração do OBS, gravações, biblioteca enviada, logs, relatórios de teste e dependências compiladas estão excluídos do Git. Não exponha a porta do painel ou o WebSocket do OBS diretamente na internet. A implantação web exige autenticação e permissões no backend, além das adaptações descritas no estudo da VM.

## Direitos sobre assets

Marcas, wallpaper, abertura e artes da APCE são incluídos para esta aplicação por solicitação do responsável. Esta publicação não concede uma licença geral de uso das marcas ou do acervo. OBS, plugins, bibliotecas e seus respectivos códigos mantêm suas próprias licenças e são obtidos de suas fontes oficiais.
