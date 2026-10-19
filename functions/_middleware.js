/* page title + Google description per language (used by functions/_middleware.js on the server and by core.js in the browser) */
const SC_SEO = {
  en: { html: "en", title: "Self Care Pharmacy Hurghada – Medicines & Essentials Delivered to Your Hotel",
        desc: "Self Care Pharmacy Hurghada – fast medicine, beauty, tourist kits and essentials ordering through WhatsApp, delivered to your hotel." },
  cs: { html: "cs", title: "Self Care Pharmacy Hurghada – léky a potřeby s doručením do hotelu",
        desc: "Self Care Pharmacy Hurghada – rychlé objednání léků, kosmetiky, cestovních balíčků a turistických potřeb přes WhatsApp, s doručením do hotelu." },
  sk: { html: "sk", title: "Self Care Pharmacy Hurghada – lieky a potreby s doručením do hotela",
        desc: "Self Care Pharmacy Hurghada – rýchle objednanie liekov, kozmetiky, cestovných balíčkov a turistických potrieb cez WhatsApp, s doručením do hotela." },
  pl: { html: "pl", title: "Self Care Pharmacy Hurghada – leki i artykuły z dostawą do hotelu",
        desc: "Self Care Pharmacy Hurghada – szybkie zamawianie leków, kosmetyków, zestawów podróżnych i artykułów dla turystów przez WhatsApp, z dostawą do hotelu." },
  ru: { html: "ru", title: "Self Care Pharmacy Хургада – лекарства и всё нужное с доставкой в отель",
        desc: "Self Care Pharmacy Хургада – быстрый заказ лекарств, косметики, наборов для путешественников и товаров для туристов через WhatsApp с доставкой в отель." },
  ua: { html: "uk", title: "Self Care Pharmacy Хургада – ліки та все потрібне з доставкою в готель",
        desc: "Self Care Pharmacy Хургада – швидке замовлення ліків, косметики, наборів для подорожей і товарів для туристів через WhatsApp з доставкою в готель." },
  de: { html: "de", title: "Self Care Pharmacy Hurghada – Medikamente & mehr mit Lieferung ins Hotel",
        desc: "Self Care Pharmacy Hurghada – schnell Medikamente, Kosmetik, Reise-Sets und Urlaubsbedarf per WhatsApp bestellen, mit Lieferung ins Hotel." }
};

/* Cloudflare Pages middleware — generated into functions/_middleware.js by merge/build.js; edit merge/middleware.js + merge/seo.js */
const SC_HOSTS = { en: "https://selfcare-en.com/", cs: "https://selfcare-cz.com/" };
const SC_ORDER = ["en", "cs", "sk", "pl", "ru", "ua", "de"];
function scLangUrl(l){ return l === "en" ? SC_HOSTS.en : l === "cs" ? SC_HOSTS.cs : SC_HOSTS.en + "?lang=" + (l === "ua" ? "uk" : l); }
const SC_SB = "https://lbeuqkerbenrpycuvohl.supabase.co", SC_SB_KEY = "sb_publishable_Lbqjl73U7lqbFNVB5Sj64A_vEe6z5cB";
/* promoter short link: /<code> -> log the visit, remember the code (30 days), open the site in the promoter's language */
async function scPromoter(context, url, code){
  try{
    const r = await fetch(SC_SB + "/rest/v1/rpc/promoter_hit", { method: "POST",
      headers: { apikey: SC_SB_KEY, Authorization: "Bearer " + SC_SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: Number(code), p_host: url.hostname }) });
    const lang = r.ok ? await r.json() : null;
    if(lang){
      const dest = new URL("/", url);
      if(lang !== "en" && lang !== "ar") dest.searchParams.set("lang", lang);
      dest.searchParams.set("ref", code);
      return new Response(null, { status: 302, headers: { Location: dest.pathname + dest.search, /* relative: the sc-router worker proxies selfcare-en.com to pages.dev */ "Cache-Control": "no-store",
        "Set-Cookie": "sc_ref=" + code + "." + Date.now() + "; Path=/; Max-Age=2592000; SameSite=Lax; Secure" } });
    }
  }catch(e){}
  return null;
}
export async function onRequest(context){
  /* CZ redirect rule appends "?lang=cs" after an existing query (…?fbclid=x?lang=cs) → turn the 2nd "?" into "&" */
  { const u0 = new URL(context.request.url); if(u0.search.indexOf("?", 1) > 0) return new Response(null, { status: 301, headers: { Location: u0.pathname + "?" + u0.search.slice(1).replace(/\?/g, "&") } }); }
  const pm = new URL(context.request.url).pathname.match(/^\/(\d{1,6})\/?$/);
  if(pm){ const pr = await scPromoter(context, new URL(context.request.url), pm[1]); if(pr) return pr; }
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
