// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  data/types.js  —  TABLA DE TIPOS COMPLETA (Gen 6+, 18 tipos)           ║
// ║                                                                          ║
// ║  TypeChart[TIPO_ATAQUE][TIPO_DEFENSA] = multiplicador                   ║
// ║    2   = Súper eficaz  ·  0.5 = Poco eficaz  ·  0 = Sin efecto          ║
// ║  Si no aparece una combinación, se asume ×1 (neutro).                   ║
// ║                                                                          ║
// ║  DOBLE TIPO: los multiplicadores se multiplican entre sí.               ║
// ║  Ejemplo → Planta/Fuego vs Fuego: Fuego×Planta(×0.5) × Fuego×Fuego(×2) ║
// ║    = 0.5 × 2 = ×1  (daño neutro, las resistencias se anulan)            ║
// ║  Ejemplo → Agua/Tierra vs Rayo: Eléctrico×Agua(×2) × Eléctrico×Tierra(0)║
// ║    = 2 × 0 = ×0  (el tipo Tierra anula completamente el eléctrico)      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const TypeColors = {
    NORMAL:      "type-NORMAL",
    FUEGO:       "type-FUEGO",
    AGUA:        "type-AGUA",
    ELÉCTRICO: "type-ELÉCTRICO",
    PLANTA:      "type-PLANTA",
    HIELO:       "type-HIELO",
    LUCHA:       "type-LUCHA",
    VENENO:      "type-VENENO",
    TIERRA:      "type-TIERRA",
    VOLADOR:     "type-VOLADOR",
    PSÍQUICO:  "type-PSÍQUICO",
    BICHO:       "type-BICHO",
    ROCA:        "type-ROCA",
    FANTASMA:    "type-FANTASMA",
    DRAGÓN:    "type-DRAGÓN",
    SINIESTRO:   "type-SINIESTRO",
    ACERO:       "type-ACERO",
    HADA:        "type-HADA",
};

// ─── TABLA OFICIAL COMPLETA ──────────────────────────────────────────────────
const TypeChart = {
    NORMAL:      { ROCA:0.5, ACERO:0.5, FANTASMA:0 },
    FUEGO:       { FUEGO:0.5, AGUA:0.5, ROCA:0.5, DRAGÓN:0.5,
                   PLANTA:2, HIELO:2, BICHO:2, ACERO:2 },
    AGUA:        { FUEGO:2, TIERRA:2, ROCA:2,
                   AGUA:0.5, PLANTA:0.5, DRAGÓN:0.5 },
    ELÉCTRICO: { AGUA:2, VOLADOR:2,
                   ELÉCTRICO:0.5, PLANTA:0.5, DRAGÓN:0.5, TIERRA:0 },
    PLANTA:      { AGUA:2, TIERRA:2, ROCA:2,
                   FUEGO:0.5, PLANTA:0.5, VENENO:0.5, VOLADOR:0.5,
                   BICHO:0.5, DRAGÓN:0.5, ACERO:0.5 },
    HIELO:       { PLANTA:2, TIERRA:2, VOLADOR:2, DRAGÓN:2,
                   FUEGO:0.5, AGUA:0.5, HIELO:0.5, ACERO:0.5 },
    LUCHA:       { NORMAL:2, HIELO:2, ROCA:2, SINIESTRO:2, ACERO:2,
                   VENENO:0.5, BICHO:0.5, PSÍQUICO:0.5, VOLADOR:0.5, HADA:0.5,
                   FANTASMA:0 },
    VENENO:      { PLANTA:2, HADA:2,
                   VENENO:0.5, TIERRA:0.5, ROCA:0.5, FANTASMA:0.5, ACERO:0 },
    TIERRA:      { FUEGO:2, ELÉCTRICO:2, VENENO:2, ROCA:2, ACERO:2,
                   PLANTA:0.5, BICHO:0.5, VOLADOR:0 },
    VOLADOR:     { PLANTA:2, LUCHA:2, BICHO:2,
                   ELÉCTRICO:0.5, ROCA:0.5, ACERO:0.5 },
    PSÍQUICO:  { LUCHA:2, VENENO:2,
                   PSÍQUICO:0.5, ACERO:0.5, SINIESTRO:0 },
    BICHO:       { PLANTA:2, PSÍQUICO:2, SINIESTRO:2,
                   FUEGO:0.5, LUCHA:0.5, VOLADOR:0.5, FANTASMA:0.5,
                   ACERO:0.5, HADA:0.5 },
    ROCA:        { FUEGO:2, HIELO:2, VOLADOR:2, BICHO:2,
                   LUCHA:0.5, TIERRA:0.5, ACERO:0.5 },
    FANTASMA:    { PSÍQUICO:2, FANTASMA:2,
                   NORMAL:0, SINIESTRO:0.5 },
    DRAGÓN:    { DRAGÓN:2,
                   ACERO:0.5, HADA:0 },
    SINIESTRO:   { PSÍQUICO:2, FANTASMA:2,
                   LUCHA:0.5, SINIESTRO:0.5, HADA:0.5 },
    ACERO:       { HIELO:2, ROCA:2, HADA:2,
                   FUEGO:0.5, AGUA:0.5, ELÉCTRICO:0.5, ACERO:0.5 },
    HADA:        { LUCHA:2, DRAGÓN:2, SINIESTRO:2,
                   FUEGO:0.5, VENENO:0.5, ACERO:0.5 },
};
