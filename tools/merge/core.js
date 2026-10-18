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
function pName(p){
  if(!p) return "";
  var l = displayLanguage;
  if(l === "en") return p.name || "";
  try{ var o = SC_NAME_I18N[String(p.code || p.pharmacy_code || "").trim()]; if(o && o[l]) return o[l]; }catch(e){}
  var cz = String(p.name_cz || "").trim() || p.name || "";
  try{
    if(l === "cs") return cz;
    if(l === "sk") return productNameSk(cz);
    if(l === "pl") return productNamePl(cz);
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
  scSetText("prefLangLabel", T("language")); scSetText("prefCurLabel", T("currency"));
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
  var fb = document.getElementById("finalCheckoutBtn"); if(fb && !fb.dataset.submitting && !fb.href) fb.textContent = T("confirmBtn");
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
}
function scUpdatePrefButtons(){
  document.querySelectorAll("[data-sc-lang]").forEach(function(b){ var on = b.getAttribute("data-sc-lang") === displayLanguage; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
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
function setDisplayLanguage(l){
  if(l === "cz") l = "cs"; if(l === "uk") l = "ua";
  if(SC_LANGS.indexOf(l) < 0) l = "en";
  /* picking a language switches the Arabic overlay off */
  if(l !== "en" && window.__SC_AR && typeof window.__scToggleAR === "function"){ try{ window.__scToggleAR(); }catch(e){} }
  displayLanguage = l;
  try{ localStorage.setItem("sc_lang", l); }catch(e){}
  /* currency follows the language unless the customer chose one */
  var chosen = null; try{ chosen = localStorage.getItem("sc_cur"); }catch(e){}
  if(!chosen) displayCurrency = l === "en" ? "GBP" : "EUR";
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
