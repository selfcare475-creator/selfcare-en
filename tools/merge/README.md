# One storefront, every language

`public/` is built from the English site (base: look, features, stability) plus every language
from the Czech site (CZ, SK, PL, RU, UA, DE). The same files serve selfcare-en.com and selfcare-cz.com:

- language: `?lang=xx` → the customer's last choice → domain (selfcare-cz.com opens in Czech, everything else in English)
- currency: last choice → English £, other languages €
- order code: English 61 · Slovak 51 · Czech and the other languages 72 (WhatsApp message to the pharmacy stays in English)

Rebuild after changing the English page or the texts:

```
npm i acorn            # once
node tools/merge/build.js <english public dir> <czech public dir> <output dir>
```

Texts: `tx.js` (screens), `kits_tx.js` (ready kits). Logic: `core.js`. Patches to the English page: `build.js`.
