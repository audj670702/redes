# Capturas del panel (HTML v20) con datos ficticios para la APP · formato celular
import asyncio, datetime as dt
from playwright.async_api import async_playwright
P = "file:///home/claude/redes/HTML/RED_HTML_htmlPanel_v20.html"
OUT = "/home/claude/redes/media/app/"
hoy = dt.date(2026, 10, 12)
def f(d, h): x = hoy + dt.timedelta(days=d); return f"{x.isoformat()}T{h}:00-06:00"
M = [
 {"_id":"m1","nombre":"La Ceiba Café","color":"#A86200","descripcion":"Cafetería · Centro","redesActivas":["facebook","instagram","tiktok"],
  "cuentas":{"facebook":{"url":"https://facebook.com/"},"instagram":{"url":"https://instagram.com/"},"tiktok":{"url":"https://tiktok.com/"}},"activo":True,"orden":1},
 {"_id":"m2","nombre":"Ceiba Tostadores","color":"#1F46C4","descripcion":"Café de especialidad","redesActivas":["instagram","youtube","facebook"],
  "cuentas":{"instagram":{"url":"https://instagram.com/"},"youtube":{"url":"https://youtube.com/"},"facebook":{"url":"https://facebook.com/"}},"activo":True,"orden":2},
 {"_id":"m3","nombre":"Ruta del Grano","color":"#16794A","descripcion":"Podcast semanal","redesActivas":["youtube","tiktok","x"],
  "cuentas":{"youtube":{"url":"https://youtube.com/"},"tiktok":{"url":"https://tiktok.com/"}},"activo":True,"orden":3},
]
def pub(i, t, c, r, e, d, h, fm="Post", resp="Mariana", serie="", url=""):
    o = {"_id":f"p{i}","titulo":t,"canal":c,"redes":r,"estado":e,"fechaProgramada":f(d,h) if d is not None else None,
         "formato":fm,"responsable":resp,"serie":serie,"texto":"Texto de la publicación.","urlPublicada":url}
    if e == "publicado": o["fechaPublicada"] = f(d, h)
    return o
PUBS = [
 pub(1,"Menú de temporada","m1",["facebook","instagram"],"publicado",-3,"09:00",url="https://facebook.com/"),
 pub(2,"Detrás de la barra","m1",["tiktok"],"publicado",-1,"18:00","Reel / Short",url="https://tiktok.com/"),
 pub(3,"Promo 2x1 martes","m1",["facebook","instagram"],"programado",1,"08:30","Promo","Ricardo","s1"),
 pub(4,"Promo 2x1 martes","m1",["facebook","instagram"],"programado",8,"08:30","Promo","Ricardo","s1"),
 pub(5,"Promo 2x1 martes","m1",["facebook","instagram"],"programado",15,"08:30","Promo","Ricardo","s1"),
 pub(6,"Promo 2x1 martes","m1",["facebook","instagram"],"programado",22,"08:30","Promo","Ricardo","s1"),
 pub(7,"Origen: Chiapas","m2",["instagram","youtube"],"revision",2,"12:00","Video"),
 pub(8,"Cata en vivo","m2",["youtube","facebook"],"programado",4,"19:00","En vivo","Laura"),
 pub(9,"Nuevo lote de temporada","m2",["instagram"],"borrador",5,"10:00","Carrusel"),
 pub(10,"Episodio 24","m3",["youtube"],"programado",3,"20:00","Video","Laura"),
 pub(11,"Clip: el tueste","m3",["tiktok"],"idea",None,"","Clip de programa"),
 pub(12,"Guía de métodos","m2",["instagram"],"idea",None,"","Carrusel","Ricardo"),
 pub(13,"Episodio 23","m3",["youtube"],"publicado",-4,"20:00","Video","Laura",url="https://youtube.com/"),
 pub(14,"Fin de semana","m1",["instagram"],"programado",-2,"10:00","Historia"),
 pub(15,"Taller de barismo","m2",["facebook"],"programado",9,"17:00","Post","Mariana"),
 pub(16,"Episodio 25","m3",["youtube"],"borrador",10,"20:00","Video","Laura"),
 pub(17,"Café del día","m1",["instagram","facebook"],"programado",0,"13:00","Post","Mariana"),
 pub(18,"Avance episodio 24","m3",["tiktok"],"programado",0,"18:30","Clip de programa","Laura"),
]
EO = {"_id":"eoX","codigo":"EO900-REDES-CEIBA","nombre":"Café La Ceiba","logo":"","rol":"TITULAR","estado":"ok"}
CTX = {"type":"context","estado":"ok","eos":[EO],"activa":EO,"usuario":{"nombre":"Laura Méndez","rol":"TITULAR"},"email":"laura@ejemplo.mx",
       "titular":True,"permisos":{k:True for k in ["editar","estado","eliminar","marcas","exportar"]},"marcasPermitidas":None,"limiteMarcas":3}
USRS = {"urlInvitacion":"https://www.scad.mx/gestion-redes","precioColaborador":"$39 MXN / mes","usuarios":[
 {"usrId":"u1","nombre":"Mariana Torres","email":"mariana@ejemplo.mx","activo":True,"vinculado":True,"plan":True,"permisos":{"editar":True,"estado":True,"eliminar":False,"marcas":False,"exportar":True},"marcas":["m1","m2"]},
 {"usrId":"u2","nombre":"Ricardo Hernández","email":"ricardo@ejemplo.mx","activo":True,"vinculado":True,"plan":True,"permisos":{"editar":True,"estado":False,"eliminar":False,"marcas":False,"exportar":False},"marcas":["m1"]},
 {"usrId":"u3","nombre":"Sofía Ramírez","email":"sofia@ejemplo.mx","activo":True,"vinculado":False,"plan":False,"permisos":{"editar":True,"estado":True},"marcas":[]}]}

async def main():
  async with async_playwright() as pw:
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={"width":400,"height":820}, device_scale_factor=2, timezone_id="America/Mexico_City", locale="es-MX")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.clock.set_fixed_time(dt.datetime(2026,10,12,11,0))
    await pg.add_init_script("""window.__out=[];window.addEventListener('message',e=>{const d=e.data;if(d&&d.type==='usrList'){window.postMessage({type:'result',reqId:d.reqId,ok:true,item:%s,error:null},'*')}});""" % __import__('json').dumps(USRS))
    await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    await pg.goto(P); await pg.wait_for_timeout(300)
    post = lambda m: pg.evaluate("m=>window.postMessage(m,'*')", m)
    await post(CTX); await post({"type":"data","eo":"eoX","marcas":M,"publicaciones":PUBS}); await pg.wait_for_timeout(300)
    async def shot(name, sel=None):
      await pg.wait_for_timeout(250)
      if sel:
        y = await pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top + scrollY - 8")
        await pg.screenshot(path=OUT+name+".png", full_page=True, clip={"x":0,"y":y,"width":400,"height":820})
      else: await pg.screenshot(path=OUT+name+".png")
      print("ok", name)
    async def tab(k):
      await pg.click(f'[data-tab="{k}"]'); await pg.wait_for_timeout(250)
    await tab("calendario"); await shot("calendario", ".tabs")
    await tab("marcas"); await shot("marcas", ".tabs")
    await tab("tablero"); await shot("estados", ".tabs")
    await tab("usuarios"); await shot("colaboradores", ".tabs")
    await tab("listado")
    await pg.click('#expBtn'); await shot("pdf"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.locator('[data-edit="p3"]').first.click(); await pg.wait_for_timeout(250)
    await pg.click("details.fechas > summary"); await pg.wait_for_timeout(250)
    await pg.evaluate("document.querySelector('details.fechas').scrollIntoView({block:'start'})")
    await shot("series")
    print("errores:", errs); await b.close()
asyncio.run(main())
