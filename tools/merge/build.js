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
  "productDescSk", "productDescPl", "productDescRu", "productDescUa", "productDescDe", "SC_NAME_I18N", "window.SC_SK_USE", "pickAutoText"]
  .map(n => declSrc(CZ, n)).join("\n\n");
const czAutoCard = declSrc(CZ, "autoCardTextFromCategory")
  .replace("function autoCardTextFromCategory(", "function __autoCardTextI18n(")
  .replace("const label = cleanCatLabel(sub || cat || \"\");", "const label = catLabel(cleanCatLabel(sub || cat || \"\"));");
if(!/catLabel\(cleanCatLabel/.test(czAutoCard)) failures.push("czAutoCard label patch");

const coreScript = [
  "/* sc-i18n: generated by merge/build.js — edit merge/tx.js or merge/core.js, not this block */",
  "var SC_TX = " + JSON.stringify(SC_TX) + ";",
  "var SC_KIT_TX = " + JSON.stringify(KIT_TX) + ";",
  "var SC_CAT_I18N = " + JSON.stringify(SC_CAT_I18N) + ";",
  "var SC_MAIN_I18N = " + JSON.stringify(SC_MAIN_I18N) + ";",
  read(path.join(__dirname, "core.js")),
  czHelpers,
  czAutoCard
].join("\n");

/* insert the language core before the main script */
{
  const s = mainScript(); const tagStart = html.lastIndexOf("<script", s.codeStart);
  html = html.slice(0, tagStart) + `<script id="sc-i18n">\n${coreScript}\n</script>\n` + html.slice(tagStart);
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
replaceDecl("productUseFor", `function productUseFor(p){
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
replaceDecl("productBadge", getDecl("productBadge")
  .replace('label:"Tourist favorite"', 'label:T("badgeTourist")').replace('label:"Beach essential"', 'label:T("badgeBeach")')
  .replace('label:"Fast relief"', 'label:T("badgeFast")').replace('label:"Beauty pick"', 'label:T("badgeBeauty")').replace('label:"Best seller"', 'label:T("badgeBest")'));

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
rep("window.__SC_AR=!window.__SC_AR;\n   if(window.__SC_AR){", "window.__SC_AR=!window.__SC_AR;\n   if(window.__SC_AR && typeof displayLanguage!==\"undefined\" && displayLanguage!==\"en\"){ try{ setDisplayLanguage(\"en\"); }catch(e){} }\n   if(window.__SC_AR){");
/* scooter booking: German texts exist, everything else stays English; currency follows the page */
rep("S.lang = 'en'; S.cur = 'GBP'; S.custom = true;", "S.lang = (typeof displayLanguage !== 'undefined' && displayLanguage === 'de') ? 'de' : 'en'; S.cur = (typeof displayCurrency !== 'undefined' && ['GBP','EUR','USD'].indexOf(displayCurrency) >= 0) ? displayCurrency : (typeof displayCurrency !== 'undefined' && displayCurrency === 'CZK' ? 'EUR' : 'GBP'); S.custom = true;");
/* scooter booking: no currency picker of its own — it follows the site's currency buttons (Kč → €, the booking has no Kč rate) */
rep("  let seg = root.getElementById('curSeg');\n  if (!seg) {\n    seg = document.createElement('div'); seg.className = 'curseg'; seg.id = 'curSeg';", "  let seg = null;\n  if (false) {\n    seg = document.createElement('div'); seg.className = 'curseg'; seg.id = 'curSeg';");
rep("  seg.querySelectorAll('[data-cur]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cur === S.cur));\n", "");
rep("S.custom = true; S.end = ''; S.step = 2;", "S.custom = true; S.end = ''; S.step = 2;\nwindow.__scMobSync = function(){ S.lang = (typeof displayLanguage !== 'undefined' && displayLanguage === 'de') ? 'de' : 'en'; S.cur = (typeof displayCurrency !== 'undefined' && ['GBP','EUR','USD'].indexOf(displayCurrency) >= 0) ? displayCurrency : (typeof displayCurrency !== 'undefined' && displayCurrency === 'CZK' ? 'EUR' : 'GBP'); try{ if (DB) renderAll(); }catch(e){} };");
/* funnel: site = domain the customer came from, plus the language */
rep('var SITE = ("en" || (cz ? "cz" : "en"))', 'var SITE = ((/selfcare-cz/.test(host) ? "cz" : "en"))');

/* ---------- 4. page markup ---------- */
rep('<header>\n  <div class="logo">Self Care <span>Pharmacy</span></div>', '<header>\n  <div class="logo">Self Care <span>Pharmacy</span></div>');
rep("🛒 Basket\n    <span class=\"cart-badge", "🛒 <span id=\"cartBtnText\">Basket</span>\n    <span class=\"cart-badge");
rep('<div class="controls">\n  <div class="search-wrap">', `<div class="sc-prefs" aria-label="Language and currency">
  <div class="sc-pref-row" role="group" aria-labelledby="prefLangLabel"><span class="sc-pref-label" id="prefLangLabel">Language</span><div class="sc-pref-opts">${
    ["en","cs","sk","pl","ru","ua","de"].map(l => `<button type="button" class="sc-pref-btn" data-sc-lang="${l}" onclick="setDisplayLanguage('${l}');this.blur()">${({en:"EN",cs:"CZ",sk:"SK",pl:"PL",ru:"RU",ua:"UA",de:"DE"})[l]}</button>`).join("")
  }</div></div>
  <div class="sc-pref-row" role="group" aria-labelledby="prefCurLabel"><span class="sc-pref-label" id="prefCurLabel">Currency</span><div class="sc-pref-opts">${
    [["GBP","£"],["EUR","€"],["USD","$"],["CZK","Kč"]].map(([c, s]) => `<button type="button" class="sc-pref-btn" data-sc-cur="${c}" onclick="setDisplayCurrency('${c}');this.blur()">${s}</button>`).join("")
  }</div></div>
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
rep("\n</head>\n", `\n<style id="sc-prefs-css">
.sc-prefs{display:flex;flex-direction:column;gap:6px;padding:10px 16px 2px}
.sc-pref-row{display:flex;align-items:center;gap:8px;min-width:0}
.sc-pref-label{flex:0 0 auto;min-width:64px;font-size:11.5px;font-weight:800;color:#5b6b7a;text-transform:uppercase;letter-spacing:.4px}
.sc-pref-opts{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:1px}
.sc-pref-opts::-webkit-scrollbar{display:none}
.sc-pref-btn{flex:0 0 auto;min-width:38px;height:30px;padding:0 9px;border-radius:999px;border:1px solid #d5e4e1;background:#fff;color:#17324d;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.sc-pref-btn.active{background:#0f766e;border-color:#0f766e;color:#fff}
header .cart-btn{white-space:nowrap;max-width:118px;overflow:hidden;text-overflow:ellipsis}
.sc-pref-btn,.sc-pref-btn:focus,.sc-pref-btn:focus-visible,.sc-pref-btn:active{-webkit-tap-highlight-color:transparent;outline:none;box-shadow:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}
@media (max-width:430px){.sc-prefs{padding:8px 12px 2px}.sc-pref-row{gap:6px}.sc-pref-opts{gap:4px}.sc-pref-label{min-width:52px;font-size:10.5px}.sc-pref-btn{min-width:33px;height:29px;padding:0 6px;font-size:12px}}
</style>
</head>
`);

/* Czech names/descriptions travel with the English catalog (matched by product code) */
const czByCode = new Map(JSON.parse(read(path.join(CZ_DIR, "products-cz.json"))).map(p => [p.code, p]));
const enProducts = JSON.parse(read(path.join(EN_DIR, "products-en.json")));
let matched = 0;
for(const p of enProducts){ const c = czByCode.get(p.code); if(!c) continue; matched++; p.name_cz = c.name; p.desc_cz = c.desc; p.cat_cz = c.cat; }
if(matched < enProducts.length * 0.95) failures.push("catalog match too low: " + matched);
{
  const m = html.match(/CATALOG_PRODUCTS_URL = "products-en\.json\?v=(\d+)"/);
  if(!m) failures.push("catalog url"); else html = html.replace(m[0], `CATALOG_PRODUCTS_URL = "products-en.json?v=${m[1]}m1"`);
}

{ const m = html.match(/<div class="sc-version-stamp" aria-hidden="true">(en-v[\d.]+)<\/div>/); if(!m) failures.push("version stamp"); else html = html.replace(m[0], `<div class="sc-version-stamp" aria-hidden="true">m1 · ${m[1]}</div>`); }

/* ---------- 5. write ---------- */
if(failures.length){ console.error("BUILD FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
for(const s of inlineScripts(html)){ try{ parse(s.code); }catch(e){ console.error("syntax error in script at", s.start, e.message, s.code.slice(0, 80)); process.exit(1); } }
fs.mkdirSync(OUT_DIR, {recursive: true});
for(const f of fs.readdirSync(EN_DIR)) if(f !== "index.html") fs.copyFileSync(path.join(EN_DIR, f), path.join(OUT_DIR, f));
fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
fs.writeFileSync(path.join(OUT_DIR, "products-en.json"), JSON.stringify(enProducts));
console.log("ok", html.length, "bytes");
