/* Cloudflare Pages middleware — generated into functions/_middleware.js by merge/build.js; edit merge/middleware.js + merge/seo.js */
const SC_HOSTS = { en: "https://selfcare-en.com/", cs: "https://selfcare-cz.com/" };
const SC_ORDER = ["en", "cs", "sk", "pl", "ru", "ua", "de"];
function scLangUrl(l){ return l === "en" ? SC_HOSTS.en : l === "cs" ? SC_HOSTS.cs : SC_HOSTS.en + "?lang=" + (l === "ua" ? "uk" : l); }
export async function onRequest(context){
  const res = await context.next();
  try{
    const url = new URL(context.request.url);
    if(!(url.pathname === "/" || url.pathname === "/index.html")) return res;
    if(!(res.headers.get("content-type") || "").includes("text/html")) return res;
    let q = (url.searchParams.get("lang") || "").toLowerCase(); if(q === "cz") q = "cs"; if(q === "uk") q = "ua";
    const hostLang = /(^|\.)selfcare-cz\.com$/.test(url.hostname) ? "cs" : "en";
    const lang = SC_ORDER.indexOf(q) >= 0 ? q : hostLang;
    const m = SC_SEO[lang];
    const esc = v => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const links = '<link rel="canonical" href="' + esc(scLangUrl(lang)) + '">' +
      SC_ORDER.map(l => '<link rel="alternate" hreflang="' + SC_SEO[l].html + '" href="' + esc(scLangUrl(l)) + '">').join("") +
      '<link rel="alternate" hreflang="x-default" href="' + SC_HOSTS.en + '">' +
      '<meta property="og:title" content="' + esc(m.title) + '"><meta property="og:description" content="' + esc(m.desc) + '"><meta property="og:locale" content="' + m.html + '">';
    return new HTMLRewriter()
      .on("html", { element(e){ e.setAttribute("lang", m.html); } })
      .on("head > title", { element(e){ e.setInnerContent(m.title); } })
      .on('meta[name="description"]', { element(e){ e.setAttribute("content", m.desc); } })
      .on("head", { element(e){ e.append(links, { html: true }); } })
      .transform(res);
  }catch(e){ return res; }
}
