global.window = undefined;
const files = ['core','data_rules','data_classes','data_spells','data_spells_auto','data_bestiary','data_mc','data_maps','builder','engine','actions','ai'];
const fs = require('fs');
for (const f of files) { const p = __dirname + '/../src/' + f + '.js'; if (fs.existsSync(p)) { (0, eval)(fs.readFileSync(p, 'utf8')); } }
module.exports = globalThis.PF;
