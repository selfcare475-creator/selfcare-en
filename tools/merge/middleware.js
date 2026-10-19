/* Cloudflare Pages middleware — generated into functions/_middleware.js by merge/build.js; edit merge/middleware.js + merge/seo.js */
const SC_HOSTS = { en: "https://selfcare-en.com/", cs: "https://selfcare-cz.com/" };
const SC_ORDER = ["en", "cs", "sk", "pl", "ru", "ua", "de"];
function scLangUrl(l){ return l === "en" ? SC_HOSTS.en : l === "cs" ? SC_HOSTS.cs : SC_HOSTS.en + "?lang=" + (l === "ua" ? "uk" : l); }
const SC_SB = "https://lbeuqkerbenrpycuvohl.supabase.co", SC_SB_KEY = "sb_publishable_Lbqjl73U7lqbFNVB5Sj64A_vEe6z5cB";
/* link-preview robots (WhatsApp / Facebook / Telegram / Google…) are not people → never counted as visits */
const SC_BOT = /bot\/|Googlebot|bingbot|Applebot|YandexBot|PetalBot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|WhatsApp\/|TelegramBot|Twitterbot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Pinterest|vkShare|Embedly|preview|HeadlessChrome|Lighthouse|curl\/|wget|python|go-http|okhttp|axios|node-fetch/i;
function scIsBot(req){ const ua = req.headers.get("User-Agent") || ""; return !ua || SC_BOT.test(ua); }
/* one visit per device per promoter per 24h: cookie sc_seen_<code>=<lang> */
function scSeen(req, code){ const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|; )sc_seen_" + code + "=([a-z]{2})")); return m ? m[1] : null; }
function scSeenCookie(code, lang){ return "sc_seen_" + code + "=" + (lang || "en") + "; Path=/; Max-Age=86400; SameSite=Lax; Secure"; }
function scHit(code, host){
  return fetch(SC_SB + "/rest/v1/rpc/promoter_hit", { method: "POST",
    headers: { apikey: SC_SB_KEY, Authorization: "Bearer " + SC_SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: Number(code), p_host: host }) }).then(r => r.ok ? r.json() : null).catch(() => null);
}
/* promoter short link: /<code> -> log the visit (once a day per device, never robots), remember the code (30 days), open the site in the promoter's language */
async function scPromoter(context, url, code){
  try{
    const req = context.request;
    if(scIsBot(req)) return new Response(null, { status: 302, headers: { Location: "/", "Cache-Control": "no-store" } });
    let lang = scSeen(req, code);
    if(!lang) lang = await scHit(code, url.hostname);
    if(lang){
      const dest = new URL("/", url);
      if(lang !== "en" && lang !== "ar") dest.searchParams.set("lang", lang);
      dest.searchParams.set("p", code); /* "p" = came from /<code> (visit already handled); "ref" = outside link, handled below */
      const h = new Headers({ Location: dest.pathname + dest.search, /* relative: the sc-router worker proxies selfcare-en.com to pages.dev */ "Cache-Control": "no-store" });
      h.append("Set-Cookie", "sc_ref=" + code + "." + Date.now() + "; Path=/; Max-Age=2592000; SameSite=Lax; Secure");
      /* only ONE Set-Cookie here: the sc-router worker in front keeps just one; sc_seen_<code> is set on the landing page (?p=) */
      return new Response(null, { status: 302, headers: h });
    }
  }catch(e){}
  return null;
}
export async function onRequest(context){
  /* CZ redirect rule appends "?lang=cs" after an existing query (…?fbclid=x?lang=cs) → turn the 2nd "?" into "&" */
  { const u0 = new URL(context.request.url); if(u0.search.indexOf("?", 1) > 0) return new Response(null, { status: 301, headers: { Location: u0.pathname + "?" + u0.search.slice(1).replace(/\?/g, "&") } }); }
  const pm = new URL(context.request.url).pathname.match(/^\/(\d{1,6})\/?$/);
  if(pm){ const pr = await scPromoter(context, new URL(context.request.url), pm[1]); if(pr) return pr; }
  /* landing with ?ref=<code> (e.g. the Czech domain redirect → ref=72): count the visit once a day per device, never robots */
  let seenSet = null;
  try{
    const u1 = new URL(context.request.url), rf = u1.searchParams.get("ref");
    if(rf && /^\d{1,6}$/.test(rf) && (u1.pathname === "/" || u1.pathname === "/index.html") && !scIsBot(context.request) && !scSeen(context.request, rf)){
      context.waitUntil(scHit(rf, "via-ref"));
      seenSet = scSeenCookie(rf, (u1.searchParams.get("lang") || "en").toLowerCase().slice(0, 2));
    }
    const pp = u1.searchParams.get("p");
    if(!seenSet && pp && /^\d{1,6}$/.test(pp) && !scSeen(context.request, pp)) seenSet = scSeenCookie(pp, (u1.searchParams.get("lang") || "en").toLowerCase().slice(0, 2));
  }catch(e){}
  const out = await scMain(context);
  if(!seenSet) return out;
  try{ const r2 = new Response(out.body, out); r2.headers.append("Set-Cookie", seenSet); return r2; }catch(e){ return out; }
}
async function scMain(context){
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
