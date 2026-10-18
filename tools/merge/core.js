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
var displayLanguage = (function(){
  try{
    var q = (location.search.match(/[?&]lang=([a-z]{2})/i) || [])[1];
    if(q){ q = q.toLowerCase(); if(q === "cz") q = "cs"; if(q === "uk") q = "ua"; }
    if(q && SC_LANGS.indexOf(q) >= 0){ try{ localStorage.setItem("sc_lang", q); }catch(e){} return q; }
    var s = null; try{ s = localStorage.getItem("sc_lang"); }catch(e){}
    if(s && SC_LANGS.indexOf(s) >= 0) return s;
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
var SC_SK_FIX = [["mléko pro dospělé","mlieko pre dospelých"],["pro dospělé","pre dospelých"],["pro děti","pre deti"],["sérum na řasy","sérum na mihalnice"],["proti vypadávání vlasů","proti vypadávaniu vlasov"],["proti lupům","proti lupinám"],["krém s mořským kolagenem","krém s morským kolagénom"],["ampule s mořským kolagenem","ampulky s morským kolagénom"],["bělicí","bieliaca"],["bělící","bieliaci"],["tekutý doplněk","tekutý doplnok"],["pěna","pena"]];
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
    if(l === "pl") return scFixCz(productNamePl(cz).replace(/injekční pero/gi, "wstrzykiwacz").replace(/perorální/gi, "doustna"), SC_PL_FIX);
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
  var c = SC_MAIN_I18N[key]; if(c && c[displayLanguage]) return c[displayLanguage];
  return enLabel;
}

/* ---- switching ---- */
function scSetText(id, v){ var el = document.getElementById(id); if(el) el.textContent = v; }
function scSetHtml(id, v){ var el = document.getElementById(id); if(el) el.innerHTML = v; }
function scSetAttr(id, a, v){ var el = document.getElementById(id); if(el) el.setAttribute(a, v); }
var SC_PHONE_BY_LANG = {en:"44",cs:"420",sk:"421",pl:"48",ru:"7",ua:"380",de:"49"};
function scApplyStaticTexts(){
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
  var fb = document.getElementById("finalCheckoutBtn"); if(fb && !fb.dataset.submitting && !fb.href) fb.textContent = fb.dataset.scNeed ? T(fb.dataset.scNeed) : T("confirmBtn"); scSetText("scCoWhenEdit", T("coChange")); scSetText("cardLabel", T("cardDelivery")); scSetText("scCoWhenLabel", T("coWhen"));
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
function scCatHint(){
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
function scNameCls(n){ n = String(n||""); var w = Math.max.apply(null, n.split(/\s+/).map(function(x){ return x.length; }).concat([0])); return (n.length > 42 || w > 15) ? " sc-n3" : (n.length > 28 || w > 12) ? " sc-n2" : ""; }
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
  if(chip) chip.textContent = (ar ? "🇪🇬 العربية" : (SC_FLAG[displayLanguage] + " " + SC_NAME[displayLanguage])) + "  ·  " + (SC_CUR_SYM[displayCurrency] || "£") + " " + displayCurrency;
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
