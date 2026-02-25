// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  data/items.js  —  OBJETOS DE COMBATE                                   ║
// ║                                                                          ║
// ║  CÓMO CONFIGURAR:                                                        ║
// ║   • ItemsDB → cada entrada es un objeto equipable                        ║
// ║   • Propiedades:                                                         ║
// ║       name        → nombre del objeto                                    ║
// ║       icon        → 📁 RUTA DE IMAGEN (pon tu imagen en sprites/items/)  ║
// ║                     Ejemplo: "sprites/items/banda-elegida.png"           ║
// ║                     O usa un emoji si aún no tienes la imagen:           ║
// ║                     icon: null  (aparecerá el emoji de fallback)         ║
// ║       iconFallback→ emoji que aparece si no hay imagen                   ║
// ║       description → texto visible en el selector de objetos              ║
// ║       category    → categoría de color en el menú                        ║
// ║       statBoost   → multiplicadores de estadística en combate            ║
// ║       trigger     → cuándo se activa ("end_turn","low_hp","fatal_hit")   ║
// ║       effect      → efecto que aplica                                    ║
// ║       oneTime     → true si se consume al usarse                         ║
// ║       type        → "offensive"|"defensive"|"healing"|"berry"|"speed"   ║
// ║                                                                          ║
// ║  📁 IMÁGENES DE OBJETOS:                                                 ║
// ║     Crea la carpeta sprites/items/ y pon las imágenes ahí.               ║
// ║     Tamaño recomendado: 32×32 px o 64×64 px                              ║
// ║     Formatos soportados: .png .jpg .gif                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// Carpeta base para imágenes de objetos
// ← CAMBIA ESTO si mueves las imágenes a otro sitio
const ITEMS_SPRITES_PATH = "sprites/items/";

const ItemsDB = {

    // ════════════════════════════════════════════════════════════════════════
    // ⚔️ OBJETOS OFENSIVOS
    // ════════════════════════════════════════════════════════════════════════

    "Banda Elegida": {
        name:         "Banda Elegida",
        icon:         null,           // ← pon "sprites/items/banda-elegida.png" cuando tengas la imagen
        iconFallback: "🎗️",
        description:  "Aumenta el ATK ×1.5 pero solo puede usar un movimiento.",
        category:     "offensive",
        type:         "offensive",
        statBoost:    { atk: 1.5 },
        lockedMove:   true,           // El Pokémon queda bloqueado en el primer movimiento usado
    },

    "Gafas Especiales": {
        name:         "Gafas Especiales",
        icon:         null,           // ← "sprites/items/gafas-especiales.png"
        iconFallback: "🕶️",
        description:  "Aumenta el SPA (Ataque Especial) ×1.5.",
        category:     "offensive",
        type:         "offensive",
        statBoost:    { spa: 1.5 },
    },

    "Orbe Vida": {
        name:         "Orbe Vida",
        icon:         null,           // ← "sprites/items/orbe-vida.png"
        iconFallback: "🔮",
        description:  "Aumenta el daño ×1.3 pero el usuario pierde 10% HP por turno.",
        category:     "offensive",
        type:         "offensive",
        statBoost:    { damage: 1.3 },
        sideEffect:   "recoil_10",    // El motor aplica este efecto al final del turno
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🛡️ OBJETOS DEFENSIVOS
    // ════════════════════════════════════════════════════════════════════════

    "Chaleco Asalto": {
        name:         "Chaleco Asalto",
        icon:         null,           // ← "sprites/items/chaleco-asalto.png"
        iconFallback: "🦺",
        description:  "Aumenta la SPD (Def. Especial) ×1.5. No puede usar movimientos de estado.",
        category:     "defensive",
        type:         "defensive",
        statBoost:    { spd: 1.5 },
        noStatusMoves: true,
    },

    "Cinta Focus": {
        name:         "Cinta Focus",
        icon:         null,           // ← "sprites/items/cinta-focus.png"
        iconFallback: "🎀",
        description:  "Si el Pokémon tiene HP lleno, sobrevive con 1 HP a un golpe letal.",
        category:     "defensive",
        type:         "survival",
        trigger:      "fatal_hit",
        effect:       "survive_1hp",
        oneTime:      true,
    },

    // ════════════════════════════════════════════════════════════════════════
    // ⚡ OBJETOS DE VELOCIDAD
    // ════════════════════════════════════════════════════════════════════════

    "Pañuelo Elección": {
        name:         "Pañuelo Elección",
        icon:         null,           // ← "sprites/items/panuelo-eleccion.png"
        iconFallback: "🧣",
        description:  "Aumenta la SPE (Velocidad) ×1.5 pero solo puede usar un movimiento.",
        category:     "speed",
        type:         "speed",
        statBoost:    { spe: 1.5 },
        lockedMove:   true,
    },

    // ════════════════════════════════════════════════════════════════════════
    // 💊 OBJETOS DE RECUPERACIÓN
    // ════════════════════════════════════════════════════════════════════════

    "Restos": {
        name:         "Restos",
        icon:         null,           // ← "sprites/items/restos.png"
        iconFallback: "🍖",
        description:  "Recupera 1/16 del HP máximo al final de cada turno.",
        category:     "healing",
        type:         "healing",
        trigger:      "end_turn",
        effect:       "heal_6",       // heal_6 = 1/16 del HP (≈6%)
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🫐 BAYAS
    // ════════════════════════════════════════════════════════════════════════

    "Baya Zidra": {
        name:         "Baya Zidra",
        icon:         null,           // ← "sprites/items/baya-zidra.png"
        iconFallback: "🫐",
        description:  "Cuando la vida cae por debajo del 25%, restaura 1/3 del HP.",
        category:     "berry",
        type:         "berry",
        trigger:      "low_hp",
        effect:       "heal_33",
        oneTime:      true,
    },

    "Baya Safre": {
        name:         "Baya Safre",
        icon:         null,           // ← "sprites/items/baya-safre.png"
        iconFallback: "🍇",
        description:  "Reduce el daño de un ataque súper efectivo a la mitad.",
        category:     "berry",
        type:         "berry",
        trigger:      "super_effective",
        effect:       "reduce_damage_50",
        oneTime:      true,
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🔷 POTENCIADORES DE TIPO
    // ════════════════════════════════════════════════════════════════════════

    "Carbón": {
        name:         "Carbón",
        icon:         null,           // ← "sprites/items/carbon.png"
        iconFallback: "🪨",
        description:  "Aumenta el poder de los movimientos de tipo FUEGO ×1.2.",
        category:     "type_boost",
        type:         "type_boost",
        boostedType:  "FUEGO",
        boost:        1.2,
    },

    "Agua Mística": {
        name:         "Agua Mística",
        icon:         null,           // ← "sprites/items/agua-mistica.png"
        iconFallback: "💧",
        description:  "Aumenta el poder de los movimientos de tipo AGUA ×1.2.",
        category:     "type_boost",
        type:         "type_boost",
        boostedType:  "AGUA",
        boost:        1.2,
    },

    "Milagro": {
        name:         "Milagro",
        icon:         null,           // ← "sprites/items/milagro.png"
        iconFallback: "🌱",
        description:  "Aumenta el poder de los movimientos de tipo PLANTA ×1.2.",
        category:     "type_boost",
        type:         "type_boost",
        boostedType:  "PLANTA",
        boost:        1.2,
    },

    "Imán": {
        name:         "Imán",
        icon:         null,           // ← "sprites/items/iman.png"
        iconFallback: "🧲",
        description:  "Aumenta el poder de los movimientos de tipo ELÉCTRICO ×1.2.",
        category:     "type_boost",
        type:         "type_boost",
        boostedType:  "ELÉCTRICO",
        boost:        1.2,
    },

    // ════════════════════════════════════════════════════════════════════════
    // ⭕ SIN OBJETO
    // ════════════════════════════════════════════════════════════════════════

    "Ninguno": {
        name:         "Ninguno",
        icon:         null,
        iconFallback: "—",
        description:  "Sin objeto equipado.",
        category:     "none",
        type:         "none",
    },

    // ← AÑADE UN OBJETO NUEVO AQUÍ SIGUIENDO EL MISMO FORMATO

}; // fin ItemsDB


// ─── FUNCIONES AUXILIARES (usadas por el motor de batalla) ───────────────────
// No hace falta tocar esto al añadir objetos.

function getItemStatBoost(pokemon) {
    const empty = { atk:1, def:1, spa:1, spd:1, spe:1, damage:1 };
    if (!pokemon.item || pokemon.item === "Ninguno") return empty;
    const item = ItemsDB[pokemon.item];
    if (!item || !item.statBoost) return empty;
    return {
        atk:    item.statBoost.atk    || 1,
        def:    item.statBoost.def    || 1,
        spa:    item.statBoost.spa    || 1,
        spd:    item.statBoost.spd    || 1,
        spe:    item.statBoost.spe    || 1,
        damage: item.statBoost.damage || 1,
    };
}

function getItemTypeBoost(pokemon, moveType) {
    if (!pokemon.item || pokemon.item === "Ninguno") return 1;
    const item = ItemsDB[pokemon.item];
    if (item && item.type === "type_boost" && item.boostedType === moveType) return item.boost;
    return 1;
}

function getItemIcon(itemName) {
    const item = ItemsDB[itemName];
    if (!item) return "—";
    if (item.icon) return `<img src="${item.icon}" class="item-icon" onerror="this.style.display='none';this.nextSibling.style.display=''"><span style="display:none">${item.iconFallback}</span>`;
    return item.iconFallback || "—";
}
