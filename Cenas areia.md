# Fundos das cenas — identidade areia APCE

As seis cenas estáticas usam fundos sem frases, slogans, títulos decorativos, logos ou endereços embutidos. A arte segue o wallpaper fornecido: papel areia, gravuras em grafite de microfone, balão e instrumentos científicos, com detalhes rosa APCE. Preparação e Encerramento usam a colagem mais presente; Solo e Entrevista usam a composição mais limpa; Sala e Mídia acrescentam as molduras de composição.

O OBS utiliza fontes nativas de imagem em 1920 × 1080. Isso substitui seis páginas de navegador para os fundos. As câmeras, os microfones, o retorno, as posições dos participantes e o Move são preservados. Os nomes, o assunto preenchido pelo operador e os comentários continuam em camadas próprias, sem textos automáticos. A sala vazia também não exibe frases. O vídeo de abertura permanece o arquivo original.

Os arquivos estão em [public/assets/areia-v3](public/assets/areia-v3/):

- [Mestre do estúdio](public/assets/areia-v3/fundo-estudio-master.png) e [versão de produção](public/assets/areia-v3/fundo-estudio.webp).
- [Mestre de preparação e encerramento](public/assets/areia-v3/fundo-espera-master.png) e [versão de produção](public/assets/areia-v3/fundo-espera.webp).
- `fundo-sala.webp` e `fundo-midia.webp`: exportações com as molduras posicionadas pelo layout.
- `scene-*-v3.webp`: sete miniaturas para o painel.
- [Prompts completos e ferramenta utilizada](public/assets/areia-v3/prompts.md).

As imagens foram criadas com a ferramenta integrada imagegen. O wallpaper fornecido e as artes orbitais antigas foram preservados. O ajuste de tamanho e formato usa FFmpeg; as molduras e as miniaturas são exportadas do layout HTML/CSS.

Para gerar novamente as composições a partir das artes salvas, com o painel aberto:

```powershell
node scripts/renderizar-cenas-areia.mjs
node scripts/aplicar-cenas-areia.mjs
```

A aplicação recusa a troca durante transmissão ou gravação. O script salva uma cópia privada da coleção antes de alterar as fontes e verifica que a câmera e o áudio mantêm suas configurações. As evidências locais ficam em `evidencias/areia-v3/`, fora do Git. Novas instalações e Reparar cenas usam os mesmos fundos.
