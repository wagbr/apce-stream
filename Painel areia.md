# Painel areia

O painel usa o arquivo **Identidade Visual APCE/Assets/Wallpaper APCE.png** como referência e fundo. A cópia servida pela aplicação é idêntica ao original. A interface combina areia e papel claro, textos grafite e destaques rosa da APCE.

Abra o mesmo **Abrir Painel APCE.cmd**. Recarregue com **F5** se a página estava aberta durante a atualização.

## Onde ficam os controles

- **Programa:** prévia do OBS, sete cenas, microfones e início/encerramento da transmissão. Clique na faixa **Transmissão do YouTube** para escolher a live. **Identificação** abre os nomes, o assunto e a cena após a abertura. **Exibição rápida** abre os controles de arquivos locais e compartilhamento.
- **Convidados:** sala, aprovação, convites e participantes. **Retorno do estúdio** abre seus controles em um painel próprio. As instruções adicionais ficam recolhidas em **Como operar esta etapa**.
- **Mídias:** biblioteca e apresentador de slides. **Adicionar arquivos** abre a área de importação. **Criar apresentação** continua abrindo o editor de slides. Preparar uma mídia revela sua mesa de apresentação.
- **Agenda:** conexão do canal e lista das transmissões. **Nova transmissão** abre título, descrição, data/hora, visibilidade, público infantil e thumb. O rascunho é preservado ao fechar e reabrir.
- **Configurações:** botão de ajustes no canto superior direito; reúne canal, reparo das cenas, ajuda e atalhos de áudio/convites.

Os comentários ficam na coluna esquerda no computador. O botão de comentários no cabeçalho permite recolher a coluna e abri-la novamente. Em telas estreitas, ele abre a coluna sobre a mesa.

## Painéis móveis

No computador, os formulários abrem em painéis flutuantes. Arraste o cabeçalho para movê-los; também é possível redimensioná-los pelo canto. Com o cabeçalho em foco, as setas movem o painel; **Shift + seta** aumenta o deslocamento e **Home** restaura a posição. A mesa continua acessível durante a edição.

No celular, os painéis viram folhas modais e a navbar fica na parte inferior. Feche por **×** ou **Escape**. Os campos permanecem preenchidos ao fechar um painel. Fechar o painel, sozinho, não envia o formulário.

## Validação

O roteiro `npm run test:panel` usa comandos simulados para conferir navegação, campos preservados, agendamento acessível, início e fim com confirmação, microfones, cenas, importação, retorno, arraste, cores dos campos e comportamento de 375 a 1920 pixels. Não inicia transmissão nem gravação real. As imagens de conferência ficam em `evidencias/painel-areia-*.png`.

A versão anterior dos arquivos alterados foi preservada em `backups/painel-antes-areia`.
