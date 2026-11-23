export function syncPanelViews(){
  const special=['agendador','biblioteca','estudio'],active=location.hash.slice(1),custom=special.includes(active);
  document.querySelector('.workspace-heading').hidden=custom;document.querySelector('.workspace-grid').hidden=custom;
  for(const id of special){const element=document.getElementById(id);if(element)element.hidden=active!==id;}
  document.querySelectorAll('.rail-links>a').forEach(a=>a.classList.toggle('active',a.hash===(location.hash||'#programa')));
}
window.addEventListener('hashchange',syncPanelViews);
