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

Na investigação de 24/11/2026, o log da transmissão anterior registrou 9,3% de perdas na codificação x264, sem perdas de rede. O primeiro comparativo local com AMD manteve 30 fps e zero perdas em Solo e Sala aberta, com o uso de CPU do OBS reduzido de aproximadamente 28% para 2%. A abertura em movimento ainda apresentou perdas nos testes seguintes; portanto, esses resultados não certificam sua fluidez. A decodificação por GPU piorou esse teste e foi revertida. O perfil final com quadros-chave de dois segundos precisa de nova validação audiovisual em horário adequado. Os testes foram interrompidos a pedido do operador, que estava em reunião; o OBS foi fechado e não deve ser reaberto automaticamente para completar essa validação.
