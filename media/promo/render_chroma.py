# Render de la superposición chroma (PNG sin pérdidas → H.264 alta calidad)
import asyncio, subprocess, os, sys
from playwright.async_api import async_playwright
FPS=30
async def main():
  out=sys.argv[1] if len(sys.argv)>1 else "../SCaD_Redes_Chroma_PruebaloSinCosto_1920x1080.mp4"
  ff=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","image2pipe","-framerate",str(FPS),"-c:v","png","-i","-",
     "-c:v","libx264","-preset","slow","-crf","12","-pix_fmt","yuv420p","-movflags","+faststart",out],stdin=subprocess.PIPE)
  async with async_playwright() as pw:
    b=await pw.chromium.launch(); pg=await b.new_page(viewport={"width":1920,"height":1080})
    await pg.goto("file://"+os.getcwd()+"/chroma_prueba.html"); await pg.wait_for_timeout(500)
    n=int(await pg.evaluate("DUR")*FPS)
    for i in range(n):
      await pg.evaluate(f"render({i/FPS})"); ff.stdin.write(await pg.screenshot(type="png"))
    await b.close()
  ff.stdin.close(); ff.wait(); print("frames",n)
asyncio.run(main())
