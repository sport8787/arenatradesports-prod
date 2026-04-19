import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const versions = ["a", "b", "c"];
const formats = ["square", "vertical", "horizontal"];

console.log("Bundling...");
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

for (const v of versions) {
  for (const f of formats) {
    const id = `${v}-${f}`;
    const out = `/mnt/documents/arena-punter-v${v.toUpperCase()}-${f}.mp4`;
    console.log(`Rendering ${id} -> ${out}`);
    const composition = await selectComposition({ serveUrl: bundled, id, puppeteerInstance: browser });
    await renderMedia({
      composition, serveUrl: bundled, codec: "h264",
      outputLocation: out, puppeteerInstance: browser,
      muted: true, concurrency: 1,
    });
  }
}

await browser.close({ silent: false });
console.log("DONE");
