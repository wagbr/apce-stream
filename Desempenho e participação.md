# Desempenho e participação

O perfil APCE Painel mantém a composição e a saída em 1920 × 1080, a 30 fps e 6.000 kbps. Neste computador, o codificador de transmissão foi alterado de x264 para AMD H.264, após o teste nativo do OBS confirmar suporte. O modo de saída avançado fixa CBR, preset de desempenho e quadros-chave a cada dois segundos. A gravação usa o codificador da transmissão. Não é necessário mudar o comando de abertura do aplicativo.

Em instalações novas, a preparação consulta `obs-amf-test.exe`, distribuído com o próprio OBS, e seleciona AMD somente se a GPU informar suporte a H.264. Caso contrário, mantém x264. Reinstalações preservam o perfil existente. Os convites limitam a captura a 30 fps com possibilidade de ajuste para câmeras que não suportem essa taxa. Textos e molduras são desenhados a 10 fps; câmeras, mosaico, transições Move e comentários animados mantêm sua cadência própria.

O Programa mostra uma medição do OBS a cada cinco segundos. O indicador distingue perdas na composição, na codificação e no envio pela rede. Passe o mouse sobre a medição para ver os percentuais. Esse indicador não mede a recepção no aparelho do espectador nem garante a qualidade da conexão de cada convidado.

A prévia do painel é uma imagem atualizada a cada dois segundos. Ela serve para conferir o enquadramento; avalie a fluidez no OBS ou no player do YouTube.

## Chat do YouTube

O YouTube [ativa o chat ao vivo por padrão](https://developers.google.com/youtube/data/live/reference/rest). A API pública não oferece um parâmetro para forçar a ativação do chat ou remover restrições a inscritos, membros e participantes aprovados. Essas opções são configuradas em **YouTube Studio → Editar → Chat ao vivo**; a coluna de comentários oferece um atalho para a live selecionada.

O agendador começa com a audiência “Não é feita para crianças”, adequada às conversas usuais da APCE. Confira a classificação de cada conteúdo e altere quando necessário. O YouTube desativa chat e comentários para [conteúdo feito para crianças](https://support.google.com/youtube/answer/2853834).

Para testar a interação em outro aparelho sem publicar a live no canal, escolha **Não listada** e entre em uma conta do YouTube no aparelho. Quem tiver o link poderá acessar e compartilhar. Vídeos **Privados** têm acesso restrito e [não permitem comentários no vídeo](https://support.google.com/youtube/answer/157177). O painel avisa sobre essas condições antes de agendar e iniciar, sem alterar a visibilidade escolhida.

Os testes locais de desempenho ficam em `evidencias/desempenho/`, excluídos do Git. Medições locais não substituem um teste de recepção real no YouTube.

Na investigação de 24/11/2026, o log da transmissão anterior registrou 9,3% de perdas na codificação x264, sem perdas de rede. Na validação final do perfil AMD, com o retorno privado também codificando, a abertura inteira de 134,6 segundos terminou e avançou automaticamente. Foram registrados dois quadros perdidos na codificação e um na composição, ambos abaixo de 0,1% dos respectivos totais. Solo, Entrevista, Sala aberta e Mídia mantiveram 30 fps sem perdas nos trechos medidos. O uso médio de CPU do OBS variou de aproximadamente 3% a 9% nesses testes.

O som foi confirmado nos arquivos gravados: RMS de aproximadamente −16,7 dB na abertura e −17,4 dB na mídia. Um receptor direto e um convidado simulado também receberam o programa em 1280 × 720 com áudio da abertura; no convidado, o RMS foi de aproximadamente −18,8 dB. Esses testes usaram reprodução local bloqueada, sem iniciar uma transmissão no YouTube. Não constituem uma medição de desempenho com 12 participantes simultâneos nem da recepção pública no YouTube.

O monitor do retorno usa uma conexão direta protegida pela senha, sem entrar como outra cena da sala. Em salas com aprovação, o próprio publicador nativo do OBS pode aguardar admissão: ligue o retorno antes de divulgar o convite e confira a fila de pedidos na direção. Aprove somente essa fonte técnica; ela não ocupa vaga na grade de 12 pessoas. A aprovação é por sessão e pode ser solicitada novamente após reiniciar o retorno. A validação do convidado foi concluída após essa admissão.
