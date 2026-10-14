// Gera app/webapp.js a partir do index.html da raiz do repositório.
// O app Android abre esta página dentro de um WebView, sem internet:
// as bibliotecas do PDF vão embutidas no próprio HTML.
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "..");
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");

const embutir = (src) => {
  const codigo = fs.readFileSync(path.join(raiz, src), "utf8").replace(/<\/script/gi, "<\\/script");
  const tag = `<script src="${src}"></script>`;
  if (!html.includes(tag)) throw new Error("Não achei " + tag + " no index.html");
  html = html.replace(tag, () => `<script>${codigo}</script>`);
};
embutir("vendor/jspdf.umd.min.js");
embutir("vendor/jspdf.plugin.autotable.min.js");

// itens que só fazem sentido no site (PWA)
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, "")
  .replace(/<link rel="icon"[^>]*>\n?/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, "");

const saida = path.join(__dirname, "..", "webapp.js");
fs.writeFileSync(saida, "// Arquivo gerado por scripts/build-web.js — não edite à mão.\nexport default " + JSON.stringify(html) + ";\n");
console.log("webapp.js gerado:", Math.round(fs.statSync(saida).size / 1024), "KB");
