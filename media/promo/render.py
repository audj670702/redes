import asyncio, subprocess, os, time
from playwright.async_api import async_playwright
FPS=30
async def main():
  out="SCaD_Redes_Promo_1920x1080.mp4"
  ff=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","image2pipe","-framerate",str(FPS),"-c:v","mjpeg","-i","-",
     "-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-movflags","+faststart",out],stdin=subprocess.PIPE)
  async with async_playwright() as pw:
    b=await pw.chromium.launch(); pg=await b.new_page(viewport={"width":1920,"height":1080})
    await pg.goto("file://"+os.getcwd()+"/promo.html"); await pg.wait_for_timeout(600)
    dur=await pg.evaluate("DUR"); n=int(dur*FPS); t0=time.time()
    for i in range(n):
      await pg.evaluate(f"render({i/FPS})")
      ff.stdin.write(await pg.screenshot(type="jpeg",quality=94))
    await b.close()
  ff.stdin.close(); ff.wait()
  print("frames",n,"seg",round(time.time()-t0,1))
asyncio.run(main())
