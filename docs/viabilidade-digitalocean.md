# Viabilidade do APCE Stream na VM do App APCE

Inspeção em **23 de novembro de 2026**, por SSH, usando os dados de conexão do projeto App APCE. Foram consultados sistema, recursos, processos, ferramentas e roteamento. Nenhum pacote foi instalado, nenhum contêiner foi reiniciado e nenhuma configuração de produção foi alterada.

## Situação observada

| Item | Resultado |
| --- | --- |
| Sistema | Ubuntu 22.04.5 LTS, x86_64 |
| CPU | 2 processadores lógicos disponíveis |
| Memória | 3.911 MiB totais; aproximadamente 1.773 MiB disponíveis na amostra |
| Swap | 2.047 MiB totais, 392 MiB utilizados na amostra |
| Disco raiz | 25 GB, aproximadamente 12 GB livres |
| Carga | 0,08 / 0,03 / 0,01 na primeira amostra |
| Aplicação existente | Sete contêineres: backend, ASGI, worker, beat, ClamAV, Redis e PostgreSQL/PostGIS |
| Node do host | 12.22.9, inadequado para este projeto |
| Python do host | 3.10.12 |
| Vídeo | Adaptador VirtIO; não foi identificada GPU dedicada ou codificação NVENC |
| Ferramentas no PATH do host | OBS, FFmpeg, Xvfb, PulseAudio e TURN não encontrados |
| Entrada web | Nginx com HTTPS; serviços Python publicados em loopback |
| Upload no proxy consultado | `client_max_body_size 20m` |

O ClamAV utilizava aproximadamente 1,1 GiB e o worker 352 MiB. São amostras de utilização, não um teste de carga nem uma prova de capacidade futura. O renderizador VirtIO não comprova suporte a OpenGL ou aceleração de vídeo compatível com o OBS.

## Conclusão

**É viável estudar o painel e seus serviços web nesta VM, mantendo o OBS no computador, após portar os componentes dependentes de Windows e acrescentar autenticação. A VM atual não está pronta para assumir a produção integral da live, especialmente a meta de 12 participantes.**

Hospedar apenas os arquivos HTML não transfere a produção de vídeo. Atualmente o Node controla um OBS por WebSocket em loopback; as fontes de navegador do OBS recebem as câmeras e a máquina monta/codifica o programa. O agendador e o chat também dependem do backend local.

## O que falta para hospedar o painel

1. **Isolar o novo serviço.** Usar um contêiner com Node LTS, volume persistente e limites de recursos. O Node 12 do host não atende às APIs usadas pelo projeto. Um contêiner evita alterar o runtime dos serviços existentes.
2. **Integrar o login e as permissões do App APCE.** Apenas produtores autorizados devem iniciar/encerrar uma live, exibir comentários e moderar convidados. O bloqueio atual por Host/Origin de loopback atende ao uso local; ele não substitui autenticação para uso público. Acrescentar sessões, proteção de requisições, auditoria e limites de uso antes de abrir o serviço.
3. **Definir HTTPS e endereçamento.** Criar um subdomínio de estúdio, ou adaptar o prefixo de todas as rotas e assets para integração sob o domínio existente. O frontend usa caminhos absolutos como `/api/` e `/assets/`; copiá-lo diretamente para uma subpasta não basta. Manter o WebSocket do OBS restrito à rede interna ou a um túnel autenticado.
4. **Portar segredos e OAuth.** Substituir DPAPI/PowerShell por armazenamento de segredos apropriado ao Linux. Cadastrar retorno OAuth HTTPS e autorizar novamente o canal; a credencial protegida do usuário Windows não é reutilizável no servidor. Associar a autorização às permissões do produtor.
5. **Rever mídia e armazenamento.** O proxy limita uploads a 20 MB, enquanto o aplicativo aceita PDFs de até 100 MB e vídeos de até 1 GB. Definir limites por usuário, limpeza, cotas e armazenamento de objetos, em vez de consumir os 12 GB livres do host. Substituir o seletor de arquivos Windows pelo upload web em todos os fluxos remotos.
6. **Criar o conector local seguro**, caso o OBS permaneça no computador. Ele deve estabelecer conexão autenticada de saída para o servidor e executar os comandos autorizados. O backend não poderá continuar assumindo que `127.0.0.1` identifica o computador do apresentador.

## O que falta para dispensar o computador do produtor

Além dos itens acima, será necessário um **nó de produção de vídeo**, preferencialmente separado da VM que atende ao aplicativo:

- Instalar e supervisionar o compositor/encoder. Se for OBS Linux, preparar X11/Wayland, suporte gráfico compatível e fontes de navegador, áudio virtual e plugins compatíveis. O OBS exige OpenGL 3.3 no Linux; não foi executado um ensaio gráfico nesta VM.
- Substituir o controle de Guest Return feito hoje por `pywinauto`, menus e identificação de janelas Windows. Ele precisa de uma implementação controlável no ambiente Linux ou de outra solução de retorno WebRTC.
- Dimensionar CPU, RAM, aceleração e transferência com testes reais. Para uma prova de conceito separada, uma máquina com CPUs dedicadas e mais memória é uma hipótese de partida; nenhum tamanho foi aprovado para 12 câmeras. O teste anterior no computador local também não validou a carga completa.
- Definir a infraestrutura de convidados. É possível começar mantendo o VDO.Ninja externo; hospedar sinalização, TURN ou um SFU próprio é uma decisão adicional, conforme os requisitos de rede e escala.
- Medir perdas de quadros, latência, reconexão, áudio e recuperação do encoder, com os convidados em redes distintas e sem disputar recursos com o banco e a API de produção.

Na configuração atual, cada retorno permite até 2.500 kbps. Doze retornos representam até **30 Mbps de saída**, além dos cerca de 6 Mbps do envio ao YouTube e de outras conexões. A estimativa de 36 Mbps sustentados equivale a aproximadamente **16,2 GB por hora**, sem contar sobrecarga de protocolo. Não foi medida a taxa real nem consultada a franquia contratada.

## Caminho sugerido

1. Publicar e validar o código de forma independente do App APCE.
2. Fazer uma implantação de homologação do painel, com autenticação e OBS local conectado por canal seguro.
3. Ensaiar o compositor em um nó separado com dois convidados e subir gradualmente a carga.
4. Escolher máquina e arquitetura de vídeo a partir das medições, antes de migrar a transmissão pública ou anunciar 12 câmeras.

Esta inspeção não incluiu implantação, alteração de DNS, aquisição/redimensionamento de máquina, teste de throughput ou início de uma transmissão real.

Referências: [requisitos do OBS](https://obsproject.com/kb/system-requirements/), [planos e CPUs da DigitalOcean](https://docs.digitalocean.com/products/droplets/concepts/choosing-a-plan/), [versões suportadas do Node.js](https://nodejs.org/en/about/previous-releases) e [TURN no VDO.Ninja](https://docs.vdo.ninja/advanced-settings/turn-and-stun-parameters/turn).
