// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  data/trainers.js  —  ENTRENADORES RIVALES                               ║
// ║                                                                          ║
// ║  CÓMO PERSONALIZAR UN ENTRENADOR:                                        ║
// ║   1. Cambia name, title, avatar (emoji) y color                          ║
// ║   2. En team[] pon entre 3 y 6 Pokémon con este formato:                ║
// ║      {                                                                    ║
// ║        id:      número del PokemonDB  (ej: 1, 5, 9001)                  ║
// ║        moves:   [4 movimientos del learnset del Pokémon]                 ║
// ║        item:    nombre del objeto de ItemsDB  (ej: "Restos")             ║
// ║        nature:  clave de NaturesDB  (ej: "Adamante", "Modesta")         ║
// ║        evs:     { hp:0, atk:252, def:0, spa:0, spd:4, spe:252 }        ║
// ║        ability: habilidad de AbilitiesDB (opcional, sobreescribe default)║
// ║      }                                                                    ║
// ║                                                                          ║
// ║  OBJETOS DISPONIBLES (data/items.js):                                    ║
// ║   "Ninguno" · "Restos" · "Orbe Vida" · "Banda Elegida"                 ║
// ║   "Gafas Especiales" · "Cinta Focus" · "Baya Zidra"                    ║
// ║                                                                          ║
// ║  NATURALEZAS ÚTILES (data/natures.js):                                   ║
// ║   "Adamante" (ATK↑ SPA↓) · "Modesta" (SPA↑ ATK↓)                     ║
// ║   "Jovial" (ATK↑ SPD↓)   · "Tímida" (SPE↑ ATK↓)                      ║
// ║   "Seria" (sin efecto)                                                   ║
// ║                                                                          ║
// ║  El ORDEN en TrainersDB = orden en la pantalla de selección             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const TrainersDB = {

    // ════════════════════════════════════════════════════════════════════════
    // ENTRENADOR 1 — Personaliza este bloque con tus datos
    // ════════════════════════════════════════════════════════════════════════
    "trainer1": {
        id:          "trainer1",
        name:        "ENTRENADOR 1",        // ← cambia el nombre
        title:       "Descripción aquí",    // ← título o descripción
        avatar:      "🧑",                  // ← emoji del avatar
        color:       "#f59e0b",             // ← color del borde (hex)
        description: "Descripción del entrenador para el log de batalla.",
        team: [
            {
                id:     1,                  // ← ID de PokemonDB
                moves:  ["Lanzallamas", "Garra Dragón", "Nitrocarga", "Danza Dragón"],
                item:   "Restos",
                nature: "Adamante",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
            {
                id:     2,
                moves:  ["Rayo Solar", "Bomba Lodo", "Gigadrenado", "Síntesis"],
                item:   "Orbe Vida",
                nature: "Modesta",
                evs:    { hp:4, atk:0, def:0, spa:252, spd:0, spe:252 },
            },
            {
                id:     3,
                moves:  ["Hidrobomba", "Surf", "Rayo Hielo", "Protección"],
                item:   "Ninguno",
                nature: "Seria",
                evs:    { hp:252, atk:0, def:128, spa:0, spd:128, spe:0 },
            },
        ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // ENTRENADOR 2
    // ════════════════════════════════════════════════════════════════════════
    "Substitute": {
        id:          "Substitute",
        name:        "substitute",  // ← cambia el nombre
        title:       "Buñeco de Prueba",  // ← título o descripción
        avatar:      "🧸",          // ← emoji del avatar
        color:       "#99fab6",
        description: "Buñeco de prueba para testear mecánicas. No es un rival real.",
        team: [
            {
                id:     999,
                moves:  ["substitute", "Rayo Hielo", "Garra Dragón", "Danza Dragón"],
                item:   "Gafas Especiales",
                nature: "Modesta",
                evs:    { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
            },
        ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // ENTRENADOR 3
    // ════════════════════════════════════════════════════════════════════════
    "trainer3": {
        id:          "trainer3",
        name:        "ENTRENADOR 3",
        title:       "Descripción aquí",
        avatar:      "⚔️",
        color:       "#ef4444",
        description: "Descripción del entrenador.",
        team: [
            {
                id:     127,
                moves:  ["Terremoto", "Roca Afilada", "Megacuerno", "Stealth_Rock"],
                item:   "Banda Elegida",
                nature: "Adamante",
                evs:    { hp:252, atk:252, def:0, spa:0, spd:4, spe:0 },
            },
            {
                id:     127,
                moves:  ["Terremoto", "Roca Afilada", "Megacuerno", "Stealth_Rock"],
                item:   "Orbe Vida",
                nature: "Adamante",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
            {
                id:     127,
                moves:  ["Terremoto", "Roca Afilada", "Megacuerno", "Stealth_Rock"],
                item:   "Cinta Focus",
                nature: "Jovial",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
        ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // ENTRENADOR 4
    // ════════════════════════════════════════════════════════════════════════
    "trainer4": {
        id:          "trainer4",
        name:        "ENTRENADOR 4",
        title:       "Descripción aquí",
        avatar:      "🌟",
        color:       "#a855f7",
        description: "Descripción del entrenador.",
        team: [
            {
                id:     8,
                moves:  ["Bola Sombra", "Triturar", "Hipnosis", "Recuperación"],
                item:   "Gafas Especiales",
                nature: "Modesta",
                evs:    { hp:4, atk:0, def:0, spa:252, spd:0, spe:252 },
            },
            {
                id:     14,
                moves:  ["Triturar", "Psíquico", "Bola Sombra", "Hipnosis"],
                item:   "Orbe Vida",
                nature: "Tímida",
                evs:    { hp:4, atk:0, def:0, spa:252, spd:0, spe:252 },
            },
            {
                id:     19,
                moves:  ["Psíquico", "Foco Resplandor", "Recuperación", "Hipnosis"],
                item:   "Restos",
                nature: "Modesta",
                evs:    { hp:252, atk:0, def:4, spa:252, spd:0, spe:0 },
            },
        ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // ENTRENADOR 5 — El más difícil (6 Pokémon, EVs optimizados)
    // ════════════════════════════════════════════════════════════════════════
    "trainer5": {
        id:          "trainer5",
        name:        "ENTRENADOR 5",
        title:       "Rival Final",
        avatar:      "💀",
        color:       "#fbbf24",
        description: "El entrenador más fuerte. ¡Buena suerte!",
        team: [
            {
                id:     20,
                moves:  ["Garra Dragón", "Cabeza de Hierro", "Terremoto", "Danza Dragón"],
                item:   "Orbe Vida",
                nature: "Jovial",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
            {
                id:     12,
                moves:  ["Garra Dragón", "Enfado", "Triturar", "Danza Dragón"],
                item:   "Banda Elegida",
                nature: "Adamante",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
            {
                id:     1,
                moves:  ["Lanzallamas", "Garra Dragón", "Danza Dragón", "Nitrocarga"],
                item:   "Cinta Focus",
                nature: "Jovial",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
            {
                id:     17,
                moves:  ["Rayo", "Vuelo", "Bola Voltio", "Velocidad Extrema"],
                item:   "Gafas Especiales",
                nature: "Modesta",
                evs:    { hp:4, atk:0, def:0, spa:252, spd:0, spe:252 },
            },
            {
                id:     19,
                moves:  ["Psíquico", "Foco Resplandor", "Hipnosis", "Recuperación"],
                item:   "Restos",
                nature: "Modesta",
                evs:    { hp:252, atk:0, def:4, spa:252, spd:0, spe:0 },
            },
            {
                id:     9001,
                moves:  ["Garra Dragón", "Cabeza de Hierro", "Terremoto", "Danza Dragón"],
                item:   "Orbe Vida",
                nature: "Jovial",
                evs:    { hp:4, atk:252, def:0, spa:0, spd:0, spe:252 },
            },
        ],
    },

    // ← AÑADE MÁS ENTRENADORES AQUÍ copiando cualquier bloque de arriba

}; // fin TrainersDB
