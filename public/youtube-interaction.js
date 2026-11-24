export function interactionHint({privacy,madeForKids}={}){
  if(madeForKids===true)return 'O YouTube desativa chat ao vivo e comentários em conteúdo feito para crianças.';
  if(privacy==='private')return 'Live privada: o acesso é restrito e os comentários do vídeo ficam indisponíveis. Para testar a participação de outras pessoas por link, escolha Não listada.';
  return 'O chat ao vivo é ativado por padrão pelo YouTube. Para escrever, o espectador deve entrar na conta do YouTube. Restrições a inscritos, membros ou participantes aprovados são ajustadas no YouTube Studio.';
}
