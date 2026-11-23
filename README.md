# APCE Stream

Estúdio de transmissão da APCE: painel em tema areia, controle do OBS, agendamento e início/fim de lives no YouTube, comentários em destaque, convidados por link e biblioteca de mídias com PDFs e slides.

Esta versão opera em **Windows com OBS local**. A migração para a nuvem está analisada em [Viabilidade na DigitalOcean](docs/viabilidade-digitalocean.md); o repositório ainda não é um serviço pronto para exposição pública.

## Funcionalidades

- Sete cenas: preparação, abertura leve, solo, entrevista, sala aberta, mídia e encerramento.
- Transições com Move; identificação, microfones, prévia e gravação local.
- Agendamento com título, descrição, horário de Brasília, visibilidade, público infantil e thumbnail.
- Início e encerramento da live selecionada pelo painel, com confirmação.
- Comentários do YouTube em coluna lateral e destaque sobre a transmissão.
- Aprovação de convidados, 12 lugares incluindo apresentadores e retorno privado do programa.
- Upload de imagens, vídeos e PDFs, apresentador de slides e criação de sequências de imagens.
- Navbar, formulários sob demanda e painéis móveis; layout para computador e celular.

Os 12 lugares estão implementados, mas a operação real com 12 câmeras simultâneas ainda exige ensaio. As verificações locais aprovadas incluíram duas câmeras e retorno; o teste de carga completo não foi aprovado. Consulte [Operar a live pelo painel](Operar%20a%20live%20pelo%20painel.md).

## Instalação local

1. Instale **Node.js 22 ou 24 LTS**, Python 3.12 ou superior, FFmpeg e FFprobe disponíveis no `PATH`. O código tem compatibilidade mínima com Node 20.11, mas essa versão já saiu do suporte.
2. Baixe o ZIP do [OBS Studio](https://github.com/obsproject/obs-studio/releases) e extraia-o em `obs/`, de modo que exista `obs/bin/64bit/obs64.exe`. A instância original foi validada com OBS 33.0.1.
3. Instale no OBS portátil os plugins [Move](https://github.com/exeldro/obs-move-transition/releases) e [VDO.Ninja](https://github.com/steveseguin/ninja-obs-plugin/releases). As versões validadas foram Move 3.2.2 para OBS 33 e VDO.Ninja 1.1.85. Siga a estrutura de arquivos de cada pacote para a instalação portátil.
4. Na raiz deste repositório, execute:

```powershell
npm ci
python -m pip install -r requirements.txt
npm run init:windows
```

5. Abra **Abrir Painel APCE.cmd**. Ele inicia o serviço local, o OBS no perfil **APCE Painel** e o navegador em `http://127.0.0.1:3210`.
6. Em **Configurações → Reparar cenas**, prepare a coleção, com transmissão e gravação desligadas. Se o OBS ainda estiver iniciando, aguarde a indicação de conexão.
7. Em **Agenda**, configure seu cliente OAuth Google e autorize o canal **@apcedf**. A conexão desta máquina não acompanha o clone. Consulte [Agendador de lives](Agendador%20de%20lives.md).

A configuração inicial gera senhas e identificadores novos em `private/studio.json`, sem exibi-los. A abertura leve está em `media/abertura-leve.mp4`; os assets utilizados pelo painel e pelas cenas estão em `public/assets/`. O preparo preserva configurações existentes.

## Operação

- [Guia completo de operação](Operar%20a%20live%20pelo%20painel.md)
- [Tema areia e painéis móveis](Painel%20areia.md)
- [Comentários na transmissão](Comentários%20na%20transmissão.md)
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

O servidor escuta somente em loopback. A pasta `private/` armazena acesso ao OBS, sala, estado e OAuth. Os tokens Google usam DPAPI do usuário Windows; eles não podem ser simplesmente copiados para Linux. A chave de transmissão circula apenas entre o backend e o OBS.

Credenciais, configuração do OBS, gravações, biblioteca enviada, logs, relatórios de teste e dependências compiladas estão excluídos do Git. Não exponha a porta do painel ou o WebSocket do OBS diretamente na internet. A implantação web exige autenticação e permissões no backend, além das adaptações descritas no estudo da VM.

## Direitos sobre assets

Marcas, wallpaper, abertura e artes da APCE são incluídos para esta aplicação por solicitação do responsável. Esta publicação não concede uma licença geral de uso das marcas ou do acervo. OBS, plugins, bibliotecas e seus respectivos códigos mantêm suas próprias licenças e são obtidos de suas fontes oficiais.
