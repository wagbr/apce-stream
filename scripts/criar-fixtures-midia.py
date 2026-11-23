"""Materiais sintéticos de ensaio, sem conteúdo editorial de episódios."""
from pathlib import Path
import pymupdf

base=Path(__file__).resolve().parents[1]
folder=base/'evidencias/midias-teste'
folder.mkdir(parents=True,exist_ok=True)
font='C:/Windows/Fonts/segoeui.ttf'
document=pymupdf.open()
for index,title in enumerate(['Apresentação de teste','Navegação entre páginas','Fim do ensaio local']):
    page=document.new_page(width=1280,height=720)
    page.draw_rect(page.rect,color=None,fill=(.075,.075,.095))
    page.draw_rect(pymupdf.Rect(60,60,74,660),color=None,fill=(.937,.302,.388))
    page.insert_font(fontname='segoe',fontfile=font)
    page.insert_text((116,135),'TESTE LOCAL · NÃO PUBLICAR',fontname='segoe',fontsize=19,color=(.937,.302,.388))
    page.insert_text((116,340),title,fontname='segoe',fontsize=48,color=(.902,.827,.796))
    page.insert_text((116,420),'Verificação da biblioteca e do apresentador de slides da APCE.',fontname='segoe',fontsize=21,color=(.75,.72,.74))
    page.insert_text((116,625),f'Página {index+1} de 3',fontname='segoe',fontsize=19,color=(.75,.72,.74))
document.save(folder/'apresentacao-teste.pdf')
document.close()
encrypted=pymupdf.open()
encrypted.new_page()
encrypted.save(folder/'com-senha-teste.pdf',encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='test-owner',user_pw='test-local')
encrypted.close()
print('PDF de três páginas e PDF com senha criados para ensaio local.')
