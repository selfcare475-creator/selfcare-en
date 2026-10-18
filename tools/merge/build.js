/* Build the merged Self Care storefront: English site as the base + every Czech-site language.
   usage: node build.js <en-public-dir> <cz-public-dir> <out-public-dir>
   The English repo's public/ is the base; the Czech repo is read only for its translations. */
const fs = require("fs"), path = require("path"), vm = require("vm");
let acorn; try{ acorn = require("acorn"); }catch(e){ acorn = require("/home/claude/tools/node_modules/acorn"); }
const [EN_DIR, CZ_DIR, OUT_DIR] = process.argv.slice(2);
const read = f => fs.readFileSync(f, "utf8");
let html = read(path.join(EN_DIR, "index.html"));
const CZ = read(path.join(CZ_DIR, "index.html"));
const SC_TX = require("./tx.js");
const KIT_TX = require("./kits_tx.js");
const failures = [];

/* ---------- helpers ---------- */
function inlineScripts(h){
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g; let m; const out = [];
  while((m = re.exec(h))) out.push({start: m.index, attrs: m[1], code: m[2], codeStart: m.index + m[0].indexOf(">") + 1});
  return out;
}
function parse(code){ return acorn.parse(code, {ecmaVersion: "latest", allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true}); }
/* source of a top-level declaration in any inline script of h */
function declSrc(h, name, {last = true} = {}){
  const found = [];
  for(const s of inlineScripts(h)){
    let ast; try{ ast = parse(s.code); }catch(e){ continue; }
    for(const st of ast.body){
      if(st.type === "FunctionDeclaration" && st.id.name === name) found.push(s.code.slice(st.start, st.end));
      if(st.type === "VariableDeclaration" && st.declarations.some(d => d.id.name === name)) found.push(s.code.slice(st.start, st.end));
      if(st.type === "ExpressionStatement" && st.expression.type === "AssignmentExpression"){
        const l = st.expression.left; const nm = s.code.slice(l.start, l.end);
        if(nm === name) found.push(s.code.slice(st.start, st.end));
      }
    }
  }
  if(!found.length) throw new Error("decl not found: " + name);
  return last ? found[found.length - 1] : found;
}
function mainScript(){ const s = inlineScripts(html).find(s => /^\s*const WA = "/.test(s.code)); if(!s) throw new Error("main script not found"); return s; }
/* replace a top-level declaration of the main script */
function replaceDecl(name, newSrc){
  const s = mainScript(); const ast = parse(s.code);
  const st = ast.body.find(st => (st.type === "FunctionDeclaration" && st.id.name === name) || (st.type === "VariableDeclaration" && st.declarations.some(d => d.id.name === name)));
  if(!st){ failures.push("replaceDecl: " + name); return; }
  const a = s.codeStart + st.start, b = s.codeStart + st.end;
  html = html.slice(0, a) + newSrc + html.slice(b);
}
function getDecl(name){ const s = mainScript(); const st = parse(s.code).body.find(st => st.type === "FunctionDeclaration" && st.id.name === name); return s.code.slice(st.start, st.end); }
/* exact text replacement with an expected count */
function rep(find, repl, count = 1, where = null){
  const hay = where ? where() : html;
  const n = hay.split(find).length - 1;
  if(n !== count){ failures.push(`rep(${n}!=${count}): ` + find.slice(0, 90)); return; }
  html = html.split(find).join(repl);
}
/* replacement inside one function of the main script */
function repIn(fnName, find, repl, count = 1){
  const src = getDecl(fnName); const n = src.split(find).length - 1;
  if(n !== count){ failures.push(`repIn ${fnName} (${n}!=${count}): ` + find.slice(0, 90)); return; }
  replaceDecl(fnName, src.split(find).join(repl));
}
function scriptById(h, id){ return inlineScripts(h).find(s => new RegExp(`id="${id}"`).test(s.attrs)); }
function replaceScriptBodyById(id, newCode){
  const s = scriptById(html, id); if(!s){ failures.push("script id " + id); return; }
  html = html.slice(0, s.codeStart) + newCode + html.slice(s.codeStart + s.code.length);
}
function scriptStartingWith(h, prefix){ return inlineScripts(h).find(s => s.code.trim().startsWith(prefix)); }

/* ---------- 1. translation data taken from the Czech site ---------- */
const czLANG = (() => {
  const src = ["LANG", "LANG.de", "LANG.sk", "LANG.en"].map(n => declSrc(CZ, n)).join("\n") + "\nthis.__L = LANG;";
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.__L;
})();
const groupsOf = h => { const ctx = {}; vm.createContext(ctx); vm.runInContext(declSrc(h, "categoryGroups") + "\nthis.__g = categoryGroups;", ctx); return ctx.__g; };
const enGroups = groupsOf(html), czGroups = groupsOf(CZ);
const LANGS = ["cs", "sk", "pl", "ru", "ua", "de"];
const SC_CAT_I18N = {};
for(const key of Object.keys(enGroups)){
  if(!czGroups[key]) continue;
  enGroups[key].subs.forEach((en, i) => {
    const cz = czGroups[key].subs[i]; if(!cz || cz === en) return;
    SC_CAT_I18N[en] = {cs: cz};
    for(const l of LANGS.slice(1)){ const v = czLANG[l] && czLANG[l].cats && czLANG[l].cats[cz]; if(v) SC_CAT_I18N[en][l] = v; }
  });
}
/* labels used by the English site outside categoryGroups */
const extraCats = {"Baby care": "Baby & kids", "Pain relief": "Pain, fever & headache", "Cold & flu": "Cold & blocked nose"};
for(const [a, b] of Object.entries(extraCats)) if(SC_CAT_I18N[b] && !SC_CAT_I18N[a]) SC_CAT_I18N[a] = SC_CAT_I18N[b];
const strip = s => String(s || "").replace(/[🌴⭐💊💆💇☀️✨🔥🎒🧴💅🧪🌞🌿🩺]/gu, "").trim();
const SC_MAIN_I18N = {tourist: {}, mobility: {}};
for(const l of LANGS){
  for(const k of Object.keys((czLANG[l] && czLANG[l].main) || {})){ (SC_MAIN_I18N[k] = SC_MAIN_I18N[k] || {})[l] = strip(czLANG[l].main[k]); }
  SC_MAIN_I18N.tourist[l] = {cs:"Potřeby na cesty",sk:"Potreby na cesty",pl:"Potrzeby w podróży",ru:"Товары для туристов",ua:"Товари для туристів",de:"Reisebedarf"}[l];
  SC_MAIN_I18N.mobility[l] = SC_TX.mobility[l];
}

/* Czech-site helper functions that turn names/descriptions into each language */
const czHelpers = ["scCzPackToEn", "orderProductName", "productNameSk", "productNamePl", "productNameRu", "productNameUa", "productNameDe",
  /* productDescSk/Pl/Ru/Ua/De (keyword-guessed descriptions) are no longer used — real translations come from desc-<lang>.json */
  "SC_NAME_I18N", "window.SC_SK_USE", "pickAutoText"]
  .map(n => declSrc(CZ, n)).join("\n\n");
const czAutoCard = declSrc(CZ, "autoCardTextFromCategory")
  .replace("function autoCardTextFromCategory(", "function __autoCardTextI18n(")
  .replace("const label = cleanCatLabel(sub || cat || \"\");", "const label = catLabel(cleanCatLabel(sub || cat || \"\"));");
if(!/catLabel\(cleanCatLabel/.test(czAutoCard)) failures.push("czAutoCard label patch");

/* product descriptions per language (real translations of each product's English description) → desc-<lang>.json next to the page */
const DESC_TX = JSON.parse(read(path.join(__dirname, "desc_tx.json")));
const DESC_VER = require("crypto").createHash("md5").update(JSON.stringify(DESC_TX)).digest("hex").slice(0, 8);
/* the language core is split in two: the small part (texts + core) runs first so the page can show translated at once;
   the heavy part (kit/scooter translations, name helpers) follows it — it is only needed when products/kits are drawn */
const coreScript = [
  "/* sc-i18n: generated by merge/build.js — edit merge/tx.js or merge/core.js, not this block */",
  "var SC_TX = " + JSON.stringify(SC_TX) + ";",
  "var SC_CAT_I18N = " + JSON.stringify(SC_CAT_I18N) + ";",
  "var SC_MAIN_I18N = " + JSON.stringify(SC_MAIN_I18N) + ";",
  "var SC_DESC_VERSION = " + JSON.stringify(DESC_VER) + ";",
  read(path.join(__dirname, "core.js")),
  read(path.join(__dirname, "seo.js"))
].join("\n");
const coreScript2 = [
  "var SC_KIT_TX = " + JSON.stringify(KIT_TX) + ";",
  read(path.join(__dirname, "mob_tx.js")),
  czHelpers,
  czAutoCard
].join("\n");

/* insert the language core before the main script */
{
  const s = mainScript(); const tagStart = html.lastIndexOf("<script", s.codeStart);
  html = html.slice(0, tagStart) + `<script id="sc-i18n">\n${coreScript}\n</script>\n<script id="sc-i18n-2">\n${coreScript2}\n</script>\n` + html.slice(tagStart);
}

/* ---------- 2. main script: language-aware rendering ---------- */
/* prices in the chosen currency */
{
  const s = mainScript();
  const fixed = s.code.replace(/≈ £\$\{toGBP\(((?:[^()]|\([^()]*\))*)\)\}/g, "${approxText($1)}").replace(/\(≈ £\$\{toGBP\(((?:[^()]|\([^()]*\))*)\)\}\)/g, "(${approxText($1)})");
  html = html.slice(0, s.codeStart) + fixed + html.slice(s.codeStart + s.code.length);
}
replaceDecl("priceHTML", 'function priceHTML(egp) {\n  return `<div class="egp">${egp} EGP</div><div class="gbp">${approxText(egp)}</div>`;\n}');
repIn("allCurrenciesTextEn", "(info only: ${Math.ceil(egp/CZK_RATE_EN)} Kč", "(info only: ${Math.round(egp*SC_CZK_PER_EGP)} Kč");

/* products: keep the Czech name for the other languages */
repIn("loadDynamicProducts", "if(displayName) products[idx].name = displayName;", "if(displayName) products[idx].name = displayName;\n        if(p.name_cz) products[idx].name_cz = scCleanAdminText(p.name_cz);");
repIn("loadDynamicProducts", "products.push({name:displayName, ", "products.push({name:displayName, name_cz:scCleanAdminText(p.name_cz||\"\"), ");
repIn("loadDynamicProducts", "|| autoCardTextFromCategory({name:displayName", "|| __autoCardTextEn({name:displayName");
repIn("loadDynamicProducts", "n: String((p.name_en||p.name_cz)||\"\"), ", "n: String((p.name_en||p.name_cz)||\"\"), nc: String(p.name_cz||\"\"), ");
repIn("applyDynOverlayCache", "if(name) products[idx].name = name;", "if(name) products[idx].name = name;\n      if(r.nc) products[idx].name_cz = scCleanAdminText(r.nc);");
repIn("applyDynOverlayCache", "products.push({name:name, ", "products.push({name:name, name_cz:scCleanAdminText(r.nc||\"\"), ");
repIn("applyDynOverlayCache", "desc0 = autoCardTextFromCategory({", "desc0 = __autoCardTextEn({");
repIn("applyDynOverlayCache", "dynamicCardTextForLang({use_en:ue0,use_cz:uc0}, \"en\")", "dynamicCardTextForLang({use_en:ue0,use_cz:uc0}, \"en\")", 1);

/* card texts: English site's own texts for English, the Czech site's translations for the rest */
{
  const enAuto = getDecl("autoCardTextFromCategory").replace("function autoCardTextFromCategory(", "function __autoCardTextEn(");
  replaceDecl("autoCardTextFromCategory", enAuto + "\nfunction autoCardTextFromCategory(p){ return displayLanguage === \"en\" ? __autoCardTextEn(p) : __autoCardTextI18n(p); }");
}
repIn("dynamicCardTextForLang", "if(lang===\"cs\"&&useCz)return useCz;", "if(lang===\"cs\"&&useCz)return useCz;\n  if(lang===\"sk\"&&useCz)return (window.SC_SK_USE&&window.SC_SK_USE[useCz])||useCz;\n  if(lang===\"de\"||lang===\"ru\"||lang===\"ua\")return useEn||useCz||\"\";");
replaceDecl("productUseFor", `function productUseFor(p){ return scUseFix(__productUseForRaw(p)); }
function __productUseForRaw(p){
  const lang = displayLanguage;
  const approved = getApprovedCardText(p, lang);
  if(approved && !isGenericProductInfoText(approved)) return approved;
  const dyn = dynamicCardTextForLang(p, lang);
  if(dyn && !isGenericProductInfoText(dyn)) return shortSelfcareCardText ? shortSelfcareCardText(dyn) : dyn;
  if(lang === "en"){
    const raw = p ? String(p.use_override||p.use_en||p.usage||p.use||"").trim() : "";
    if(raw && !isGenericProductInfoText(raw)) return shortSelfcareCardText ? shortSelfcareCardText(raw) : raw;
    if(p && exactUseForMap[p.name]) return exactUseForMap[p.name];
  }
  return autoCardTextFromCategory(p);
}`);

/* search also matches the name shown in the chosen language and the Czech name */
repIn("productSearchText", "const base = [p.name, p.desc, p.cat, sub, cleanCatLabel(sub), main].join(\" \");",
  "const base = [p.name, p.name_cz || \"\", displayLanguage !== \"en\" ? pName(p) : \"\", p.desc, p.desc_cz || \"\", p.use_cz || \"\", displayLanguage !== \"en\" ? productUseFor(p) : \"\", p.cat, p.cat_cz || \"\", sub, cleanCatLabel(sub), catLabel(cleanCatLabel(sub)), main].join(\" \");");

/* search: keep accents/Cyrillic (Czech site's normalizer) and add the Czech site's symptom words */
replaceDecl("normalizeText", declSrc(CZ, "normalizeText"));
{
  const czConcepts = declSrc(CZ, "searchConcepts").replace(/^(const|let|var)\s+searchConcepts\b/, "const __czSearchConcepts");
  const enDecl = mainScript().code.match(/\n(const|let|var) searchConcepts\b/) ? null : "x";
  if(enDecl) failures.push("searchConcepts decl");
  const s0 = mainScript(); const st = parse(s0.code).body.find(st => st.type === "VariableDeclaration" && st.declarations.some(d => d.id.name === "searchConcepts"));
  const end = s0.codeStart + st.end;
  html = html.slice(0, end) + "\n" + czConcepts + "\n__czSearchConcepts.forEach(function(g){ if(g && !Array.isArray(g) && Array.isArray(g.keys) && Array.isArray(g.terms)) searchConcepts.push(g); });" + html.slice(end);
}
/* category buttons */
repIn("buildFilters", "const label = parts.slice(1).join(\" \");", "const label = mainLabel(key, parts.slice(1).join(\" \"));");
repIn("buildFilters", "<span class=\"cat-hot\">Most requested</span>", "<span class=\"cat-hot\">${T(\"mostRequested\")}</span>");
repIn("buildFilters", "  document.getElementById(\"filters\").innerHTML =", "  var __scRow0 = document.querySelector(\"#filters .main-filters\"); var __scX = __scRow0 ? __scRow0.scrollLeft : 0;\n  document.getElementById(\"filters\").innerHTML =");
repIn("buildFilters", "  renderKits();\n}", "  try{ var __scRow1 = document.querySelector(\"#filters .main-filters\"); if(__scRow1){ __scRow1.scrollLeft = __scX; var __a = __scRow1.querySelector(\".main-filter-btn.active\"); if(__a){ var l = __a.offsetLeft - __scRow1.offsetLeft, r = l + __a.offsetWidth; if(l < __scRow1.scrollLeft) __scRow1.scrollLeft = Math.max(0, l - 12); else if(r > __scRow1.scrollLeft + __scRow1.clientWidth) __scRow1.scrollLeft = r - __scRow1.clientWidth + 12; } } }catch(e){}\n  renderKits();\n}");
repIn("buildFilters", "  renderKits();\n}", "  try{ var fb = document.getElementById(\"filters\"); if(fb && !fb.querySelector(\".sc-cat-next\")){ fb.insertAdjacentHTML(\"beforeend\", '<button type=\"button\" class=\"sc-cat-arrow sc-cat-next\" aria-label=\"More\" onclick=\"scCatScroll(1)\"><span>›</span></button>'); } setTimeout(scCatHint, 0); setTimeout(scCatHint, 400); }catch(e){}\n  renderKits();\n}");
repIn("cleanCatLabel", "return map[cat] || cat;", "return catLabel(map[cat] || cat);");

/* product grid + modal */
repIn("renderGrid", "<div class=\"empty\">😕 No products found</div>", "<div class=\"empty\">${T(\"noProducts\")}</div>");
repIn("renderGrid", "<div class=\"badge-soldout\">Out of Stock</div>", "<div class=\"badge-soldout\">${T(\"outOfStock\")}</div>");
repIn("renderGrid", "<div class=\"soldout-label\">Out of Stock</div>", "<div class=\"soldout-label\">${T(\"outOfStock\")}</div>");
repIn("renderGrid", "alt=\"${p.name}\"", "alt=\"${pName(p)}\"", 2);
repIn("renderGrid", "<div class=\"card-name\" onclick=\"openModal(${idx})\">${p.name}</div>", "<div class=\"card-name\" onclick=\"openModal(${idx})\">${pName(p)}</div>", 2);
repIn("fastLoadMoreHtml", ">Show more</button>", ">${T(\"showMore\")}</button>");
repIn("fastLoadMoreHtml", ">Showing ${rendered} of ${total}</div>", ">${T(\"showing\",{a:rendered,b:total})}</div>");
repIn("loadSplitCatalogData", "'<div class=\"empty\">Products could not be loaded. Please refresh the page.</div>'", "'<div class=\"empty\">' + T(\"loadFail\") + '</div>'");
repIn("openModal", "document.getElementById(\"mName\").textContent = p.name;", "document.getElementById(\"mName\").textContent = pName(p);");
repIn("openModal", "document.getElementById(\"mDesc\").textContent = p.desc;", "document.getElementById(\"mDesc\").textContent = pDesc(p);");
repIn("openModal", "notice.textContent = \"⛔ Out of stock\";", "notice.textContent = T(\"oosModal\");");
repIn("addFromModal", "btn.innerHTML = \"✓ Added to basket\";", "btn.innerHTML = T(\"addedBtn\");");
/* badges only on a few products: the 5 tourist favourites and the top 6 best sellers */
replaceDecl("productBadge", `function productBadge(p){
  if(["Antinal 24 capsules","Streptoquin 20 tablets","ORS 10 sachets","Enterogermina 2 Billion oral suspension","OFF repellent spray"].includes(p.name)) return {label:T("badgeTourist"), className:"badge-tourist"};
  if(isBestSeller(p.name) && bestSellerRank(p.name) < 6) return {label:T("badgeBest"), className:"badge-tourist"};
  return null;
}`);

/* basket */
repIn("renderCart", "`<div class=\"cart-empty\">🛒<br><br>Your basket is empty.<br>Add products from the list.</div>`", "`<div class=\"cart-empty\">${T(\"cartEmpty\")}</div>`");
repIn("renderCart", "alt=\"${p.name}\"", "alt=\"${pName(p)}\"");
repIn("renderCart", "<div class=\"ci-name\">${p.name}</div>", "<div class=\"ci-name\">${pName(p)}</div>");
repIn("renderCart", "EGP / item •", "EGP ${T(\"perItem\")} •");
repIn("renderCart", "<span class=\"cart-row-label\">Products</span>", "<span class=\"cart-row-label\">${T(\"products\")}</span>");
repIn("renderCart", "<span class=\"cart-row-label\">Number of items</span>", "<span class=\"cart-row-label\">${T(\"itemCount\")}</span>");
repIn("renderCart", "${itemCount} pcs</span>", "${itemCount} ${T(\"pcs\")}</span>");
repIn("updateStickyCart", "textEl.textContent = total === 1 ? \"1 item\" : total + \" items\";", "textEl.textContent = total === 1 ? T(\"item1\") : T(\"itemsN\",{n:total});");
repIn("clearCart", "confirm(\"Clear the whole basket?\")", "confirm(T(\"clearConfirm\"))");
repIn("openCheckout", "showToast(\"Your basket is empty\");", "showToast(T(\"basketEmptyToast\"));");

/* delivery time notes */
repIn("updateDeliveryTimeOptions", "note.textContent = \"Today is no longer available. Please choose tomorrow or contact us on WhatsApp.\";", "note.textContent = T(\"todayGone\");");
repIn("updateDeliveryTimeOptions", ": \"tomorrow\";", ": T(\"tomorrowWord\");");
repIn("updateDeliveryTimeOptions", "note.textContent = `Minimum delivery time is ${MIN_DELIVERY_MINUTES} minutes. Earliest possible today is after ${earliest}.`;", "note.textContent = T(\"minTime\",{m:MIN_DELIVERY_MINUTES,t:earliest});");
repIn("updateDeliveryTimeOptions", "note.textContent = \"Preparation + delivery takes at least 90 minutes.\";", "note.textContent = T(\"prepNote\");");

/* checkout summary + order */
repIn("renderCheckout", ": \"Select hotel from suggestions\")", ": T(\"selectHotelSugg\"))");
repIn("renderCheckout", ": \"Select hotel\";", ": T(\"selectHotel\");");
repIn("renderCheckout", "<span>Products</span>", "<span>${T(\"products\")}</span>");
repIn("renderCheckout", "<span>Number of items</span><span>${itemCount} pcs</span>", "<span>${T(\"itemCount\")}</span><span>${itemCount} ${T(\"pcs\")}</span>");
repIn("renderCheckout", "<span>Delivery</span>", "<span>${T(\"delivery\")}</span>");
repIn("renderCheckout", "<span>Payment</span><span>${paymentMethod === \"visa\" ? \"Visa\" : \"Cash\"}</span>", "<span>${T(\"payment\")}</span><span>${paymentMethod === \"visa\" ? \"Visa\" : T(\"cash\")}</span>");
repIn("renderCheckout", "<span>Visa fee 3%</span>", "<span>${T(\"visaFee\")}</span>");
repIn("renderCheckout", "<span>Total</span>", "<span>${T(\"total\")}</span>");
repIn("renderCheckout", "<small>${approxText(finalTotal)}</small></span></div>\n  `;", "<small>${approxText(finalTotal)}</small></span></div>\n    ${displayCurrency === \"CZK\" ? `<div class=\"payment-note\" style=\"display:block;margin-top:8px\">${T(\"czkText\")}</div>` : ``}\n  `;");
repIn("renderCheckout", "btn.title = !hotelValid ? \"Please select a valid hotel from the suggestions\" : \"Please enter a valid WhatsApp number\";", "btn.title = !hotelValid ? T(\"hotelInvalid\") : T(\"phoneInvalid\");");
repIn("renderCheckout", "customer_lang: \"en\",", "customer_lang: displayLanguage,");
repIn("renderCheckout", "source_code: 61, /* v31: identifies English storefront */", "source_code: scSiteCode(), /* 61 English · 72 Czech & other languages · 51 Slovak */");
repIn("renderCheckout", "showToast(\"The selected time is no longer available. Please choose a new delivery time.\");", "showToast(T(\"slotGone\"));");
repIn("renderCheckout", "btn.textContent = \"Creating order...\";", "btn.textContent = T(\"creating\");");
repIn("renderCheckout", "let cleanMsg = msgText.replace(/\\n# Code 61\\s*$/,\"\").trim();", "let cleanMsg = msgText.replace(/\\n# Code \\d+\\s*$/,\"\").trim();");
repIn("renderCheckout", "\"🛒 *Self Care Pharmacy Order*\\n\\nOrder Number: #\"+orderId+\"\\nCode: 61\"", "\"🛒 *Self Care Pharmacy Order*\\n\\nOrder Number: #\"+orderId+\"\\nCode: \"+(window.__pendingOrder.source_code||scSiteCode())");
repIn("renderCheckout", "btn.textContent = oldText || \"Confirm order & send WhatsApp\";", "btn.textContent = oldText || T(\"confirmBtn\");");
/* the WhatsApp message stays in English for the pharmacy; only the code follows the language */
repIn("buildInvoiceText", "# Code 61", "# Code ${scSiteCode()}");
repIn("buildInvoiceHTML", "# Code 61", "# Code ${scSiteCode()}");

/* checkout status messages (Czech site's texts + English site's wording) */
replaceDecl("checkoutWaText", `function checkoutWaText(key){
  const data = {
    created:{en:"Order is created",cs:"Objednávka je vytvořena",sk:"Objednávka je vytvorená",pl:"Zamówienie zostało utworzone",ru:"Заказ создан",ua:"Замовлення створено",de:"Bestellung wurde erstellt"},
    help:{en:"To confirm, please send the message on WhatsApp. If WhatsApp did not open automatically, use the buttons below.",cs:"Pro potvrzení prosím odešlete zprávu ve WhatsApp. Pokud se WhatsApp neotevřel automaticky, použijte tlačítka níže.",sk:"Na potvrdenie prosím odošlite správu cez WhatsApp. Ak sa WhatsApp neotvoril automaticky, použite tlačidlá nižšie.",pl:"Aby potwierdzić, wyślij wiadomość w WhatsApp. Jeśli WhatsApp nie otworzył się automatycznie, użyj przycisków poniżej.",ru:"Для подтверждения отправьте сообщение в WhatsApp. Если WhatsApp не открылся автоматически, используйте кнопки ниже.",ua:"Для підтвердження надішліть повідомлення у WhatsApp. Якщо WhatsApp не відкрився автоматично, скористайтеся кнопками нижче.",de:"Zum Bestätigen bitte die Nachricht in WhatsApp senden. Falls WhatsApp nicht automatisch geöffnet wurde, nutzen Sie die Tasten unten."},
    open:{en:"Open WhatsApp",cs:"Otevřít WhatsApp",sk:"Otvoriť WhatsApp",pl:"Otwórz WhatsApp",ru:"Открыть WhatsApp",ua:"Відкрити WhatsApp",de:"WhatsApp öffnen"},
    copy:{en:"Copy order message",cs:"Kopírovat zprávu",sk:"Kopírovať správu",pl:"Kopiuj wiadomość",ru:"Копировать сообщение",ua:"Копіювати повідомлення",de:"Nachricht kopieren"},
    copied:{en:"Message copied. Please send it on WhatsApp.",cs:"Zpráva zkopírována. Pošlete ji prosím ve WhatsApp.",sk:"Správa skopírovaná. Pošlite ju prosím cez WhatsApp.",pl:"Wiadomość skopiowana. Wyślij ją w WhatsApp.",ru:"Сообщение скопировано. Отправьте его в WhatsApp.",ua:"Повідомлення скопійовано. Надішліть його у WhatsApp.",de:"Nachricht kopiert. Bitte in WhatsApp senden."},
    preparing:{en:"Preparing WhatsApp...",cs:"Připravuji WhatsApp...",sk:"Pripravujem WhatsApp...",pl:"Przygotowuję WhatsApp...",ru:"Подготовка WhatsApp...",ua:"Підготовка WhatsApp...",de:"WhatsApp wird vorbereitet..."},
    error:{en:"Could not create the order. Please try again.",cs:"Objednávku se nepodařilo vytvořit. Zkuste to prosím znovu.",sk:"Objednávku sa nepodarilo vytvoriť. Skúste to prosím znova.",pl:"Nie udało się utworzyć zamówienia. Spróbuj ponownie.",ru:"Не удалось создать заказ. Попробуйте еще раз.",ua:"Не вдалося створити замовлення. Спробуйте ще раз.",de:"Bestellung konnte nicht erstellt werden. Bitte versuchen Sie es erneut."}
  };
  return (data[key] && scPick(data[key])) || key;
}`);

/* kits */
replaceDecl("kitBenefit", `function kitBenefit(kit){
  const map = ${JSON.stringify(Object.fromEntries(Object.entries(KIT_TX).filter(([k, v]) => v.benefit).map(([k, v]) => [k, v.benefit])))};
  if(displayLanguage !== "en" && map[kit.id] && map[kit.id][displayLanguage]) return map[kit.id][displayLanguage];
  return kit.benefit || (map[kit.id] && map[kit.id].en) || T("kitDefault");
}`);
replaceDecl("kitBadge", `function kitBadge(kit){
  if(kit.premium) return \`<span class="kit-badge-prem">\${T("kitPremium")}</span>\`;
  if(kit.popular) return \`<span class="kit-badge-most">\${T("kitMost")}</span>\`;
  const label = (kit.type === "glow") ? T("kitBeauty") : T("kitCare");
  return \`<span class="kit-badge-type">\${label}</span>\`;
}
function kitName(kit){
  const t = SC_KIT_TX[kit.id];
  return (displayLanguage !== "en" && t && t.name && t.name[displayLanguage]) || kit.name;
}`);
repIn("kitProductName", "if(typeof productDisplayName === \"function\") return productDisplayName(p);\n  return p.name || \"\";", "return pName(p);");
for(const fn of ["renderKitGrid", "openKitModal"]){
  repIn(fn, "<span>${kit.name}</span>", "<span>${kitName(kit)}</span>");
  repIn(fn, "<span class=\"kit-badge-count\">${count} items</span>", "<span class=\"kit-badge-count\">${T(\"kitItems\",{n:count})}</span>");
}
repIn("renderKitGrid", "<div class=\"kit-card-title\">${kit.name}</div>", "<div class=\"kit-card-title\">${kitName(kit)}</div>");
repIn("renderKitGrid", ">+ Add complete kit</button>", ">${T(\"kitAdd\")}</button>");
repIn("renderKitGrid", "<div class=\"kit-view-hint\">Tap to see what's inside</div>", "<div class=\"kit-view-hint\">${T(\"kitHint\")}</div>");
repIn("openKitModal", "<div class=\"kit-modal-title\">${kit.name}</div>", "<div class=\"kit-modal-title\">${kitName(kit)}</div>");
repIn("openKitModal", "closeKitModal();\">Add kit</button>", "closeKitModal();\">${T(\"kitAddShort\")}</button>");

/* ---------- 3. scripts after the main one ---------- */
/* confirm dialog in the customer's language (Czech site's version) */
{
  const enConfirm = scriptStartingWith(html, "window.showOrderConfirm = function(){");
  const czConfirm = scriptStartingWith(CZ, "// منطق نافذة التأكيد");
  const czTexts = declSrc(CZ, "tr") && (() => { const m = CZ.match(/\/\/ ====== نصوص نافذة التأكيد[\s\S]*?\}\)\(\);/); return m ? m[0] : null; })();
  if(!enConfirm || !czConfirm || !czTexts) failures.push("confirm dialog scripts");
  else {
    let texts = czTexts;
    if(!/\bua:\s*\{/.test(texts)) texts = texts.replace(/(\n\s*ru:\s*\{[^}]*\})/, `$1,
    ua: { q_title:"Завершити замовлення?", q_text:"Бажаєте надіслати замовлення?", q_yes:"Так, продовжити", q_no:"Назад",
          wa_title:"Відкриється WhatsApp", wa_text:"Відкриється WhatsApp із деталями замовлення. Будь ласка, надішліть повідомлення, щоб ми доставили замовлення.", wa_ok:"Зрозуміло, відкрити WhatsApp" }`);
    if(!/\bua:\s*\{/.test(texts)) failures.push("confirm ua texts");
    html = html.slice(0, enConfirm.codeStart) + "\n" + texts + "\n" + czConfirm.code + "\n" + html.slice(enConfirm.codeStart + enConfirm.code.length);
  }
}
/* overlays that the Czech site already has in every language (Slovak included) */
for(const id of ["selfcare-min-order-popup-actions-fixed-v3-js", "cart-prune-locked-v1"]){
  const cz = scriptById(CZ, id); if(!cz){ failures.push("cz overlay " + id); continue; }
  replaceScriptBodyById(id, cz.code);
}
/* My Orders / tracking: Czech version (adds Slovak) with the English site's WhatsApp number */
{
  const cz = scriptById(CZ, "order-history-v1");
  let code = cz.code.split("https://wa.me/201213444083").join("https://wa.me/201501401776");
  if(/201213444083/.test(code)) failures.push("order-history: other Czech number left");
  replaceScriptBodyById("order-history-v1", code);
}
/* header "My Orders" button: short word so the button stays the English size (the panel title keeps the full words) */
rep('if(t) t.textContent = scMyOrdersLabel();', 'if(t) t.textContent = (typeof T === "function") ? T("myOrdersBtn") : scMyOrdersLabel();');
/* order success popup: copy hints in the customer's language */
{
  const s = scriptStartingWith(html, "window.showOrderSuccessModal = function(");
  let code = s.code.replace('copiedEl.textContent = "Tap number to copy";', 'copiedEl.textContent = T("osTap");')
    .replace('copiedEl.textContent = "✓ Copied!";', 'copiedEl.textContent = T("osCopied");')
    .replace('copiedEl.textContent = "Please copy manually";', 'copiedEl.textContent = T("osManual");');
  if(/"Tap number to copy"|"Please copy manually"/.test(code)) failures.push("success modal texts");
  html = html.slice(0, s.codeStart) + code + html.slice(s.codeStart + s.code.length);
}
/* Arabic (staff/local) option works on top of the English texts */
rep("window.__SC_AR=!window.__SC_AR;\n   if(window.__SC_AR){", "window.__SC_AR=!window.__SC_AR;\n   if(window.__SC_AR && typeof displayLanguage!==\"undefined\" && displayLanguage!==\"en\"){ try{ setDisplayLanguage(\"en\", {keepAr:true}); }catch(e){} }\n   if(window.__SC_AR){\n     try{ scUpdatePrefButtons(); }catch(e){}");
/* scooter booking: German texts exist, everything else stays English; currency follows the page */
rep("S.lang = 'en'; S.cur = 'GBP'; S.custom = true;", "S.lang = (typeof displayLanguage !== 'undefined' && T[displayLanguage]) ? displayLanguage : 'en'; S.cur = (typeof displayCurrency !== 'undefined' && ['GBP','EUR','USD'].indexOf(displayCurrency) >= 0) ? displayCurrency : (typeof displayCurrency !== 'undefined' && displayCurrency === 'CZK' ? 'EUR' : 'GBP'); S.custom = true;");
/* scooter booking: no currency picker of its own — it follows the site's currency buttons (Kč → €, the booking has no Kč rate) */
rep("  let seg = root.getElementById('curSeg');\n  if (!seg) {\n    seg = document.createElement('div'); seg.className = 'curseg'; seg.id = 'curSeg';", "  let seg = null;\n  if (false) {\n    seg = document.createElement('div'); seg.className = 'curseg'; seg.id = 'curSeg';");
rep("  seg.querySelectorAll('[data-cur]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cur === S.cur));\n", "");
rep("S.custom = true; S.end = ''; S.step = 2;", "S.custom = true; S.end = ''; S.step = 2;\nwindow.__scMobSync = function(){ S.lang = (typeof displayLanguage !== 'undefined' && T[displayLanguage]) ? displayLanguage : 'en'; S.cur = (typeof displayCurrency !== 'undefined' && ['GBP','EUR','USD'].indexOf(displayCurrency) >= 0) ? displayCurrency : (typeof displayCurrency !== 'undefined' && displayCurrency === 'CZK' ? 'EUR' : 'GBP'); try{ if (DB) renderAll(); }catch(e){} };");
/* funnel: site = domain the customer came from, plus the language */
rep('var SITE = ("en" || (cz ? "cz" : "en"))', 'var SITE = ((/selfcare-cz/.test(host) ? "cz" : "en"))');

/* ---------- 4. page markup ---------- */
rep('<header>\n  <div class="logo">Self Care <span>Pharmacy</span></div>', '<header>\n  <div class="logo">Self Care <span>Pharmacy</span></div>');
rep("🛒 Basket\n    <span class=\"cart-badge", "🛒 <span id=\"cartBtnText\">Basket</span>\n    <span class=\"cart-badge");
/* language + currency: one small chip in the header opens this sheet */
rep('<div class="controls">\n  <div class="search-wrap">', `<div class="sc-sheet-backdrop" id="scPrefsSheet" onclick="if(event.target===this)scClosePrefs()" aria-hidden="true">
  <div class="sc-sheet" role="dialog" aria-modal="true" aria-labelledby="prefLangLabel">
    <div class="sc-sheet-grab"></div>
    <div class="sc-sheet-title" id="prefLangLabel">Language</div>
    <div class="sc-sheet-grid">${
      ["en","cs","sk","pl","ru","ua","de"].map(l => `<button type="button" class="sc-pref-btn" data-sc-lang="${l}" onclick="setDisplayLanguage('${l}');this.blur()"><b>${({en:"EN",cs:"CZ",sk:"SK",pl:"PL",ru:"RU",ua:"UA",de:"DE"})[l]}</b><small>${({en:"English",cs:"Čeština",sk:"Slovenčina",pl:"Polski",ru:"Русский",ua:"Українська",de:"Deutsch"})[l]}</small></button>`).join("")
    }<button type="button" class="sc-pref-btn" data-sc-ar="1" onclick="scPickArabic();this.blur()"><b>ع</b><small>العربية</small></button></div>
    <div class="sc-sheet-title" id="prefCurLabel">Currency</div>
    <div class="sc-sheet-grid sc-sheet-cur">${
      [["GBP","£"],["EUR","€"],["USD","$"],["CZK","Kč"]].map(([c, s]) => `<button type="button" class="sc-pref-btn" data-sc-cur="${c}" onclick="setDisplayCurrency('${c}');this.blur()"><b>${s}</b><small>${c}</small></button>`).join("")
    }</div>
    <button type="button" class="sc-sheet-done" id="scPrefsDone" onclick="scClosePrefs()">OK</button>
  </div>
</div>
<div class="controls">
  <div class="search-wrap">`);
rep("<h2>How to order</h2>", "<h2 id=\"howTitle\">How to order</h2>");
rep("<div><b>1.</b> Choose your product.</div>", "<div><b>1.</b> <span id=\"howStep1\">Choose your product.</span></div>");
rep("<div><b>2.</b> Add it to your basket.</div>", "<div><b>2.</b> <span id=\"howStep2\">Add it to your basket.</span></div>");
rep("<div><b>3.</b> Confirm your order and WhatsApp will open for follow-up.</div>", "<div><b>3.</b> <span id=\"howStep3\">Confirm your order and WhatsApp will open for follow-up.</span></div>");
rep("<div><b>4.</b> Add your hotel and room number.</div>", "<div><b>4.</b> <span id=\"howStep4\">Add your hotel and room number.</span></div>");
rep('<div class="modal-price-label">💊 Unit price</div>', '<div class="modal-price-label" id="modalPriceLabel">💊 Unit price</div>');
rep('<div class="modal-qty-label">Quantity:</div>', '<div class="modal-qty-label" id="modalQtyLabel">Quantity:</div>');
rep('<div class="cart-title">🛒 Your basket</div>', '<div class="cart-title" id="cartTitle">🛒 Your basket</div>');
rep('<button class="cart-checkout-btn" onclick="openCheckout()">', '<button class="cart-checkout-btn" id="cartCheckoutBtn" onclick="openCheckout()">');
rep('<button class="cart-clear" onclick="clearCart()">', '<button class="cart-clear" id="cartClearBtn" onclick="clearCart()">');
rep('<div class="sticky-cart-action">View basket</div>', '<div class="sticky-cart-action" id="stickyCartAction">View basket</div>');
rep("<h2>Order details</h2>", "<h2 id=\"checkoutTitle\">Order details</h2>");
rep("<label>🏨 Hotel</label>", "<label id=\"checkoutHotelLabel\">🏨 Hotel</label>");
rep("<label>📅 Delivery</label>", "<label id=\"deliveryDayLabel\">📅 Delivery</label>");
rep('<option value="Today">Today</option>', '<option value="Today" id="dayTodayOption">Today</option>');
rep('<option value="Tomorrow">Tomorrow</option>', '<option value="Tomorrow" id="dayTomorrowOption">Tomorrow</option>');
rep("<label>🕒 Time</label>", "<label id=\"deliveryTimeLabel\">🕒 Time</label>");
rep("<label>💳 Payment method</label>", "<label id=\"paymentLabel\">💳 Payment method</label>");
rep("<span>Cash</span>", "<span id=\"cashLabel\">Cash</span>");
rep('<div class="payment-note">Visa over 3000 EGP adds 3% fee.</div>', '<div class="payment-note" id="paymentNote">Visa over 3000 EGP adds 3% fee.</div>');
rep("<label>📱 WhatsApp number (required)</label>", "<label id=\"checkoutPhoneLabel\">📱 WhatsApp number (required)</label>");
rep('<option value="manual">🌍 Other / manual code</option>', '<option value="manual" id="phoneManualOption">🌍 Other / manual code</option>');
rep('<div class="checkout-help">Required for delivery follow-up and hotel/gate coordination on WhatsApp.</div>', '<div class="checkout-help" id="checkoutPhoneHelp">Required for delivery follow-up and hotel/gate coordination on WhatsApp.</div>');
rep("<label>🚪 Room / note</label>", "<label id=\"checkoutNoteLabel\">🚪 Room / note</label>");
rep('<div class="checkout-help">By confirming, your order will be created and WhatsApp will open directly for delivery follow-up.</div>', '<div class="checkout-help" id="checkoutConfirmHelp">By confirming, your order will be created and WhatsApp will open directly for delivery follow-up.</div>');
/* confirm dialog gets the ids the translated version fills */
rep('<h3 style="margin:0 0 8px;font-size:20px;color:#0f766e;font-weight:900;">Complete your order?</h3>', '<h3 id="ocTitle1" style="margin:0 0 8px;font-size:20px;color:#0f766e;font-weight:900;">Complete your order?</h3>');
rep('<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.5;">Do you want to send your order?</p>', '<p id="ocText1" style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.5;">Do you want to send your order?</p>');
rep('<h3 style="margin:0 0 8px;font-size:20px;color:#25D366;font-weight:900;">WhatsApp will open</h3>', '<h3 id="ocTitle2" style="margin:0 0 8px;font-size:20px;color:#25D366;font-weight:900;">WhatsApp will open</h3>');
rep('<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.55;">WhatsApp will open with your order details.', '<p id="ocText2" style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.55;">WhatsApp will open with your order details.');
/* order success popup */
rep('<div style="font-size:19px;font-weight:900;margin-bottom:4px;">Order Received!</div>', '<div id="osTitle" style="font-size:19px;font-weight:900;margin-bottom:4px;">Order Received!</div>');
rep('<div style="font-size:12px;opacity:.9;font-weight:600;">We got your order successfully</div>', '<div id="osSub" style="font-size:12px;opacity:.9;font-weight:600;">We got your order successfully</div>');
rep('letter-spacing:.7px;margin-bottom:6px;">Your Order Number</div>', 'letter-spacing:.7px;margin-bottom:6px;" id="osNum">Your Order Number</div>');
rep('<div style="font-size:14px;color:#92400e;font-weight:900;margin-bottom:5px;">📱 Final step</div>', '<div id="osFinal" style="font-size:14px;color:#92400e;font-weight:900;margin-bottom:5px;">📱 Final step</div>');
rep('<div style="font-size:13px;color:#78350f;line-height:1.45;font-weight:600;">Your order is already prepared', '<div id="osFinalText" style="font-size:13px;color:#78350f;line-height:1.45;font-weight:600;">Your order is already prepared');
rep('<button type="button" onclick="scCloseOrderSuccess()" style=', '<button type="button" id="osContinue" onclick="scCloseOrderSuccess()" style=');
/* Siva Golden Bay gate popup */
rep("<span>Important — Pickup at the Gate</span>", "<span id=\"hwTitle\">Important — Pickup at the Gate</span>");
rep('<div class="min-order-popup-text" style="margin-top:6px">', '<div class="min-order-popup-text" id="hwText" style="margin-top:6px">');
rep('onclick="scDismissHotelWarn()">Got it — I understand</button>', 'id="hwOk" onclick="scDismissHotelWarn()">Got it — I understand</button>');

/* language + currency row: same look as the English site's buttons */
/* long product names: 3 lines, smaller font instead of a cut-off name */
rep('<div class="card-name" onclick="openModal(${idx})">${pName(p)}</div>', '<div class="card-name${scNameCls(pName(p))}" onclick="openModal(${idx})">${pName(p)}</div>', 2);
/* + / − on a card: update that card only (no full grid redraw = no blink) */
repIn("changeCardQty", "  smoothRenderGridSoon();\n}", "  var __pill = e && e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(\".qty-pill\") : null;\n  if(__pill){ __pill.classList.toggle(\"active\", next > 0); var __n = __pill.querySelector(\".qty-pill-num\"); if(__n) __n.textContent = next; try{ e.currentTarget.blur(); }catch(_){} }\n  else smoothRenderGridSoon();\n}");
rep("<span>Visa</span>", "<span id=\"cardLabel\">Card on delivery</span>");
repIn("renderCheckout", "<span>${paymentMethod === \"visa\" ? \"Visa\" : T(\"cash\")}</span>", "<span>${paymentMethod === \"visa\" ? T(\"cardDelivery\") : T(\"cash\")}</span>");
rep('["Cash","كاش"],', '["Cash","كاش"],["🚪 Room number","🚪 رقم الغرفة"],["Room number","رقم الغرفة"],["📱 WhatsApp number","📱 رقم واتساب"],["Card on delivery","كارت عند التوصيل"],["Language & currency","اللغة والعملة"],["Mobility rental","تأجير الكراسي المتحركة"],["Confirm order & send WhatsApp","تأكيد الطلب وإرسال واتساب"],["Bestsellery","الأكثر مبيعاً"],');
rep('   [/^Minimum delivery time is', '   [/^(\\d+) pcs$/, "$1 قطعة"],\n   [/^Minimum delivery time is');
/* our pages are already translated: stop Chrome offering its own translation */
rep('<html lang="en">', '<html lang="en" translate="no">');
rep('<html lang="en" translate="no">\n<head>\n', '<html lang="en" translate="no">\n<head>\n<meta name="google" content="notranslate">\n');
rep("  document.documentElement.lang = S.lang;\n", "");
/* scooter booking in every site language */
rep("const prefs = store.get('scm_prefs') || {};", "Object.assign(T, SC_MOB_TX);\nconst prefs = store.get('scm_prefs') || {};");
rep("S.lang === 'de' ? 'de-DE' : 'en-GB'", "(SC_MOB_LOC[S.lang] || 'en-GB')", 4);
rep("if (S.lang === 'de') return s +", "if (S.lang !== 'en') return s +");
rep("(S.lang === 'de' ? ' oder ' : ' or ')", "(SC_MOB_OR[S.lang] || ' or ')");
rep("return S.lang === 'de' ? `${h}:00 Uhr` :", "return S.lang === 'de' ? `${h}:00 Uhr` : S.lang !== 'en' ? `${h}:00` :");
rep("let calMode = '', sheetPrev = null, sumShown = false;", "try{ Object.keys(SC_MOB_TX2).forEach(function(l){ if(T[l]) Object.assign(T[l], SC_MOB_TX2[l]); }); }catch(e){}\nlet calMode = '', sheetPrev = null, sumShown = false;");
/* the booking message the pharmacy receives stays English (German stays German) */
rep("  const lines = [t('waBooking'), '', b.code,", "  const __scL = S.lang; if (S.lang !== 'de') S.lang = 'en';\n  const lines = [t('waBooking'), '', b.code,");
rep("  b.wa = waLink(lines.join('\\n'));", "  S.lang = __scL;\n  b.wa = waLink(lines.join('\\n'));");
/* Google title + description: English in the file; the server (functions/_middleware.js) swaps them per domain / ?lang, the browser per chosen language */
{
  const SEO = (new Function(read(path.join(__dirname, "seo.js")) + "; return SC_SEO;"))();
  const esc = v => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  rep("<title>Self Care Pharmacy – Product Catalogue</title>", "<title>" + esc(SEO.en.title) + "</title>");
  const m = html.match(/<meta name="description" content="[^"]*">/);
  if(!m) failures.push("seo: description"); else html = html.replace(m[0], '<meta name="description" content="' + esc(SEO.en.desc) + '">');
}
/* logo in the header */
rep("<header>\n  <div class=\"logo\">", "<header>\n  <span class=\"sc-hlogo\" role=\"img\" aria-label=\"Self Care\"></span>\n  <div class=\"logo\">");
/* bottom navigation bar (mobile): home · basket · my orders · WhatsApp */
rep('<a class="floating-wa" href="https://wa.me/201501401776"', `<nav class="sc-bnav" aria-label="Menu">
  <button type="button" class="sc-bn-item sc-bn-active" onclick="scNavHome()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg><span id="scNavHomeL">Home</span></button>
  <button type="button" class="sc-bn-item" onclick="scNavSearch()"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span id="scNavSearchL">Search</span></button>
  <button type="button" class="sc-bn-cart" onclick="openCart()" aria-label="Basket"><span class="sc-bn-circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg><b id="scNavBadge">0</b></span><span id="scNavCartL">Basket</span></button>
  <button type="button" class="sc-bn-item" onclick="scOpenMyOrders()"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg><span id="scNavOrdersL">My Orders</span></button>
  <a class="sc-bn-item sc-bn-wa" href="https://wa.me/201501401776" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5l1.3-4.6A8.5 8.5 0 1 1 8.2 19.3z"/></svg><span id="scNavHelpL">WhatsApp</span></a>
</nav>
<a class="floating-wa" href="https://wa.me/201501401776"`);
repIn("updateStickyCart", "    if(bar){ bar.classList.toggle(\"show\", total > 0); }", "    if(bar){ bar.classList.toggle(\"show\", total > 0); }\n    try{ scNavUpdate(); }catch(_){}");
/* language + currency: a compact chip inside the orange header */
rep('  <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch">', '  <button type="button" class="sc-hchip" id="scPrefsChip" onclick="scOpenPrefs()" aria-haspopup="dialog" aria-label="Language &amp; currency"><span id="scPrefsChipText">🇬🇧 EN · £</span><span class="sc-hchip-arrow" aria-hidden="true">▾</span></button>\n  <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch">');
repIn("renderGrid", "fastLoadMoreHtml(renderedCount,totalMatches);", "fastLoadMoreHtml(renderedCount,totalMatches);\n  try{ scFitNames(); scFoldFix(); }catch(e){}");
/* ===== checkout v2: needed fields first, compact time, sticky total + button ===== */
repIn("renderCheckout", "    btn.title = !hotelValid ? T(\"hotelInvalid\") : T(\"phoneInvalid\");\n    return;", "    btn.title = !hotelValid ? T(\"hotelInvalid\") : T(\"phoneInvalid\");\n    return;");
repIn("renderCheckout", "  btn.title = \"\";\n", "  btn.title = \"\";\n");
repIn("renderCheckout", "  const deliveryDay = document.getElementById(\"deliveryDay\")?.value || \"Today\";", "  try{ scCoSum(itemCount, finalTotal); }catch(e){}\n  const deliveryDay = document.getElementById(\"deliveryDay\")?.value || \"Today\";");
(function(){
  const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + 1); if(i < 0 || j < 0){ failures.push("checkout cut: " + a.slice(0, 60)); return null; } return [i, j]; };
  const A = '<div class="checkout-section">\n      <label id="checkoutHotelLabel">';
  const G = '<div class="checkout-grid checkout-date-time-grid">';
  const P = '\n    <div class="checkout-section">\n      <label id="paymentLabel">';
  const PH = '\n    <div class="checkout-section">\n      <label id="checkoutPhoneLabel">';
  const N = '\n    <div class="checkout-section note-section">';
  const TB = '\n    <div class="checkout-total-box" id="checkoutTotalBox"></div>';
  const END = '\n  </div>\n</div>\n<div id="orderConfirmOverlay"';
  const i0 = html.indexOf(A), iG = html.indexOf(G, i0), iP = html.indexOf(P, iG), iPH = html.indexOf(PH, iP), iN = html.indexOf(N, iPH), iTB = html.indexOf(TB, iN), iE = html.indexOf(END, iTB);
  if([i0, iG, iP, iPH, iN, iTB, iE].some(x => x < 0)){ failures.push("checkout v2 anchors " + [i0, iG, iP, iPH, iN, iTB, iE].join(",")); return; }
  const hotel = html.slice(i0, iG), grid = html.slice(iG, iP), pay = html.slice(iP, iPH), phone = html.slice(iPH, iN), note = html.slice(iN, iTB);
  let tail = html.slice(iTB, iE);
  const help = '<div class="checkout-help" id="checkoutConfirmHelp">';
  const ih = tail.indexOf(help); const ihE = tail.indexOf('</div>', ih) + 6; const helpHtml = tail.slice(ih, ihE); tail = tail.slice(0, ih) + tail.slice(ihE);
  const ib = tail.indexOf('<a id="finalCheckoutBtn"'), ibE = tail.indexOf('</a>', ib) + 4;
  tail = tail.slice(0, ib) + '<div class="sc-co-btnwrap" onclick="scCoFocusMissing()">' + tail.slice(ib, ibE) + '</div>' + tail.slice(ibE);
  const when = '\n    <button type="button" class="sc-co-when" id="scCoWhen" onclick="scToggleWhen()"><span class="sc-co-when-l"><span id="scCoWhenLabel">Delivery time</span><b>📅 <span id="scCoWhenText">Today · 12 PM</span></b></span><span class="sc-co-edit"><span id="scCoWhenEdit">Change</span> ✎</span></button>\n    ';
  const foot = '\n    <div class="sc-co-foot">\n    <button type="button" class="sc-co-sum" id="scCoSum" onclick="scToggleCoDetails()"><span id="scCoSumText" class="sc-co-sumtext"></span><span class="sc-co-more">▾</span></button>' + tail + '\n    ' + helpHtml + '\n    </div>';
  html = html.slice(0, i0) + hotel.replace(/\s+$/, '') + note + phone + when + grid.replace(/^\s+/, '') + pay + foot + html.slice(iE);
})();
rep("\n</head>\n", `\n<style id="sc-prefs-css">
.sc-prefs-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;max-width:none;margin:0;padding:9px 16px;border:0;border-radius:0;background:linear-gradient(135deg,#4e1f4d,#6b2c69);color:#fff;font:inherit;cursor:pointer;box-shadow:0 4px 12px rgba(78,31,77,.18);-webkit-tap-highlight-color:transparent;text-align:left;position:relative;z-index:1}
.sc-prefs-bar-label{font-size:11px;font-weight:800;color:rgba(255,255,255,.72);text-transform:uppercase;letter-spacing:.5px;line-height:1.2}
.sc-prefs-bar-val{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:900;color:#fff;white-space:nowrap}
.sc-prefs-bar-arrow{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:11px}
@media(max-width:380px){.sc-prefs-bar-label{font-size:9.5px}.sc-prefs-bar-val{font-size:12.5px}}
@media(min-width:700px){.sc-prefs-bar{justify-content:center;gap:18px}}
#filters{position:relative}
#filters .sc-cat-arrow{position:absolute;top:10px;height:88px;width:42px;border:none;display:none;align-items:center;justify-content:center;cursor:pointer;z-index:3;padding:0;-webkit-tap-highlight-color:transparent;font-size:0}
#filters .sc-cat-arrow span{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#5B295A;color:#fff;font-size:17px;font-weight:900;box-shadow:0 4px 12px rgba(91,41,90,.3)}
#filters .sc-cat-next{right:0;background:linear-gradient(90deg,rgba(247,242,247,0),rgba(247,242,247,.96) 55%)}
#filters.sc-cat-more .sc-cat-next{display:flex}
#filters .sc-cat-next span{animation:scNudge 1.2s ease-in-out 3}
@keyframes scNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
@media(min-width:700px){#filters .sc-cat-arrow{height:110px}}
.sc-vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sc-sheet-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(30,12,30,.42);display:none;align-items:flex-end;justify-content:center}
.sc-sheet-backdrop.show{display:flex}
.sc-sheet{width:100%;max-width:520px;background:#fff;border-radius:22px 22px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.18);animation:scSheetUp .22s ease-out}
@keyframes scSheetUp{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}
.sc-sheet-grab{width:40px;height:4px;border-radius:9px;background:#e3d6e3;margin:4px auto 10px}
.sc-sheet-title{font-size:12px;font-weight:900;color:#7a6a7a;text-transform:uppercase;letter-spacing:.5px;margin:8px 2px 8px}
.sc-sheet-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.sc-pref-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:54px;padding:6px 4px;border-radius:14px;border:1px solid #eadcea;background:#fff;color:#3b1d3b;font:inherit;cursor:pointer}
.sc-pref-btn b{font-size:15px;font-weight:900;line-height:1}
.sc-pref-btn small{font-size:10.5px;font-weight:700;color:#8a7a8a;line-height:1.1;text-align:center}
.sc-pref-btn.active{background:#5B295A;border-color:#5B295A;color:#fff}
.sc-pref-btn.active small{color:rgba(255,255,255,.8)}
.sc-pref-btn,.sc-pref-btn:focus,.sc-pref-btn:focus-visible,.sc-pref-btn:active{-webkit-tap-highlight-color:transparent;outline:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}
.sc-sheet-done{display:block;width:100%;margin-top:14px;height:46px;border:none;border-radius:14px;background:#D6501B;color:#fff;font:inherit;font-size:15px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent}
#scArBtn{display:none!important}
header .cart-btn{white-space:nowrap;overflow:visible!important;position:relative}header .cart-btn .cart-badge{z-index:5}#cartBtnText{overflow:hidden;text-overflow:ellipsis}
</style>
</head>
`);

/* Czech names/descriptions travel with the English catalog (matched by product code) */
const czByCode = new Map(JSON.parse(read(path.join(CZ_DIR, "products-cz.json"))).map(p => [p.code, p]));
const enProducts = JSON.parse(read(path.join(EN_DIR, "products-en.json")));
let matched = 0;
for(const p of enProducts){ const c = czByCode.get(p.code); if(!c) continue; matched++; p.name_cz = c.name; p.desc_cz = c.desc; p.cat_cz = c.cat; }
if(matched < enProducts.length * 0.95) failures.push("catalog match too low: " + matched);
/* data fixes (18/10, T): SC301 / SC294 are black seed (Czech said "Hadí olej" = snake oil); 2649 English name was Czech */
{
  const fx = { "SC301": { name_cz: "Egy Bio olej z černého kmínu" },
               "SC294": { name_cz: "Lotus vlasové ampule s černým kmínem", desc_cz: "Vlasové ampule s černým kmínem pro intenzivní péči o oslabené vlasy a podporu zdravějšího vzhledu." },
               "SC207": {"desc": "Capsules used for cramps, bloating and abdominal pain related to indigestion.", "desc_cz": "Kapsle pro úlevu od křečí, nadýmání a bolestí břicha spojených s podrážděným trávením."},
               "SC384": {"desc": "Melatonin 3 mg oral films used for short-term sleep support and jet lag-related sleep difficulty."},
               "SC420": {"desc": "Antispasmodic oral films used for abdominal cramps and intestinal spasms.", "desc_cz": "Orální filmy proti křečím břicha, nadýmání a střevnímu diskomfortu. Užívejte dle doporučení lékárníka."},
               "SC310": {"desc": "SPF 6 bronzing body lotion used to support tanning with very low protection."},
               "SC336": {"desc": "Bobana marine collagen and vitamin C cream used to brighten dull skin and support an even-looking tone."},
               "SC356": {"desc": "Bobana charcoal scrub used to cleanse pores, reduce excess oil and refresh skin."},
               "SC249": {"desc": "Moroccan olive soap used to cleanse the skin with a gentle exfoliating effect for a smoother feel after bathing."},
               "SC250": {"desc": "Moroccan argan soap used to cleanse, soften and care for the skin in the shower or during a hammam ritual."},
               "2649":  { name: "Rani-F Famotidine 20 mg 6 effervescent sachets" } };
  let n = 0; for(const p of enProducts){ const f = fx[p.code]; if(f){ Object.assign(p, f); n++; } }
  if(n !== 11) failures.push("data fixes: " + n);
}
{
  const m = html.match(/CATALOG_PRODUCTS_URL = "products-en\.json\?v=(\d+)"/);
  if(!m) failures.push("catalog url"); else html = html.replace(m[0], `CATALOG_PRODUCTS_URL = "products-en.json?v=${m[1]}m1"`);
}

{ const m = html.match(/<div class="sc-version-stamp" aria-hidden="true">(en-v[\d.]+)<\/div>/); if(!m) failures.push("version stamp"); else html = html.replace(m[0], `<div class="sc-version-stamp" aria-hidden="true">m1 · ${m[1]}</div>`); }

/* ---------- look: smaller WhatsApp bubble, no version stamp ---------- */
rep("\n</body>\n", `\n<style id="sc-look-v1">
@media(max-width:899px){#grid.sc-fold-wait > .card:nth-child(n+3){visibility:hidden!important}}
/* tighter first screen: the first product row fits above the bottom bar */
@media(max-width:899px){
  html body .controls{margin-top:0!important;margin-bottom:0!important;padding-top:10px!important;padding-bottom:0!important}
  html body #filters{margin-top:8px!important;margin-bottom:2px!important;padding-top:0!important}
  html body #filters .main-filters{gap:8px 6px!important;padding:4px 0 2px!important}
  html body #filters .main-filters .main-filter-btn,html body #filters .main-filters .main-filter-btn.tourist-main,html body #filters .main-filters .main-filter-btn[onclick*="mobility"]{min-height:76px!important;padding:5px 2px 6px!important}
  html body #filters .main-filters .main-filter-btn .cat-icon.cat-img,html body #filters .main-filters .main-filter-btn.tourist-main .cat-icon.cat-img{width:50px!important;height:38px!important;flex:0 0 38px!important;margin:0 auto 3px!important}
  html body #grid{margin-top:6px!important;gap:10px!important}
  html body #grid .card .card-img-wrap{height:112px!important;min-height:112px!important;padding:6px 10px!important}
  html body #grid .card .card-body{padding-top:8px!important;padding-bottom:10px!important;gap:6px!important}
  html body #grid .card-use-for{margin:0!important}
  html body #grid .card-footer{gap:6px!important}
  html body #grid .card-price{min-height:0!important;padding-top:6px!important;padding-bottom:6px!important}
  html body #grid .qty-pill{margin-top:0!important}
}
/* language chip inside the header */
html body header .sc-hchip{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:7px 10px 7px 12px;border-radius:999px;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.35);color:#fff;font:inherit;font-size:13.5px;font-weight:900;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;flex:0 0 auto}
html body header .sc-hchip-arrow{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#fff;color:#c24a17;font-size:9px}
html body header > div:last-child{margin-left:10px!important}
@media(max-width:340px){html body header .sc-hchip{padding:6px 8px;font-size:12px}}
/* product names: two lines (long names get a smaller font and may use three short lines in the same height) */
html body #grid .card-name{height:38px!important;min-height:38px!important;max-height:38px!important;-webkit-line-clamp:2!important}

/* bottom navigation bar (phones and tablets) */
.sc-bnav{display:none}
@media(max-width:899px){
  .sc-bnav{display:grid;grid-template-columns:1fr 1fr 1.15fr 1fr 1fr;align-items:end;position:fixed;left:0;right:0;bottom:0;z-index:950;background:#fff;border-top:1px solid #ece7e3;box-shadow:0 -6px 18px rgba(31,47,82,.07);padding:6px 6px calc(6px + env(safe-area-inset-bottom));-webkit-tap-highlight-color:transparent}
  .sc-bnav .sc-bn-item{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;padding:4px 0;font:inherit;font-size:10.5px;white-space:nowrap;min-width:0;font-weight:800;color:#7a7f8c;text-decoration:none;cursor:pointer}
  .sc-bnav .sc-bn-item svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .sc-bnav .sc-bn-active{color:#1f2f52}
  .sc-bnav .sc-bn-wa{color:#128c7e}
  .sc-bnav .sc-bn-cart{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;padding:0;font:inherit;font-size:11.5px;font-weight:900;color:#1f2f52;cursor:pointer}
  .sc-bnav .sc-bn-circle{position:relative;display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-top:-26px;border-radius:50%;background:linear-gradient(135deg,#c24a17,#dc5a22);border:4px solid #fff;box-shadow:0 6px 16px rgba(194,74,23,.35)}
  .sc-bnav .sc-bn-circle svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .sc-bnav #scNavBadge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#1f2f52;color:#fff;font-size:11px;line-height:20px;text-align:center;border:2px solid #fff;display:none}
  .sc-bnav #scNavBadge.show{display:block}
  html body header > div:last-child{display:none!important}
  html body .floating-wa,html body #stickyCartBar,html body .sticky-cart-bar{display:none!important}
  html body{padding-bottom:86px!important}
  body.cart-open .sc-bnav,body:has(#cartPanel.open) .sc-bnav,body:has(#modalOverlay.open) .sc-bnav,body:has(#kitModalOverlay.open) .sc-bnav,body:has(#checkoutOverlay.open) .sc-bnav,body:has(#checkoutOverlay.show) .sc-bnav{display:none!important}
}
/* header: logo + a little shorter */
html body header{padding:9px 14px!important;justify-content:flex-start!important;gap:10px!important;min-height:0!important}
html body header .sc-hlogo{flex:0 0 44px;width:44px;height:44px;background:url(/sc-logo-white.png?v=1) center/contain no-repeat;border:0;border-radius:0;box-shadow:none}
html body header > div:last-child{margin-left:auto!important;gap:5px!important}
html body header .cart-btn{padding:6px 14px!important;min-height:0!important}
html body header #myOrdersBtn{padding:4px 10px!important}
html body header .logo{font-size:17px!important;white-space:nowrap!important;line-height:1.15!important}
@media(max-width:380px){html body header .logo{font-size:15px!important}}
@media(max-width:340px){html body header .sc-hlogo{flex-basis:34px;width:34px;height:34px}html body header .logo{font-size:13.5px!important}}
/* product cards stay still: no lift, no border/shadow change, no image zoom on hover/tap */
html body #grid .card,html body #grid .card:hover,html body #grid .card:active,html body #grid .card:focus,html body #grid .card:focus-within{transform:none!important;transition:none!important;border-color:rgb(221,226,234)!important;box-shadow:0 10px 24px rgba(31,49,81,.06)!important;outline:none!important}
html body #grid .card .card-img-wrap img{transition:none!important}
html body #grid .card:hover .card-img-wrap img,html body #grid .card:active .card-img-wrap img{transform:scale(.93)!important}
html body #grid .card:hover .card-img-wrap img.zoom-out,html body #grid .card:active .card-img-wrap img.zoom-out{transform:scale(.82)!important}
header{background:linear-gradient(135deg,#c24a17 0%,#dc5a22 100%)!important}
/* lighter + / − on product cards */
#grid .qty-pill{height:36px!important;min-height:36px!important;padding:3px!important;border:0!important;background:#f5eff5!important;box-shadow:none!important;border-radius:999px!important}
#grid .qty-pill.active{background:#eee0ee!important;box-shadow:none!important}
#grid .qty-pill-btn{width:30px!important;height:30px!important;min-width:30px!important;box-shadow:none!important;border:0!important}
#grid .qty-pill-btn:first-child{background:#fff!important;color:#5B295A!important}
#grid .qty-pill-btn:last-child{background:#5B295A!important}
#grid .qty-pill-btn .qty-symbol{font-size:17px!important}
#grid .qty-pill-num{font-size:15px!important;font-weight:900!important}
#checkoutOverlay .payment-option span{font-size:13.5px!important;font-weight:900!important;text-align:center!important;flex:0 1 auto!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.15!important}

/* ===== checkout v2 ===== */
#checkoutOverlay .checkout-sheet{padding:14px 14px 0!important;background:#fff!important}
#checkoutOverlay .checkout-head{padding:0 2px 8px!important;margin-bottom:4px!important;border-bottom:1px solid #f1e8f1!important}
#checkoutOverlay .checkout-head h2{font-size:19px!important;color:#3b1d3b!important}
#checkoutOverlay .checkout-mini{display:none!important}
#checkoutOverlay .checkout-head{display:flex!important;align-items:center!important;justify-content:space-between!important}
#checkoutOverlay .checkout-head h2{margin:0!important;line-height:1.2!important}
#checkoutOverlay .close-checkout{background:#f6eff6!important;color:#5B295A!important;border:0!important}
#checkoutOverlay .checkout-section{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:10px 2px!important;margin:0!important;border-bottom:1px solid #f3ecf3!important}
#checkoutOverlay .checkout-section label{text-align:left!important;font-size:12.5px!important;font-weight:800!important;color:#5d4a5d!important;margin-bottom:6px!important}
#checkoutOverlay .checkout-input{background:#fbf8fb!important;border:1.5px solid #ecdfec!important;border-radius:12px!important;height:44px!important;font-size:15px!important;color:#2b1a2b!important;box-shadow:none!important}
#checkoutOverlay .checkout-input:focus{border-color:#A94AA7!important;background:#fff!important;outline:none!important;box-shadow:0 0 0 3px rgba(169,74,167,.12)!important}
#checkoutOverlay .checkout-note-field{text-align:left!important}
#checkoutOverlay .phone-row{grid-template-columns:104px 1fr!important;gap:8px!important}
#checkoutOverlay .checkout-input,#checkoutOverlay .phone-code,#checkoutOverlay .phone-number{height:44px!important;min-height:44px!important}
#checkoutOverlay .checkout-section label{margin-bottom:6px!important}
#checkoutOverlay .phone-code{font-size:14px!important}
#checkoutOverlay .checkout-help{text-align:left!important;color:#8a7a8a!important;opacity:1!important}
#checkoutOverlay .sc-co-miss{border-color:#D6501B!important;box-shadow:0 0 0 3px rgba(214,80,27,.15)!important}
.sc-co-when{display:flex;align-items:center;justify-content:space-between;width:100%;gap:10px;background:transparent;border:0;border-bottom:1px solid #f3ecf3;padding:12px 2px;font:inherit;cursor:pointer;text-align:left;color:#2b1a2b}
.sc-co-when-l{display:flex;flex-direction:column;gap:3px}
.sc-co-when-l>span{font-size:12.5px;font-weight:800;color:#5d4a5d}
.sc-co-when-l b{font-size:15px;font-weight:900}
.sc-co-edit{font-size:13px;font-weight:900;color:#A94AA7;white-space:nowrap}
.sc-co-when.sc-open .sc-co-edit{opacity:.5}
#checkoutOverlay .sc-co-when{display:none!important}
#checkoutOverlay .checkout-date-time-grid{display:grid!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:4px 0 6px!important;margin:0!important;border-bottom:1px solid #f3ecf3!important;border-radius:0!important}
#checkoutOverlay .checkout-date-time-grid.sc-open{display:grid!important}
#checkoutOverlay .checkout-date-time-grid .checkout-section{border:0!important;padding:4px 2px!important}
#checkoutOverlay .payment-options{display:flex!important;gap:8px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
#checkoutOverlay .payment-option{flex:1;display:flex!important;align-items:center;justify-content:center;min-height:40px!important;border:1.5px solid #ecdfec!important;border-radius:999px!important;background:#fff!important;font-size:14px!important;font-weight:900!important;color:#5B295A!important;box-shadow:none!important;cursor:pointer}
#checkoutOverlay .payment-option{height:46px!important;min-height:46px!important;padding:0 8px!important;white-space:normal!important;justify-content:center!important;gap:0!important;border-radius:999px!important;position:relative!important;transition:none!important;transform:none!important;-webkit-tap-highlight-color:transparent!important;user-select:none}
#checkoutOverlay .payment-option input{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;opacity:0!important;cursor:pointer}
#checkoutOverlay .payment-option:active,#checkoutOverlay .payment-option:focus-within{transform:none!important;outline:none!important}
#checkoutOverlay .payment-option:has(input:checked){background:#5B295A!important;border-color:#5B295A!important;color:#fff!important}
#checkoutOverlay .payment-note{text-align:left!important;color:#8a7a8a!important}
.sc-co-foot{position:sticky;bottom:0;z-index:4;background:#fff;margin:6px -14px 0;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #f1e8f1;box-shadow:0 -8px 20px rgba(91,41,90,.06)}
.sc-co-sum{display:flex;align-items:center;width:100%;gap:8px;background:transparent;border:0;padding:0 2px 8px;font:inherit;cursor:pointer;color:#2b1a2b}
.sc-co-sumtext{flex:1;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.sc-co-count{font-size:13px;font-weight:800;color:#7b667b}
.sc-co-total b{font-size:18px;font-weight:900;color:#3b1d3b}
.sc-co-total small{font-size:12.5px;font-weight:800;color:#8a7a8a}
.sc-co-more{font-size:12px;color:#A94AA7;transition:transform .2s}
.sc-co-sum.sc-open .sc-co-more{transform:rotate(180deg)}
#checkoutOverlay .checkout-total-box{display:none!important;background:#fbf8fb!important;border:0!important;box-shadow:none!important;margin:0 0 8px!important}
#checkoutOverlay .checkout-total-box.sc-open{display:block!important}
#checkoutOverlay .final-checkout-btn{height:50px!important;border-radius:16px!important;font-size:15px!important}
#checkoutOverlay .final-checkout-btn.sc-co-wait{background:#f3e9f3!important;color:#5B295A!important;box-shadow:none!important;border:1.5px dashed #d9bfd8!important}
.sc-co-btnwrap{cursor:pointer}
.sc-co-foot #checkoutConfirmHelp{display:none!important}

button,a,.card,.card-img-wrap,.qty-pill,.qty-pill-btn{-webkit-tap-highlight-color:transparent!important}
.qty-pill-btn:focus,.qty-pill-btn:focus-visible,.qty-pill-btn:active{outline:none!important}
#grid .card-name{height:54px!important;min-height:54px!important;max-height:54px!important;-webkit-line-clamp:3!important;overflow-wrap:break-word;hyphens:manual!important}
#grid .card-use-for{height:38px!important;min-height:38px!important;max-height:38px!important}
#grid .card:not(.kit-card){height:auto!important}

.floating-wa{width:46px!important;height:46px!important;right:12px!important;bottom:14px!important;font-size:21px!important;border-width:2px!important;box-shadow:0 6px 16px rgba(37,211,102,.32)!important}
body{padding-bottom:64px}
.sc-version-stamp{display:none!important}
#filters .main-filters{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;overflow:visible!important;gap:12px 6px!important;padding:10px 0 6px!important}
#filters .sc-cat-arrow{display:none!important}
@media(max-width:699px){html #filters .main-filters{grid-auto-flow:row dense!important}html #filters .main-filters .main-filter-btn.tourist-main{grid-column:4/5!important;grid-row:1/2!important}html #filters .main-filters .main-filter-btn[onclick*="mobility"]{grid-column:4/5!important;grid-row:2/3!important}}
html:not(.sc-ar) .sub-filter-panel::before{content:var(--sc-browse,"Browse by category")!important}
html:not(.sc-ar) .sub-filter-panel::after{content:var(--sc-swipe,"Swipe →")!important}
#filters .main-filters::-webkit-scrollbar{display:none}
#filters .main-filters .main-filter-btn,#filters .main-filters .main-filter-btn.tourist-main,#filters .main-filters .main-filter-btn[onclick*="mobility"]{flex:none!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:84px!important;height:auto!important;grid-column:auto!important;grid-row:auto!important;padding:6px 2px 7px!important;margin:0!important;position:relative!important}
#filters .main-filters .main-filter-btn .cat-icon.cat-img,#filters .main-filters .main-filter-btn.tourist-main .cat-icon.cat-img{width:56px!important;height:44px!important;flex:0 0 44px!important;margin:0 auto 4px!important;background:none!important;border-radius:0!important;overflow:visible!important}
#filters .main-filters .main-filter-btn .cat-icon.cat-img img{width:100%!important;height:100%!important;object-fit:contain!important;border-radius:0!important;filter:drop-shadow(0 3px 5px rgba(91,41,90,.12))}
#filters .main-filters .main-filter-btn .cat-name,#filters .main-filters .main-filter-btn.tourist-main .cat-name{font-size:10px!important;line-height:1.12!important;letter-spacing:-.15px!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:manual!important;max-width:100%;padding:0 1px!important}
#filters .main-filters .main-filter-btn .cat-hot{top:-7px!important;font-size:7.5px!important;padding:1px 5px!important;white-space:nowrap}
@media(min-width:700px){#filters .main-filters{grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:8px!important}#filters .main-filters .main-filter-btn,#filters .main-filters .main-filter-btn.tourist-main,#filters .main-filters .main-filter-btn[onclick*="mobility"]{flex:1 1 0!important;width:auto!important;min-height:110px!important}#filters .main-filters .main-filter-btn .cat-icon.cat-img,#filters .main-filters .main-filter-btn.tourist-main .cat-icon.cat-img{width:84px!important;height:66px!important;flex-basis:66px!important}#filters .main-filters .main-filter-btn .cat-name,#filters .main-filters .main-filter-btn.tourist-main .cat-name{font-size:12.5px!important}}
.final-checkout-btn{background:linear-gradient(135deg,#5B295A,#9A2D98)!important;box-shadow:0 12px 26px rgba(91,41,90,.22)!important}
</style>
</body>
`);

/* ---------- only orange + purple: every green/teal colour gets the brand purple hue (same lightness), WhatsApp's own green stays ---------- */
{
  const KEEP = new Set(["25d366", "128c7e", "1db954"]);
  const PURPLE_H = 301 / 360;
  const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if(mx !== mn){ const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
  const hsl2rgb = (h, s, l) => { if(!s) return [l, l, l].map(v => Math.round(v * 255)); const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { if(t < 0) t += 1; if(t > 1) t -= 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; }; return [f(h + 1/3), f(h), f(h - 1/3)].map(v => Math.round(v * 255)); };
  const isGreen = (r, g, b) => { const [h, s, l] = rgb2hsl(r, g, b); return s > .18 && h >= .22 && h <= .55 && l > .08 && l < .97; };
  const toPurple = (r, g, b) => { const [h, s, l] = rgb2hsl(r, g, b); return hsl2rgb(PURPLE_H, Math.min(s, .55), l); };
  let n = 0;
  html = html.replace(/#([0-9a-fA-F]{6})\b/g, (m, hx) => {
    if(KEEP.has(hx.toLowerCase())) return m;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hx.slice(i, i + 2), 16));
    if(!isGreen(r, g, b)) return m;
    n++; return "#" + toPurple(r, g, b).map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, r, g, b) => {
    r = +r; g = +g; b = +b;
    if((r === 37 && g === 211 && b === 102) || (r === 18 && g === 140 && b === 126)) return m;
    if(!isGreen(r, g, b)) return m;
    n++; const [a, c, d] = toPurple(r, g, b); return m.replace(/\(\s*\d+\s*,\s*\d+\s*,\s*\d+/, `(${a},${c},${d}`);
  });
  if(n < 100) failures.push("green → purple count " + n);
}

/* ---------- two colours: orange = brand (header, badges), navy = everything the customer taps or reads (prices, buttons); every purple becomes navy; WhatsApp green stays ---------- */
rep("\n</body>\n", `\n<style id="sc-orange-navy">
.sc-prefs-bar{background:#fff4ec!important;box-shadow:0 4px 12px rgba(0,0,0,.05)!important;border-bottom:1px solid #f3dccb!important}
.sc-prefs-bar-label{color:#8a6a5a!important}
.sc-prefs-bar-val{color:#1f2f52!important}
.sc-prefs-bar-arrow{background:#1f2f52!important;color:#fff!important}
html body #grid .card .badge-top,html body .badge-top,#filters .main-filters .main-filter-btn .cat-hot,.cat-hot{background:#D6501B!important;color:#fff!important;border-color:#D6501B!important}
header .cart-badge{background:#1f2f52!important;color:#fff!important;border-color:#fff!important}
</style>\n</body>\n`);
{
  const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if(mx !== mn){ const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
  const hsl2rgb = (h, s, l) => { if(!s) return [l, l, l].map(v => Math.round(v * 255)); const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { if(t < 0) t += 1; if(t > 1) t -= 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; }; return [f(h + 1/3), f(h), f(h - 1/3)].map(v => Math.round(v * 255)); };
  const tr = (r, g, b) => { const [h, s, l] = rgb2hsl(r, g, b);
    if(!(s > .12 && h >= .70 && h <= .92 && l > .04 && l < .985)) return null;
    if(l > .86) return hsl2rgb(215/360, Math.min(s, .45), l);
    return hsl2rgb(218/360, Math.min(Math.max(s, .45), .6), Math.min(l * .85, .32)); };
  const KEEP = new Set(["25d366", "128c7e", "1db954"]);
  let n = 0;
  html = html.replace(/#([0-9a-fA-F]{6})\b/g, (m, hx) => { if(KEEP.has(hx.toLowerCase())) return m;
    const t = tr(...[0, 2, 4].map(i => parseInt(hx.slice(i, i + 2), 16))); if(!t) return m; n++; return "#" + t.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase(); })
  .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, r, g, b) => { r = +r; g = +g; b = +b;
    if((r === 37 && g === 211 && b === 102) || (r === 18 && g === 140 && b === 126)) return m;
    const t = tr(r, g, b); if(!t) return m; n++; return m.replace(/\(\s*\d+\s*,\s*\d+\s*,\s*\d+/, `(${t[0]},${t[1]},${t[2]}`); });
  if(n < 100) failures.push("navy palette count " + n);
}

/* ---------- category icons (files in public/cat, from merge/cat) ---------- */
replaceDecl("mainCategoryImages", "const mainCategoryImages = {\n" + ["top","medicine","supplements","skin","hair","sun","tourist"].map(k => `  ${k}: "/cat/${k}.webp?v=3"`).join(",\n") + "\n};");
{
  const m = html.match(/mainCategoryImages\.mobility = '[^']*'/);
  if(!m) failures.push("mobility icon"); else html = html.replace(m[0], "mainCategoryImages.mobility = '/cat/mobility.webp?v=3'");
}

/* branch per language (Czech site used "Self Care", English "Self Care 2") */
rep('const forThisBranch = (br === "ALL" || br === BRANCH);', 'const forThisBranch = (br === "ALL" || br === scBranch());');
rep('    branch: BRANCH\n', '    branch: scBranch()\n');

/* room number: the merged checkout has one field (#checkoutNote) → it must reach the WhatsApp message */
repIn("getOrderDetails", 'const room = document.getElementById("checkoutRoom")?.value.trim() || "Not provided";', 'const room = (document.getElementById("checkoutRoom")?.value.trim() || document.getElementById("checkoutNote")?.value.trim()) || "Not provided";');

/* phone number: Russian "8 9xx…" → 7 9xx…; a typed number counts as already-international only when it is long enough (fixes +7 / +48 short local numbers) */
repIn("renderCheckout", '  else if(phoneLocal.indexOf(phoneCode) === 0 && phoneLocal.length >= phoneCode.length + 6) phoneRaw = phoneLocal;',
 '  else if(phoneCode === "7" && /^8\\d{10}$/.test(phoneLocal)) phoneRaw = "7" + phoneLocal.slice(1);\n  else if(phoneLocal.indexOf(phoneCode) === 0 && phoneLocal.length >= (phoneCode === "7" ? 11 : phoneCode.length + 9)) phoneRaw = phoneLocal;');

/* (keyword-description fixes removed: those functions are no longer in the page) */

/* names per language for the fixed products (beat the Czech name coming back from the database) */
rep("var SC_NAME_I18N = {", 'var SC_NAME_I18N = {"SC301": {"cs": "Egy Bio olej z černého kmínu", "sk": "Egy Bio olej z čiernej rasce", "pl": "Egy Bio olej z czarnuszki", "ru": "Egy Bio масло черного тмина", "ua": "Egy Bio олія чорного кмину", "de": "Egy Bio Schwarzkümmelöl"}, "SC294": {"cs": "Lotus vlasové ampule s černým kmínem", "sk": "Lotus vlasové ampulky s čiernou rascou", "pl": "Lotus ampułki do włosów z czarnuszką", "ru": "Lotus ампулы для волос с черным тмином", "ua": "Lotus ампули для волосся з чорним кмином", "de": "Lotus Haarampullen mit Schwarzkümmel"}, "2649": {"ru": "Rani-F Famotidin 20 мг 6 шипучих саше", "ua": "Rani-F Famotidin 20 мг 6 шипучих саше", "de": "Rani-F Famotidin 20 mg 6 Brausebeutel"}, ');

/* exchange rates: start from the last live rates seen on this phone (then today's defaults), so "≈ $" does not jump on every refresh */
rep("let GBP_RATE = 70;\nlet USD_RATE_EN = 50;\nlet EUR_RATE_EN = 60;", "let GBP_RATE = 65;\nlet USD_RATE_EN = 45;\nlet EUR_RATE_EN = 55;\ntry{ (function(){ var c = JSON.parse(localStorage.getItem('scRatesV1') || 'null'); if(c){ if(c.g > 0) GBP_RATE = c.g; if(c.u > 0) USD_RATE_EN = c.u; if(c.e > 0) EUR_RATE_EN = c.e; } })(); }catch(e){}");
repIn("loadSharedCurrencyRates", "    const gbp=Number(map.rate_gbp);", "    const __before=[GBP_RATE,USD_RATE_EN,EUR_RATE_EN].join('|');\n    const gbp=Number(map.rate_gbp);");
repIn("loadSharedCurrencyRates", "    if(typeof requestGridRender===\"function\")smoothRenderGridSoon();", "    try{ localStorage.setItem('scRatesV1', JSON.stringify({g:GBP_RATE,u:USD_RATE_EN,e:EUR_RATE_EN})); }catch(e){}\n    if([GBP_RATE,USD_RATE_EN,EUR_RATE_EN].join('|')===__before) return;\n    if(typeof requestGridRender===\"function\")smoothRenderGridSoon();");

/* load speed: start downloading the catalog (products + kits) from the <head>, in parallel with the rest of the page,
   instead of after the whole 1 MB page has been read */
{
  const pm = html.match(/const CATALOG_PRODUCTS_URL = "([^"]+)";/), km = html.match(/const CATALOG_KITS_URL = "([^"]+)";/);
  if(!pm || !km) failures.push("catalog prefetch: urls");
  else {
    const early = `\n<script>window.__scCat=(function(){function g(u){return fetch(u,{cache:"force-cache"}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}try{return{p:g(${JSON.stringify(pm[1])}),k:g(${JSON.stringify(km[1])})}}catch(e){return null}})();</script>`;
    const hi = html.indexOf("\n</head>\n"); if(hi < 0) failures.push("catalog prefetch: head"); else html = html.slice(0, hi) + early + html.slice(hi);
    repIn("loadSplitCatalogData", 'fetch(CATALOG_PRODUCTS_URL, {cache:"force-cache"}).then(r => { if(!r.ok) throw new Error("products json failed"); return r.json(); }),',
      '((window.__scCat && window.__scCat.p) || Promise.resolve(null)).then(j => j || fetch(CATALOG_PRODUCTS_URL, {cache:"force-cache"}).then(r => { if(!r.ok) throw new Error("products json failed"); return r.json(); })),');
    repIn("loadSplitCatalogData", 'fetch(CATALOG_KITS_URL, {cache:"force-cache"}).then(r => { if(!r.ok) throw new Error("kits json failed"); return r.json(); })',
      '((window.__scCat && window.__scCat.k) || Promise.resolve(null)).then(j => j || fetch(CATALOG_KITS_URL, {cache:"force-cache"}).then(r => { if(!r.ok) throw new Error("kits json failed"); return r.json(); }))');
  }
}

/* ---------- no flash on load: every <style> that sits in the page body moves into <head> (same order, so the cascade is unchanged),
   and a non-English page stays hidden until its texts are switched (max 1.2 s) ---------- */
{
  const headEnd = html.indexOf("\n</head>\n");
  const hdr = html.indexOf("\n<header>");
  if(headEnd < 0 || hdr < 0){ failures.push("flash: anchors"); }
  else {
    const scripts = []; { const re = /<script\b[^>]*>[\s\S]*?<\/script>/g; let m; while((m = re.exec(html))) scripts.push([m.index, m.index + m[0].length]); }
    const inScript = i => scripts.some(([a, b]) => i > a && i < b);
    const moved = []; const re = /\n<style\b[^>]*>[\s\S]*?<\/style>/g; let m; const cut = [];
    while((m = re.exec(html))){ if(m.index < hdr || inScript(m.index)) continue; moved.push(m[0]); cut.push([m.index, m.index + m[0].length]); }
    for(let k = cut.length - 1; k >= 0; k--) html = html.slice(0, cut[k][0]) + html.slice(cut[k][1]);
    const pre = `\n<style id="sc-pre-css">html.sc-pre body{opacity:0}html body{transition:opacity .15s ease}</style>\n<script>(function(){try{var q=(location.search.match(/[?&]lang=([a-z]{2})/i)||[])[1],s=null;try{s=localStorage.getItem("sc_lang")}catch(e){}var l=(q||s||"").toLowerCase();if(!l&&/selfcare-cz\\.com$/.test(location.hostname))l="cs";if(!l){var L=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];for(var i=0;i<L.length;i++){var b=String(L[i]||"").toLowerCase().split("-")[0];if(/^(en|cs|sk|pl|ru|uk|de)$/.test(b)){l=b;break}}}if(!l&&/selfcare-cz\\.com$/.test(location.hostname))l="cs";if(l&&l!=="en"){document.documentElement.classList.add("sc-pre");setTimeout(function(){document.documentElement.classList.remove("sc-pre")},1200)}}catch(e){}})();</script>`;
    const he = html.indexOf("\n</head>\n");
    html = html.slice(0, he) + moved.join("") + pre + html.slice(he);
    if(moved.length < 5) failures.push("flash: moved only " + moved.length);
  }
}

/* browser bar in the header orange */
html = html.replace(/<meta name="theme-color" content="[^"]*">/, '<meta name="theme-color" content="#c24a17">');
/* ---------- 5. write ---------- */
if(failures.length){ console.error("BUILD FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
for(const s of inlineScripts(html)){ try{ parse(s.code); }catch(e){ console.error("syntax error in script at", s.start, e.message, s.code.slice(0, 80)); process.exit(1); } }
fs.mkdirSync(OUT_DIR, {recursive: true});
for(const f of fs.readdirSync(EN_DIR)) if(f !== "index.html") fs.copyFileSync(path.join(EN_DIR, f), path.join(OUT_DIR, f));
fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
fs.writeFileSync(path.join(OUT_DIR, "products-en.json"), JSON.stringify(enProducts));
for(const l of ["ru", "ua", "de", "pl", "sk"]){
  const o = {}; for(const code of Object.keys(DESC_TX)){ const v = DESC_TX[code] && DESC_TX[code][l]; if(v) o[code] = v; }
  if(Object.keys(o).length < 400){ console.error("BUILD FAILED: desc " + l + ": only " + Object.keys(o).length); process.exit(1); }
  fs.writeFileSync(path.join(OUT_DIR, "desc-" + l + ".json"), JSON.stringify(o));
}
fs.copyFileSync(path.join(__dirname, "sc-logo-white.png"), path.join(OUT_DIR, "sc-logo-white.png"));
/* Czech-only static pages keep working on the merged site */
for(const f of ["ochrana-osobnich-udaju.html"]) if(fs.existsSync(path.join(CZ_DIR, f))) fs.copyFileSync(path.join(CZ_DIR, f), path.join(OUT_DIR, f));
/* server side: per-domain / per-language <title>, description, html lang, canonical + hreflang (Cloudflare Pages Function, only for the page itself) */
{
  const fnDir = path.join(OUT_DIR, "..", "functions"); fs.mkdirSync(fnDir, {recursive: true});
  fs.writeFileSync(path.join(fnDir, "_middleware.js"), read(path.join(__dirname, "seo.js")).replace("var SC_SEO", "const SC_SEO") + "\n" + read(path.join(__dirname, "middleware.js")));
  fs.writeFileSync(path.join(OUT_DIR, "_routes.json"), JSON.stringify({version: 1, include: ["/", "/index.html"], exclude: []}));
}
fs.mkdirSync(path.join(OUT_DIR, "cat"), {recursive: true});
for(const f of fs.readdirSync(path.join(__dirname, "cat"))) fs.copyFileSync(path.join(__dirname, "cat", f), path.join(OUT_DIR, "cat", f));
console.log("ok", html.length, "bytes");
