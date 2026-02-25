// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  data/natures.js  —  NATURALEZAS                                         ║
// ║                                                                          ║
// ║  CÓMO FUNCIONA:                                                          ║
// ║   Cada naturaleza sube un stat ×1.1 y baja otro ×0.9.                   ║
// ║   Las neutrales (Seria, Huraña...) no modifican nada (×1 en todo).      ║
// ║                                                                          ║
// ║  PROPIEDADES:                                                            ║
// ║   label   → nombre que aparece en el selector del team-builder           ║
// ║   up      → stat que sube  (atk | def | spa | spd | spe | null)         ║
// ║   down    → stat que baja  (atk | def | spa | spd | spe | null)         ║
// ║   color   → color del badge en el editor                                 ║
// ║                                                                          ║
// ║  PARA AÑADIR UNA NATURALEZA NUEVA:                                       ║
// ║   Copia cualquier bloque y cambia los valores. La clave (p.ej. "Hardy") ║
// ║   es el identificador interno que se guarda en localStorage.             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const NaturesDB = {

    // ════════════════ NEUTRALES (sin modificadores) ═════════════════════════
    "Seria":    { label:"Seria",    up: null,  down: null,  color:"#64748b" },
    "Huraña":   { label:"Huraña",   up: null,  down: null,  color:"#64748b" },
    "Osada":    { label:"Osada",    up: null,  down: null,  color:"#64748b" },
    "Mansa":    { label:"Mansa",    up: null,  down: null,  color:"#64748b" },
    "Rara":     { label:"Rara",     up: null,  down: null,  color:"#64748b" },

    // ════════════════ SUBEN ATK ══════════════════════════════════════════════
    "Audaz":    { label:"Audaz",    up:"atk",  down:"spa",  color:"#ef4444" },  // ATK↑  SPA↓
    "Osada2":   { label:"Ufana",    up:"atk",  down:"spd",  color:"#ef4444" },  // ATK↑  SPD↓
    "Activa":   { label:"Activa",   up:"atk",  down:"def",  color:"#ef4444" },  // ATK↑  DEF↓
    "Pícara":   { label:"Pícara",   up:"atk",  down:"spe",  color:"#ef4444" },  // ATK↑  SPE↓

    // ════════════════ SUBEN DEF ══════════════════════════════════════════════
    "Plácida":  { label:"Plácida",  up:"def",  down:"spe",  color:"#3b82f6" },  // DEF↑  SPE↓
    "Agitada":  { label:"Agitada",  up:"def",  down:"spa",  color:"#3b82f6" },  // DEF↑  SPA↓
    "Floja":    { label:"Floja",    up:"def",  down:"atk",  color:"#3b82f6" },  // DEF↑  ATK↓
    "Gozosa":   { label:"Gozosa",   up:"def",  down:"spd",  color:"#3b82f6" },  // DEF↑  SPD↓

    // ════════════════ SUBEN SPA ══════════════════════════════════════════════
    "Modesta":  { label:"Modesta",  up:"spa",  down:"atk",  color:"#a855f7" },  // SPA↑  ATK↓ ← POPULAR
    "Miedosa":  { label:"Miedosa",  up:"spa",  down:"atk",  color:"#a855f7" },  // SPA↑  ATK↓
    "Tranquila":{ label:"Tranquila",up:"spa",  down:"spe",  color:"#a855f7" },  // SPA↑  SPE↓
    "Tímida2":  { label:"Apocada",  up:"spa",  down:"def",  color:"#a855f7" },  // SPA↑  DEF↓

    // ════════════════ SUBEN SPD ══════════════════════════════════════════════
    "Serena":   { label:"Serena",   up:"spd",  down:"spe",  color:"#eab308" },  // SPD↑  SPE↓
    "Amable":   { label:"Amable",   up:"spd",  down:"atk",  color:"#eab308" },  // SPD↑  ATK↓
    "Cauta":    { label:"Cauta",    up:"spd",  down:"spa",  color:"#eab308" },  // SPD↑  SPA↓
    "Gentil":   { label:"Gentil",   up:"spd",  down:"def",  color:"#eab308" },  // SPD↑  DEF↓

    // ════════════════ SUBEN SPE ══════════════════════════════════════════════
    "Tímida":   { label:"Tímida",   up:"spe",  down:"atk",  color:"#22c55e" },  // SPE↑  ATK↓ ← POPULAR
    "Alegre":   { label:"Alegre",   up:"spe",  down:"def",  color:"#22c55e" },  // SPE↑  DEF↓
    "Ingenua":  { label:"Ingenua",  up:"spe",  down:"spd",  color:"#22c55e" },  // SPE↑  SPD↓
    "Alocada":  { label:"Alocada",  up:"spe",  down:"spa",  color:"#22c55e" },  // SPE↑  SPA↓

    // ← AÑADE UNA NATURALEZA NUEVA AQUÍ si quieres más opciones

}; // fin NaturesDB


// ─── FUNCIÓN AUXILIAR ─────────────────────────────────────────────────────────
// Devuelve los multiplicadores reales de cada stat según la naturaleza.
// No tocar esto.
function getNatureMultipliers(natureName) {
    const nat = NaturesDB[natureName];
    const mults = { atk:1, def:1, spa:1, spd:1, spe:1 };
    if (!nat || !nat.up) return mults;
    mults[nat.up]   = 1.1;
    mults[nat.down] = 0.9;
    return mults;
}
