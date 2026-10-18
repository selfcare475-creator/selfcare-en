/* full Polish names where the Czech-site Polish name was still half Czech */
var SC_PL_FULL = {
"OFF repelentní spray":"OFF spray odstraszający owady",
"Coldatrexy na nachlazení 30 tabletek":"Coldatrex na przeziębienie 30 tabletek",
"Vacation opalovací spray SPF 50":"Vacation spray do opalania SPF 50",
"Eva denní gel s kwasem hialuronowym":"Eva żel na dzień z kwasem hialuronowym",
"Eva plátýnková maska s uhlím 3 ks":"Eva maska w płachcie z węglem 3 szt.",
"Eva plátýnková maska s witaminą C 3 ks":"Eva maska w płachcie z witaminą C 3 szt.",
"Eva kolagenová plátýnková maska 3 ks":"Eva kolagenowa maska w płachcie 3 szt.",
"Eva White Pearl plátýnková maska 3 ks":"Eva White Pearl maska w płachcie 3 szt.",
"Bobana uhlíková maska":"Bobana maska z węglem",
"Bobana plátýnková maska s kwasem hialuronowym":"Bobana maska w płachcie z kwasem hialuronowym",
"Orgakera kolagenová maska s uhlím":"Orgakera kolagenowa maska z węglem",
"Vatika szampon Česnek – Natural Growth 200 ml":"Vatika szampon Czosnek – Natural Growth 200 ml",
"Vatika szampon Rozmarýn & Ibišek – Hair Growth 200 ml":"Vatika szampon Rozmaryn i Hibiskus – Hair Growth 200 ml",
"Momento opalovací spray dla dorosłych":"Momento spray do opalania dla dorosłych",
"Bobana marocké mýdlo Oliva":"Bobana marokańskie mydło Oliwka",
"Bobana marocké mýdlo Argan":"Bobana marokańskie mydło Argan",
"Capixy intenzivní tonikový spray":"Capixy intensywny tonik w sprayu",
"Infinity retinolový do oczu krem":"Infinity krem pod oczy z retinolem",
"Infinity retinolový krem na obličej":"Infinity krem do twarzy z retinolem",
"Capixy hydratační odżywka":"Capixy odżywka nawilżająca",
"Eva Vitamin C denní krem":"Eva krem na dzień z witaminą C",
"Eva Niacinamide sérum na obličej":"Eva serum do twarzy z niacynamidem",
"Eva Vitamin A sérum na obličej":"Eva serum do twarzy z witaminą A",
"Sea Shell opalovací krem SPF 40":"Sea Shell krem do opalania SPF 40",
"Lotus kolagenowe ampułki Káva & Zelený čaj":"Lotus kolagenowe ampułki Kawa i Zielona herbata",
"Lotus masážní Joint krem czarnuszka":"Lotus krem do masażu stawów z czarnuszką",
"Lotus vlasové ampułki Hadí olej":"Lotus ampułki do włosów z olejem z węża",
"Lotus vlasové ampułki Rozmarýn":"Lotus ampułki do włosów z rozmarynem",
"Lotus kolagenowe ampułki na obličej s aloe vera":"Lotus kolagenowe ampułki do twarzy z aloesem",
"Shaan zklidňující gel 120 g":"Shaan żel łagodzący 120 g",
"Egy Bio Hadí olej":"Egy Bio olej z węża",
"Blaji opalovací spray SPF 50":"Blaji spray do opalania SPF 50",
"Capixy vlasový olej Elixir":"Capixy olejek do włosów Elixir",
"Infinity retinolové sérum na obličej":"Infinity serum do twarzy z retinolem",
"Botox pleťový krem 24K Black":"Botox krem do twarzy 24K Black",
"Botox pleťový krem Silver":"Botox krem do twarzy Silver",
"Calypso opalovací krem SPF 50":"Calypso krem do opalania SPF 50",
"Calypso opalovací krem SPF 45":"Calypso krem do opalania SPF 45",
"Calypso opalovací krem SPF 40":"Calypso krem do opalania SPF 40",
"Calypso opalovací krem SPF 30":"Calypso krem do opalania SPF 30",
"Nivea opalovací spray SPF 30":"Nivea spray do opalania SPF 30",
"Luna gel na opalování":"Luna żel do opalania",
"Bobana zlatý peeling":"Bobana złoty peeling",
"Bobana bahenní maska":"Bobana maska błotna",
"Bobana peeling s uhlím":"Bobana peeling z węglem",
"Lipozomální zinek 30 tabletek":"Liposomalny cynk 30 tabletek",
"Perfect aktivní uhlí 60 tabletek":"Perfect węgiel aktywny 60 tabletek",
"Syrovátkový protein prášek":"Białko serwatkowe w proszku"
};
/* ===== Self Care — one site, all languages (EN base + Czech-site languages) =====
   Language: ?lang=xx → saved choice → domain (selfcare-cz.com = Czech, otherwise English).
   Currency: saved choice → language default (English = £, others = €). */
var SC_LANGS = ["en","cs","sk","pl","ru","ua","de"];
var SC_LANG_BTN = {en:"EN",cs:"CZ",sk:"SK",pl:"PL",ru:"RU",ua:"UA",de:"DE"};
var SC_HTML_LANG = {en:"en",cs:"cs",sk:"sk",pl:"pl",ru:"ru",ua:"uk",de:"de"};
function scHostLang(){
  var h = String(window.__SC_TEST_HOST || location.hostname || "").toLowerCase();
  return /(^|\.)selfcare-cz\.com$/.test(h) ? "cs" : "en";
}
/* the phone's own language, when it is one of ours (Arabic is never picked automatically) */
function scPhoneLang(){
  try{
    var map = {en:"en", cs:"cs", sk:"sk", pl:"pl", ru:"ru", uk:"ua", de:"de"};
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for(var i = 0; i < list.length; i++){ var b = String(list[i] || "").toLowerCase().split("-")[0]; if(map[b]) return map[b]; }
  }catch(e){}
  return null;
}
var displayLanguage = (function(){
  try{
    var q = (location.search.match(/[?&]lang=([a-z]{2})/i) || [])[1];
    if(q){ q = q.toLowerCase(); if(q === "cz") q = "cs"; if(q === "uk") q = "ua"; }
    if(q && SC_LANGS.indexOf(q) >= 0){ try{ localStorage.setItem("sc_lang", q); }catch(e){} return q; }
    var s = null; try{ s = localStorage.getItem("sc_lang"); }catch(e){}
    if(s && SC_LANGS.indexOf(s) >= 0) return s;
    var p = scPhoneLang(); if(p) return p;
  }catch(e){}
  return scHostLang();
})();
var displayCurrency = (function(){
  var s = null; try{ s = localStorage.getItem("sc_cur"); }catch(e){}
  if(["GBP","EUR","USD","CZK"].indexOf(s) >= 0) return s;
  return displayLanguage === "en" ? "GBP" : "EUR";
})();
try{ document.documentElement.lang = SC_HTML_LANG[displayLanguage] || "en"; }catch(e){}

function T(key, vars){
  var row = SC_TX[key];
  var s = row ? (row[displayLanguage] != null ? row[displayLanguage] : row.en) : key;
  if(vars) for(var k in vars) s = String(s).split("{" + k + "}").join(vars[k]);
  return s;
}
/* order code per language: English 61, Slovak 51, every other language 72 (as on the Czech site) */
function scSiteCode(){ return displayLanguage === "en" ? 61 : (displayLanguage === "sk" ? 51 : 72); }
/* a pick() helper for {lang:text} packs */
function scPick(pack){ return (pack && (pack[displayLanguage] != null ? pack[displayLanguage] : (pack.en != null ? pack.en : pack.cs))) || ""; }

/* ---- prices: EGP + approximate amount in the chosen currency ---- */
var SC_CZK_PER_EGP = 0.43017994;
function scFmtDec(v){ return Number(v).toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1"); }
function approxText(egp){
  egp = Number(egp) || 0;
  if(displayCurrency === "EUR") return "≈ " + scFmtDec(egp / (typeof EUR_RATE_EN !== "undefined" ? EUR_RATE_EN : 55)) + " €";
  if(displayCurrency === "USD") return "≈ " + scFmtDec(egp / (typeof USD_RATE_EN !== "undefined" ? USD_RATE_EN : 45)) + " $";
  if(displayCurrency === "CZK") return "≈ " + Math.round(egp * SC_CZK_PER_EGP) + " Kč";
  return "≈ £" + Math.ceil(egp / (typeof GBP_RATE !== "undefined" ? GBP_RATE : 65));
}

/* ---- product names / texts in the chosen language ---- */
/* Czech words left in Polish / Slovak names */
var SC_PL_FIX = [["opalovací spray pro děti","spray do opalania dla dzieci"],["dětský opalovací krem","krem do opalania dla dzieci"],["pleťový krem s mořským kolagenem","krem do twarzy z kolagenem morskim"],["ampułki s mořským kolagenem","ampułki z kolagenem morskim"],["bělící pleťový krem","wybielający krem do twarzy"],["bělicí pasta","wybielająca pasta"],["tělové mléko","mleczko do ciała"],["sérum na řasy","serum do rzęs"],["tekutý doplněk","suplement w płynie"],["pěna","pianka"]];
var SC_SK_FIX = [["mléko pro dospělé","mlieko pre dospelých"],["pro dospělé","pre dospelých"],["pro děti","pre deti"],["sérum na řasy","sérum na mihalnice"],["proti vypadávání vlasů","proti vypadávaniu vlasov"],["proti lupům","proti lupinám"],["krém s mořským kolagenem","krém s morským kolagénom"],["krém na obličej","krém na tvár"],["ampule s mořským kolagenem","ampulky s morským kolagénom"],["bělicí","bieliaca"],["bělící","bieliaci"],["tekutý doplněk","tekutý doplnok"],["pěna","pena"]];
function scFixCz(n, list){ n = String(n||""); for(var i = 0; i < list.length; i++){ n = n.split(list[i][0]).join(list[i][1]); } return n; }
function pName(p){
  if(!p) return "";
  var l = displayLanguage;
  if(l === "en") return p.name || "";
  try{ var o = SC_NAME_I18N[String(p.code || p.pharmacy_code || "").trim()]; if(o && o[l]) return o[l]; }catch(e){}
  var cz = String(p.name_cz || "").trim() || p.name || "";
  try{
    if(l === "cs") return cz;
    if(l === "sk") return scFixCz(productNameSk(cz).replace(/perorální/gi, "perorálna").replace(/injekční pero/gi, "injekčné pero"), SC_SK_FIX);
    if(l === "pl"){ var __pl = scFixCz(productNamePl(cz).replace(/injekční pero/gi, "wstrzykiwacz").replace(/perorální/gi, "doustna"), SC_PL_FIX); return SC_PL_FULL[__pl] || __pl; }
    if(l === "ru") return productNameRu(p.name || cz);
    if(l === "ua") return productNameUa(p.name || cz);
    if(l === "de") return productNameDe(p.name || cz);
  }catch(e){}
  return p.name || "";
}
function pDesc(p){
  if(!p) return "";
  var l = displayLanguage;
  if(l === "en") return p.desc || "";
  if(!p.desc_cz) return productUseFor(p);
  if(l === "cs") return p.desc_cz;
  var shim = {name: p.name_cz || p.name, desc: p.desc_cz, cat: p.cat_cz || p.cat, subcategory: p.subcategory};
  try{
    if(l === "sk") return productDescSk(shim);
    if(l === "pl") return productDescPl(shim);
    if(l === "ru") return productDescRu(shim);
    if(l === "ua") return productDescUa(shim);
    if(l === "de") return productDescDe(shim);
  }catch(e){}
  return productUseFor(p);
}
/* category labels: English key → label in the chosen language */
function catLabel(sub){
  if(displayLanguage === "en") return sub;
  var t = SC_TX["sub:" + sub]; if(t && t[displayLanguage]) return t[displayLanguage];
  var c = SC_CAT_I18N[sub]; if(c && c[displayLanguage]) return c[displayLanguage];
  return sub;
}
function mainLabel(key, enLabel){
  if(displayLanguage === "en") return enLabel;
  if(key === "top" && (displayLanguage === "pl" || displayLanguage === "sk")) return "Bestsellery";
  var c = SC_MAIN_I18N[key]; if(c && c[displayLanguage]) return c[displayLanguage];
  return enLabel;
}

/* ---- switching ---- */
function scSetText(id, v){ var el = document.getElementById(id); if(el) el.textContent = v; }
function scSetHtml(id, v){ var el = document.getElementById(id); if(el) el.innerHTML = v; }
function scSetAttr(id, a, v){ var el = document.getElementById(id); if(el) el.setAttribute(a, v); }
var SC_PHONE_BY_LANG = {en:"44",cs:"420",sk:"421",pl:"48",ru:"7",ua:"380",de:"49"};
function scApplySeo(){
  try{
    var m = (typeof SC_SEO !== "undefined") && (SC_SEO[displayLanguage] || SC_SEO.en); if(!m) return;
    document.title = m.title;
    var d = document.querySelector('meta[name="description"]'); if(d) d.setAttribute("content", m.desc);
  }catch(e){}
}
function scApplyStaticTexts(){
  scApplySeo();
  document.documentElement.lang = SC_HTML_LANG[displayLanguage] || "en";
  scSetText("prefLangLabel", T("language")); scSetText("prefCurLabel", T("currency")); scSetText("scPrefsDone", T("done"));
  scSetText("cartBtnText", T("basket"));
  scSetAttr("searchInput", "placeholder", T("search"));
  scSetText("howTitle", T("howTitle"));
  ["how1","how2","how3","how4"].forEach(function(k, i){ scSetText("howStep" + (i+1), T(k)); });
  scSetText("modalPriceLabel", T("unitPrice")); scSetText("modalQtyLabel", T("quantity"));
  scSetText("cartTitle", T("cartTitle")); scSetText("cartCheckoutBtn", T("checkoutBtn")); scSetText("cartClearBtn", T("clearCart"));
  scSetText("stickyCartAction", T("viewBasket")); scSetText("toast", T("toastAdded"));
  scSetText("checkoutTitle", T("orderDetails")); scSetText("checkoutHotelLabel", T("hotelLabel"));
  scSetAttr("checkoutHotel", "placeholder", T("selectHotel"));
  scSetText("deliveryDayLabel", T("deliveryLabel")); scSetText("dayTodayOption", T("today")); scSetText("dayTomorrowOption", T("tomorrow"));
  scSetText("deliveryTimeLabel", T("timeLabel")); scSetText("paymentLabel", T("payLabel")); scSetText("cashLabel", T("cash"));
  scSetText("paymentNote", T("visaNote")); scSetText("checkoutPhoneLabel", T("phoneLabel"));
  scSetAttr("checkoutPhone", "placeholder", T("phonePh")); scSetText("phoneManualOption", T("phoneOther"));
  scSetText("checkoutPhoneHelp", T("phoneHelp")); scSetText("checkoutNoteLabel", T("noteLabel"));
  scSetAttr("checkoutNote", "placeholder", T("notePh")); scSetText("checkoutConfirmHelp", T("confirmHelp"));
  var fb = document.getElementById("finalCheckoutBtn"); if(fb && !fb.dataset.submitting && !fb.href) fb.textContent = fb.dataset.scNeed ? T(fb.dataset.scNeed) : T("confirmBtn"); scSetText("scCoWhenEdit", T("coChange")); scSetText("cardLabel", T("cardDelivery")); scSetText("scNavHomeL", T("navHome")); scSetText("scNavSearchL", T("navSearch")); scSetText("scNavOrdersL", T("myOrdersBtn")); scSetText("scNavHelpL", T("navHelp")); scNavUpdate(); try{ document.documentElement.style.setProperty("--sc-browse", JSON.stringify(T("browseCat"))); document.documentElement.style.setProperty("--sc-swipe", JSON.stringify(T("swipeHint"))); }catch(e){} scSetText("scCoWhenLabel", T("coWhen"));
  scSetText("osTitle", T("osTitle")); scSetText("osSub", T("osSub")); scSetText("osNum", T("osNum"));
  scSetText("sc-order-success-copied", T("osTap")); scSetText("osFinal", T("osFinal")); scSetText("osFinalText", T("osFinalText"));
  scSetText("sc-order-success-wa", T("osSend")); scSetText("osContinue", T("osContinue"));
  scSetText("hwTitle", T("hwTitle")); scSetHtml("hwText", T("hwText")); scSetText("hwOk", T("hwOk"));
  try{ if(typeof scUpdateMyOrdersBtn === "function") scUpdateMyOrdersBtn(); }catch(e){}
  try{ var mt = document.getElementById("myOrdersTitle"); if(mt && typeof scMyOrdersLabel === "function") mt.textContent = "🧾 " + scMyOrdersLabel(); }catch(e){}
  /* phone code follows the language until the customer picks one */
  try{
    var pc = document.getElementById("checkoutPhoneCode");
    if(pc && !pc.dataset.touched){ pc.value = SC_PHONE_BY_LANG[displayLanguage] || "44"; }
  }catch(e){}
  scUpdatePrefButtons();
  scFitHeaderButtons();
}
/* header buttons keep the English width: long words get a slightly smaller font instead of a wider button */
function scFitHeaderButtons(){
  try{
    document.querySelectorAll("header .cart-btn").forEach(function(b){
      b.style.fontSize = ""; var bd = b.querySelector(".cart-badge"), bdD = bd ? bd.style.display : ""; if(bd) bd.style.display = "none";
      var fs = parseFloat(getComputedStyle(b).fontSize) || 13, n = 0;
      while(b.scrollWidth > b.clientWidth + 1 && fs > 10 && n++ < 8){ fs -= 0.5; b.style.fontSize = fs + "px"; }
      if(bd) bd.style.display = bdD;
    });
  }catch(e){}
}
window.addEventListener("resize", function(){ scFitHeaderButtons(); scCatHint(); });
/* categories row: fade + arrow on the side while more categories are hidden; a small nudge the first time */
/* category labels: a long word gets a smaller font instead of being cut in the middle */
function scFitCatNames(){
  try{
    document.querySelectorAll("#filters .main-filter-btn .cat-name").forEach(function(n){
      n.style.removeProperty("font-size"); var fs = parseFloat(getComputedStyle(n).fontSize) || 10, k = 0;
      while(n.scrollWidth > n.clientWidth + 1 && fs > 7 && k++ < 10){ fs -= 0.5; n.style.setProperty("font-size", fs + "px", "important"); }
    });
  }catch(e){}
}
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ scFitCatNames(); }); }catch(e){}
function scCatHint(){
  scFitCatNames();
  var row = document.querySelector("#filters .main-filters"); var box = document.getElementById("filters");
  if(!row || !box) return;
  var more = row.scrollWidth - row.clientWidth - row.scrollLeft > 8, back = row.scrollLeft > 8;
  box.classList.toggle("sc-cat-more", more); box.classList.toggle("sc-cat-back", back);
  if(!row.__scHint){
    row.__scHint = true;
    row.addEventListener("scroll", scCatHint, {passive:true});
    var nudged = false; try{ nudged = sessionStorage.getItem("sc_cat_nudge") === "1"; }catch(e){}
    if(more && !nudged){ try{ sessionStorage.setItem("sc_cat_nudge","1"); }catch(e){}
      setTimeout(function(){ row.scrollTo({left:70, behavior:"smooth"}); setTimeout(function(){ row.scrollTo({left:0, behavior:"smooth"}); }, 650); }, 900); }
  }
}
function scNameCls(n){ n = String(n||""); var w = Math.max.apply(null, n.split(/\s+/).map(function(x){ return x.length; }).concat([0])); return (n.length > 52 || w > 19) ? " sc-n4" : (n.length > 40 || w > 15) ? " sc-n3" : (n.length > 28 || w > 12) ? " sc-n2" : ""; }
function scCatScroll(dir){ var row = document.querySelector("#filters .main-filters"); if(row) row.scrollBy({left: dir * Math.round(row.clientWidth * 0.7), behavior:"smooth"}); }
var SC_CUR_SYM = {GBP:"£",EUR:"€",USD:"$",CZK:"Kč"};
function scOpenPrefs(){ var s = document.getElementById("scPrefsSheet"); if(!s) return; scUpdatePrefButtons(); s.classList.add("show"); s.setAttribute("aria-hidden","false"); }
function scClosePrefs(){ var s = document.getElementById("scPrefsSheet"); if(!s) return; s.classList.remove("show"); s.setAttribute("aria-hidden","true"); }
function scPickArabic(){
  if(window.__SC_AR) return;
  if(displayLanguage !== "en") setDisplayLanguage("en");
  try{ if(typeof window.__scToggleAR === "function") window.__scToggleAR(); }catch(e){}
  scUpdatePrefButtons();
}
document.addEventListener("keydown", function(e){ if(e.key === "Escape") scClosePrefs(); });
function scUpdatePrefButtons(){
  var ar = !!window.__SC_AR;
  var SC_FLAG = {en:"🇬🇧",cs:"🇨🇿",sk:"🇸🇰",pl:"🇵🇱",ru:"🇷🇺",ua:"🇺🇦",de:"🇩🇪"};
  var SC_NAME = {en:"English",cs:"Čeština",sk:"Slovenčina",pl:"Polski",ru:"Русский",ua:"Українська",de:"Deutsch"};
  var chip = document.getElementById("scPrefsChipText");
  var SC_CODE = {en:"EN",cs:"CZ",sk:"SK",pl:"PL",ru:"RU",ua:"UA",de:"DE"};
  if(chip) chip.textContent = (ar ? "🇪🇬 AR" : (SC_FLAG[displayLanguage] + " " + SC_CODE[displayLanguage])) + " · " + (SC_CUR_SYM[displayCurrency] || "£");
  scSetText("scPrefsBarLabel", T("langCur"));
  document.querySelectorAll("[data-sc-ar]").forEach(function(b){ b.classList.toggle("active", ar); b.setAttribute("aria-pressed", ar ? "true" : "false"); });
  document.querySelectorAll("[data-sc-lang]").forEach(function(b){ var on = !ar && b.getAttribute("data-sc-lang") === displayLanguage; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  document.querySelectorAll("[data-sc-cur]").forEach(function(b){ var on = b.getAttribute("data-sc-cur") === displayCurrency; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
}
function scRerenderAll(){
  try{ if(typeof window.__scMobSync === "function") window.__scMobSync(); }catch(e){}
  try{ (window.products || (typeof products !== "undefined" ? products : [])).forEach(function(p){ p._searchText = null; p._searchName = null; p._sortKey = null; }); }catch(e){}
  try{ if(typeof searchDataCache !== "undefined") searchDataCache = { raw: null, data: null }; }catch(e){}
  try{ if(typeof buildFilters === "function") buildFilters(); }catch(e){}
  try{ if(typeof renderGrid === "function") renderGrid(); }catch(e){}
  try{ if(typeof renderCart === "function") renderCart(); }catch(e){}
  try{ if(typeof updateStickyCart === "function") updateStickyCart(); }catch(e){}
  try{ var co = document.getElementById("checkoutOverlay"); if(co && co.classList.contains("active") && typeof renderCheckout === "function"){ updateDeliveryTimeOptions(); renderCheckout(); } }catch(e){}
  try{ var mo = document.getElementById("modalOverlay"); if(mo && mo.classList.contains("open") && typeof openModal === "function" && typeof currentModalIdx !== "undefined" && currentModalIdx != null) openModal(currentModalIdx); }catch(e){}
  try{ var mp = document.getElementById("myOrdersPanel"); if(mp && mp.style.display === "flex" && typeof scOpenMyOrders === "function") scOpenMyOrders(); }catch(e){}
}
function setDisplayLanguage(l, opts){
  if(l === "cz") l = "cs"; if(l === "uk") l = "ua";
  if(SC_LANGS.indexOf(l) < 0) l = "en";
  /* picking a language switches the Arabic overlay off */
  if(!(opts && opts.keepAr) && window.__SC_AR && typeof window.__scToggleAR === "function"){ try{ window.__scToggleAR(); }catch(e){} }
  displayLanguage = l;
  try{ localStorage.setItem("sc_lang", l); }catch(e){}
  /* picking a language always sets its currency: English → £, every other language (Czech included) → € ; the customer can still change it after */
  displayCurrency = l === "en" ? "GBP" : "EUR";
  try{ localStorage.removeItem("sc_cur"); }catch(e){}
  scApplyStaticTexts();
  scRerenderAll();
  try{ if(window.__scTrack) window.__scTrack("lang_change", {lang:l}); }catch(e){}
}
function setDisplayCurrency(c){
  if(["GBP","EUR","USD","CZK"].indexOf(c) < 0) c = "GBP";
  displayCurrency = c;
  try{ localStorage.setItem("sc_cur", c); }catch(e){}
  scUpdatePrefButtons();
  scRerenderAll();
  if(c === "CZK") scShowCzkNote();
}
function scShowCzkNote(){
  var el = document.getElementById("scCzkNote");
  if(!el){
    el = document.createElement("div"); el.id = "scCzkNote"; el.className = "min-order-popup-backdrop";
    el.onclick = function(e){ if(e.target === el) el.classList.remove("show"); };
    el.innerHTML = '<div class="min-order-popup" style="max-width:380px"><div class="min-order-popup-title" id="scCzkTitle"></div><div class="min-order-popup-text" id="scCzkText" style="margin-top:6px"></div><div class="min-order-popup-actions"><button type="button" id="scCzkOk" style="background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff"></button></div></div>';
    document.body.appendChild(el);
    el.querySelector("#scCzkOk").onclick = function(){ el.classList.remove("show"); };
  }
  scSetText("scCzkTitle", "Kč · " + T("czkTitle")); scSetText("scCzkText", T("czkText")); scSetText("scCzkOk", T("czkOk"));
  el.classList.add("show");
}
document.addEventListener("DOMContentLoaded", function(){
  try{ scApplyStaticTexts(); }catch(e){}
  try{ requestAnimationFrame(function(){ document.documentElement.classList.remove("sc-pre"); }); }catch(e){ document.documentElement.classList.remove("sc-pre"); }
  try{ var pc = document.getElementById("checkoutPhoneCode"); if(pc) pc.addEventListener("change", function(){ pc.dataset.touched = "1"; }); }catch(e){}
});

/* checkout: one summary line next to the button, compact delivery time, button says what is missing */
function scCoSum(count, total){
  var el = document.getElementById("scCoSumText"); if(!el) return;
  el.innerHTML = '<span class="sc-co-count">' + count + ' ' + T("pcs") + '</span><span class="sc-co-total"><b>' + total + ' EGP</b> <small>' + approxText(total) + '</small></span>';
  scCoWhen();
}
function scCoWhen(){
  try{
    var d = document.getElementById("deliveryDay"), t = document.getElementById("deliveryTime"), out = document.getElementById("scCoWhenText");
    if(!d || !t || !out) return;
    var dt = d.selectedOptions && d.selectedOptions[0] ? d.selectedOptions[0].textContent.trim() : d.value;
    var tt = t.selectedOptions && t.selectedOptions[0] ? t.selectedOptions[0].textContent.trim() : t.value;
    out.textContent = dt + " · " + tt;
  }catch(e){}
}
function scToggleWhen(){ var g = document.querySelector("#checkoutOverlay .checkout-date-time-grid"); var w = document.getElementById("scCoWhen"); if(!g) return; var open = g.classList.toggle("sc-open"); if(w) w.classList.toggle("sc-open", open); }
function scToggleCoDetails(){ var b = document.getElementById("checkoutTotalBox"), s = document.getElementById("scCoSum"); if(!b) return; var open = b.classList.toggle("sc-open"); if(s) s.classList.toggle("sc-open", open); }
function scCoBtn(btn, need){
  if(!btn || btn.dataset.submitting) return;
  if(need){ btn.dataset.scNeed = need; btn.classList.add("sc-co-wait"); btn.style.opacity = ""; btn.textContent = T(need); }
  else { delete btn.dataset.scNeed; btn.classList.remove("sc-co-wait"); btn.textContent = T("confirmBtn"); }
}
function scCoFocusMissing(){
  var b = document.getElementById("finalCheckoutBtn"); if(!b || !b.dataset.scNeed) return;
  var el = document.getElementById(b.dataset.scNeed === "needHotel" ? "checkoutHotel" : "checkoutPhone");
  if(el){ el.classList.add("sc-co-miss"); el.scrollIntoView({block:"center", behavior:"smooth"}); setTimeout(function(){ try{ el.focus({preventScroll:true}); }catch(e){ el.focus(); } }, 250); setTimeout(function(){ el.classList.remove("sc-co-miss"); }, 1600); }
}

/* card texts that stayed English in every language */
var SC_USE_FIX = {
 "Sunscreen SPF 50":{cs:"Opalovací krém SPF 50",sk:"Opaľovací krém SPF 50",pl:"Krem z filtrem SPF 50",ru:"Солнцезащитный SPF 50",ua:"Сонцезахисний SPF 50",de:"Sonnenschutz LSF 50"},
 "Sunscreen SPF 30-45":{cs:"Opalovací krém SPF 30–45",sk:"Opaľovací krém SPF 30–45",pl:"Krem z filtrem SPF 30–45",ru:"Солнцезащитный SPF 30–45",ua:"Сонцезахисний SPF 30–45",de:"Sonnenschutz LSF 30–45"}
};
function scUseFix(t){ try{ var f = SC_USE_FIX[String(t||"").trim()]; if(f && f[displayLanguage]) return f[displayLanguage]; }catch(e){} return t; }

/* bottom bar: basket count + total */
function scNavUpdate(){
  try{
    var n = 0, sum = 0;
    for(var k in cart){ var q = parseInt(cart[k]) || 0; if(q > 0 && products[k]){ n += q; sum += (Number(livePrice(products[k])) || 0) * q; } }
    var b = document.getElementById("scNavBadge"), l = document.getElementById("scNavCartL");
    if(b){ b.textContent = n; b.classList.toggle("show", n > 0); }
    if(l){ l.textContent = n > 0 ? String(approxText(sum)).replace(/^≈\s*/, "") : T("basket"); }
  }catch(e){}
}
function scNavSearch(){ var i = document.getElementById("searchInput"); if(!i) return; try{ i.scrollIntoView({block: "center", behavior: "smooth"}); }catch(e){} setTimeout(function(){ try{ i.focus({preventScroll: true}); }catch(e){ i.focus(); } }, 250); }
function scNavHome(){ try{ window.scrollTo({top: 0, behavior: "smooth"}); }catch(e){ window.scrollTo(0, 0); } }

/* product names: fit each name in its fixed 2-line box — smaller font (and 3 short lines) only when needed */
var SC_NAME_STEPS = [[1, 1.25, 2], [.9, 1.2, 2], [.82, 1.15, 3], [.76, 1.12, 3], [.7, 1.08, 3], [.64, 1.05, 3]];
function scFitNames(){
  try{
    var base = 0;
    document.querySelectorAll("#grid .card-name").forEach(function(n){
      if(n.__scFit === n.textContent) return;
      n.style.removeProperty("font-size"); n.style.removeProperty("line-height"); n.style.removeProperty("-webkit-line-clamp");
      if(!base) base = parseFloat(getComputedStyle(n).fontSize) || 14.4;
      for(var i = 0; i < SC_NAME_STEPS.length; i++){
        var st = SC_NAME_STEPS[i];
        n.style.setProperty("font-size", (base * st[0]).toFixed(2) + "px", "important");
        n.style.setProperty("line-height", String(st[1]), "important");
        n.style.setProperty("-webkit-line-clamp", String(st[2]), "important");
        if(n.scrollHeight <= n.clientHeight + 1) break;
      }
      n.__scFit = n.textContent;
    });
  }catch(e){}
}
window.addEventListener("resize", function(){ document.querySelectorAll("#grid .card-name").forEach(function(n){ n.__scFit = null; }); scFitNames(); });

/* first screen ends neatly: if the 2nd product row only peeks above the bottom bar, push it just below the bar (small gap only) */
var __scFoldVH = 0, __scFoldW = 0;
var __scFoldT = 0;
function scFoldFix(){
  var g = document.getElementById("grid");
  if(g && (window.scrollY || 0) < 40 && window.innerWidth < 900) g.classList.add("sc-fold-wait");
  __scFoldRun(true);
  clearTimeout(__scFoldT); __scFoldT = setTimeout(function(){ __scFoldRun(); var g2 = document.getElementById("grid"); if(g2) g2.classList.remove("sc-fold-wait"); }, 180);
}
function __scFoldRun(){
  try{
    var cards = document.querySelectorAll("#grid > .card");
    for(var i = 0; i < cards.length && i < 2; i++) cards[i].style.removeProperty("margin-bottom");
    if(window.innerWidth >= 900 || cards.length < 3) return;
    var nav = document.querySelector(".sc-bnav"); if(!nav || getComputedStyle(nav).display === "none") return;
    if(!__scFoldVH || window.innerWidth !== __scFoldW){ __scFoldVH = window.innerHeight; __scFoldW = window.innerWidth; }
    var fold = __scFoldVH - nav.offsetHeight;
    var y = window.scrollY || 0;
    var row2 = cards[2].getBoundingClientRect().top + y;
    if(cards[2].getBoundingClientRect().top + y === cards[0].getBoundingClientRect().top + y) return;
    var extra = Math.ceil(fold - row2 + 6);
    if(extra > 0 && extra <= 130){ cards[0].style.setProperty("margin-bottom", extra + "px", "important"); cards[1].style.setProperty("margin-bottom", extra + "px", "important"); }
  }catch(e){}
}
window.addEventListener("resize", function(){ if(window.innerWidth !== __scFoldW){ __scFoldVH = 0; scFoldFix(); } });
window.addEventListener("load", function(){ setTimeout(scFoldFix, 50); });
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ setTimeout(scFoldFix, 50); }); }catch(e){}
document.addEventListener("DOMContentLoaded", function(){ try{ var g = document.getElementById("grid"); if(g) new MutationObserver(function(){ scFoldFix(); }).observe(g, {childList: true}); }catch(e){} });
