// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  data/moves.js  —  MOVIMIENTOS                                           ║
// ║                                                                          ║
// ║  CÓMO CONFIGURAR:                                                        ║
// ║   • MovesDB  → tabla principal. Cada movimiento es una entrada           ║
// ║   • Propiedades de cada movimiento:                                      ║
// ║       name        → nombre (debe coincidir con la clave)                 ║
// ║       type        → tipo (debe existir en data/types.js)                 ║
// ║       category    → "physical" | "special" | "status"                   ║
// ║       power       → poder base (0 si es movimiento de estado)            ║
// ║       accuracy    → precisión en % (null = no puede fallar)              ║
// ║       priority    → prioridad de turno (0 normal, 1+ ataca antes)        ║
// ║       effect      → efecto especial (ver lista de efectos abajo)         ║
// ║       effectChance→ probabilidad del efecto secundario (0-100)           ║
// ║       description → texto que aparece en los botones de combate          ║
// ║                                                                          ║
// ║  EFECTOS DISPONIBLES (effect):                                           ║
// ║   "heal_50"        → cura 50% HP del usuario                             ║
// ║   "heal_100"       → cura 100% HP (duerme 2 turnos si es Descanso)       ║
// ║   "recoil_33"      → el usuario recibe 33% del daño hecho de retroceso   ║
// ║   "boost_atk_spe"  → sube ATK y VEL del usuario 1 nivel                 ║
// ║   "boost_spa_2"    → sube SPA del usuario 2 niveles                      ║
// ║   "protect"        → protege al usuario este turno                       ║
// ║   "apply_paralysis"→ paraliza al objetivo (ver data/status.js)           ║
// ║   "apply_burn"     → quema al objetivo                                   ║
// ║   "apply_poison"   → envenena al objetivo                                ║
// ║   "apply_sleep"    → duerme al objetivo                                  ║
// ║   "apply_freeze"   → congela al objetivo                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const MovesDB = {

    // ════════════════════════════════════════════════════════════════════════
    // 🔥 TIPO FUEGO
    // ════════════════════════════════════════════════════════════════════════

    "Lanzallamas": {
        name:         "Lanzallamas",
        type:         "FUEGO",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       "apply_burn",
        effectChance: 10,             // 10% de quemar
        description:  "Lanza llamas intensas. Puede quemar al objetivo.",
    },
    "Llamarada": {
        name:         "Llamarada",
        type:         "FUEGO",
        category:     "special",
        power:        110,
        accuracy:     85,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Golpe de fuego muy potente pero con poca precisión.",
    },
    "Onda Ígnea": {
        name:         "Onda Ígnea",
        type:         "FUEGO",
        category:     "special",
        power:        95,
        accuracy:     100,
        priority:     0,
        effect:       "apply_burn",
        effectChance: 30,             // 30% de quemar
        description:  "Onda de calor abrasador. Alta probabilidad de quemar.",
    },
    "Colmillo Ígneo": {
        name:         "Colmillo Ígneo",
        type:         "FUEGO",
        category:     "physical",
        power:        65,
        accuracy:     95,
        priority:     0,
        effect:       "apply_burn",
        effectChance: 10,
        description:  "Mordisco llameante. Puede quemar al objetivo.",
    },
    "Nitrocarga": {
        name:         "Nitrocarga",
        type:         "FUEGO",
        category:     "physical",
        power:        50,
        accuracy:     100,
        priority:     0,
        effect:       "boost_spe",    // Sube la velocidad del usuario
        effectChance: 100,
        description:  "Carga ardiente que aumenta la velocidad del usuario.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 💧 TIPO AGUA
    // ════════════════════════════════════════════════════════════════════════

    "Hidrobomba": {
        name:         "Hidrobomba",
        type:         "AGUA",
        category:     "special",
        power:        110,
        accuracy:     80,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Cañonazo de agua muy poderoso. Puede fallar.",
    },
    "Surf": {
        name:         "Surf",
        type:         "AGUA",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Ataque de agua que nunca falla.",
    },
    "Cascada": {
        name:         "Cascada",
        type:         "AGUA",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Ataque físico de agua preciso.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🌿 TIPO PLANTA
    // ════════════════════════════════════════════════════════════════════════

    "Rayo Solar": {
        name:         "Rayo Solar",
        type:         "PLANTA",
        category:     "special",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       "charge_turn",  // Carga 1 turno antes de atacar
        effectChance: 100,
        description:  "Absorbe luz el primer turno y la libera el segundo. Muy poderoso.",
    },
    "Hoja Afilada": {
        name:         "Hoja Afilada",
        type:         "PLANTA",
        category:     "physical",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Hojas afiladas que siempre golpean.",
    },
    "Gigadrenado": {
        name:         "Gigadrenado",
        type:         "PLANTA",
        category:     "special",
        power:        75,
        accuracy:     100,
        priority:     0,
        effect:       "drain_50",     // Recupera 50% del daño hecho
        effectChance: 100,
        description:  "Drena la energía del objetivo. Recupera 50% del daño.",
    },
    "Síntesis": {
        name:         "Síntesis",
        type:         "PLANTA",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "heal_50",
        effectChance: 100,
        description:  "Se recupera con la luz solar. Restaura 50% del HP.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // ⚡ TIPO ELÉCTRICO
    // ════════════════════════════════════════════════════════════════════════

    "Rayo": {
        name:         "Rayo",
        type:         "ELÉCTRICO",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       "apply_paralysis",
        effectChance: 10,
        description:  "Descarga eléctrica. Puede paralizar.",
    },
    "Onda Voltio": {
        name:         "Onda Voltio",
        type:         "ELÉCTRICO",
        category:     "special",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       "apply_paralysis",
        effectChance: 10,
        description:  "Onda de voltaje. Puede paralizar.",
    },
    "Puño Trueno": {
        name:         "Puño Trueno",
        type:         "ELÉCTRICO",
        category:     "physical",
        power:        75,
        accuracy:     100,
        priority:     0,
        effect:       "apply_paralysis",
        effectChance: 10,
        description:  "Puñetazo eléctrico. Puede paralizar.",
    },
    "Bola Voltio": {
        name:         "Bola Voltio",
        type:         "ELÉCTRICO",
        category:     "physical",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Bola de electricidad concentrada.",
    },
    "Onda Trueno": {
        name:         "Onda Trueno",
        type:         "ELÉCTRICO",
        category:     "status",
        power:        0,
        accuracy:     90,
        priority:     0,
        effect:       "apply_paralysis",
        effectChance: 100,            // Siempre paraliza si impacta
        description:  "Onda eléctrica que paraliza al objetivo.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // ❄️ TIPO HIELO
    // ════════════════════════════════════════════════════════════════════════

    "Rayo Hielo": {
        name:         "Rayo Hielo",
        type:         "HIELO",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       "apply_freeze",
        effectChance: 10,
        description:  "Rayo helado que puede congelar al objetivo.",
    },
    "Ventisca": {
        name:         "Ventisca",
        type:         "HIELO",
        category:     "special",
        power:        110,
        accuracy:     70,
        priority:     0,
        effect:       "apply_freeze",
        effectChance: 10,
        description:  "Tormenta de nieve muy potente pero imprecisa. Puede congelar.",
    },
    "Viento Hielo": {
        name:         "Viento Hielo",
        type:         "HIELO",
        category:     "special",
        power:        55,
        accuracy:     95,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Viento helado moderado con buena precisión.",
    },
    "Canto Helado": {
        name:         "Canto Helado",
        type:         "HIELO",
        category:     "special",
        power:        65,
        accuracy:     90,
        priority:     0,
        effect:       "apply_freeze",
        effectChance: 10,
        description:  "Sonido gélido. Puede congelar al objetivo.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 👊 TIPO LUCHA
    // ════════════════════════════════════════════════════════════════════════

    "A Bocajarro": {
        name:         "A Bocajarro",
        type:         "LUCHA",
        category:     "physical",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       "recoil_33",
        effectChance: 100,
        description:  "Golpe brutal de 120 de poder. El usuario recibe 1/3 del daño.",
    },
    "Tiro Vital": {
        name:         "Tiro Vital",
        type:         "LUCHA",
        category:     "physical",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       "recoil_33",
        effectChance: 100,
        description:  "Ataque apuntado a puntos vitales. El usuario recibe retroceso.",
    },
    "Esfera Aural": {
        name:         "Esfera Aural",
        type:         "LUCHA",
        category:     "special",
        power:        80,
        accuracy:     null,           // Nunca falla
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Esfera de energía que nunca falla.",
    },
    "Terratemblor": {
        name:         "Terratemblor",
        type:         "TIERRA",
        category:     "physical",
        power:        100,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Golpe sísmico de alta potencia.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🌍 TIPO TIERRA
    // ════════════════════════════════════════════════════════════════════════

    "Terremoto": {
        name:         "Terremoto",
        type:         "TIERRA",
        category:     "physical",
        power:        100,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Sacudida de tierra de 100 de poder. Muy preciso.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🦅 TIPO VOLADOR
    // ════════════════════════════════════════════════════════════════════════

    "Vuelo": {
        name:         "Vuelo",
        type:         "VOLADOR",
        category:     "physical",
        power:        90,
        accuracy:     95,
        priority:     0,
        effect:       "charge_turn",
        effectChance: 100,
        description:  "Vuela alto el primer turno, ataca el segundo.",
    },
    "Vendaval": {
        name:         "Vendaval",
        type:         "VOLADOR",
        category:     "special",
        power:        110,
        accuracy:     70,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Vendaval devastador. Muy poderoso pero impreciso.",
    },
    "Pico Taladro": {
        name:         "Pico Taladro",
        type:         "VOLADOR",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Picotazo penetrante de gran precisión.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🔮 TIPO PSÍQUICO
    // ════════════════════════════════════════════════════════════════════════

    "Psíquico": {
        name:         "Psíquico",
        type:         "PSÍQUICO",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Ataque psíquico de alta potencia.",
    },
    "Foco Resplandor": {
        name:         "Foco Resplandor",
        type:         "PSÍQUICO",
        category:     "special",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Explosión de energía mental concentrada. 120 de poder.",
    },
    "Recuperación": {
        name:         "Recuperación",
        type:         "PSÍQUICO",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "heal_50",
        effectChance: 100,
        description:  "Recupera el 50% del HP máximo.",
    },
    "Hipnosis": {
        name:         "Hipnosis",
        type:         "PSÍQUICO",
        category:     "status",
        power:        0,
        accuracy:     60,             // ← Baja precisión, ajústala si quieres
        priority:     0,
        effect:       "apply_sleep",
        effectChance: 100,
        description:  "Duerme al objetivo si acierta. Precisión del 60%.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 👻 TIPO FANTASMA
    // ════════════════════════════════════════════════════════════════════════

    "Bola Sombra": {
        name:         "Bola Sombra",
        type:         "FANTASMA",
        category:     "special",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Bola de energía oscura de buena potencia.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // ☠️ TIPO VENENO
    // ════════════════════════════════════════════════════════════════════════

    "Bomba Lodo": {
        name:         "Bomba Lodo",
        type:         "VENENO",
        category:     "special",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       "apply_poison",
        effectChance: 30,             // 30% de envenenar
        description:  "Bomba de lodo tóxico. Alta probabilidad de envenenar.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🪨 TIPO ROCA
    // ════════════════════════════════════════════════════════════════════════

    "Roca Afilada": {
        name:         "Roca Afilada",
        type:         "ROCA",
        category:     "physical",
        power:        100,
        accuracy:     80,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Ataque de roca potente con algo de imprecisión.",
    },
    "Avalancha": {
        name:         "Avalancha",
        type:         "ROCA",
        category:     "physical",
        power:        75,
        accuracy:     90,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Avalancha de rocas constante.",
    },
    "Megacuerno": {
        name:         "Megacuerno",
        type:         "ROCA",
        category:     "physical",
        power:        120,
        accuracy:     85,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Cornada devastadora de 120 de poder.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🐉 TIPO DRAGÓN
    // ════════════════════════════════════════════════════════════════════════

    "Garra Dragón": {
        name:         "Garra Dragón",
        type:         "DRAGÓN",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Zarpazo con energía dracónica. Muy preciso.",
    },
    "Enfado": {
        name:         "Enfado",
        type:         "DRAGÓN",
        category:     "physical",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       "recoil_33",
        effectChance: 100,
        description:  "Ataque de 120 poder con furia. El usuario recibe 1/3 del daño.",
    },
    "Danza Dragón": {
        name:         "Danza Dragón",
        type:         "DRAGÓN",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "boost_atk_spe",
        effectChance: 100,
        description:  "Danza mística. Sube ATK y Velocidad del usuario 1 nivel.",
    },
    "Cabeza de Hierro": {
        name:         "Cabeza de Hierro",
        type:         "ACERO",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Embestida con cabeza de acero. Muy preciso.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🌑 TIPO SINIESTRO
    // ════════════════════════════════════════════════════════════════════════

    "Triturar": {
        name:         "Triturar",
        type:         "SINIESTRO",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Mordida brutal con gran fuerza.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // ⬜ TIPO NORMAL
    // ════════════════════════════════════════════════════════════════════════

    "Ataque Rápido": {
        name:         "Ataque Rápido",
        type:         "NORMAL",
        category:     "physical",
        power:        40,
        accuracy:     100,
        priority:     1,              // ← Prioridad +1: siempre ataca antes
        effect:       null,
        effectChance: 0,
        description:  "Ataque veloz con prioridad. Siempre golpea primero.",
    },
    "Velocidad Extrema": {
        name:         "Velocidad Extrema",
        type:         "NORMAL",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     2,              // ← Prioridad +2: aún más rápido
        effect:       null,
        effectChance: 0,
        description:  "Ataque de velocidad extrema con prioridad +2.",
    },
    "Golpe Cuerpo": {
        name:         "Golpe Cuerpo",
        type:         "NORMAL",
        category:     "physical",
        power:        85,
        accuracy:     100,
        priority:     0,
        effect:       null,
        effectChance: 0,
        description:  "Golpe con todo el cuerpo. Preciso y sólido.",
    },
    "Superdiente": {
        name:         "Superdiente",
        type:         "NORMAL",
        category:     "physical",
        power:        null,           // El poder se calcula con la fórmula especial
        accuracy:     100,
        priority:     0,
        effect:       "drain_50_remaining",
        effectChance: 100,
        description:  "Mordisco poderoso con colmillos afilados. El rival recibe el 50% del daño.",
    },
    "Descanso": {
        name:         "Descanso",
        type:         "NORMAL",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "heal_100_sleep", // Cura todo el HP pero duerme 2 turnos
        effectChance: 100,
        description:  "Duerme 2 turnos pero recupera todo el HP.",
    },
    "Protección": {
        name:         "Protección",
        type:         "NORMAL",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     4,              // ← Máxima prioridad: siempre va primero
        effect:       "protect",
        effectChance: 100,
        description:  "Protege de cualquier ataque este turno. Falla si se usa seguido.",
    },

    // ════════════════════════════════════════════════════════════════════════
    // 🆕 MOVIMIENTOS NUEVOS GENERACIÓN 10
    // ════════════════════════════════════════════════════════════════════════

    "Stealth_Rock": {
        name:         "Stealth Rock",
        type:         "ROCA",
        category:     "status",
        power:        0,
        accuracy:     100,
        priority:     0,              // ← Máxima prioridad: siempre va primero
        effect:       "stealth_rock",
        effectChance: 100,
        description:  "Coloca rocas sigilosas en el campo del rival. Da daño a los Pokémon que entran.",
    },

    "Scorch Claw": {
        name:         "Scorch Claw",
        type:         "FUEGO",
        category:     "physical",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "petrify_heal",
        effectChance: 100,
        description:  "Petrifica al objetivo y restaura PS del usuario.",
    },
    "Loose Dirt": {
        name:         "Loose Dirt",
        type:         "TIERRA",
        category:     "physical",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       "lower_atk_30",
        effectChance: 30,
        description:  "Ataque de tierra que baja el Ataque del objetivo.",
    },
    "Grease Fire": {
        name:         "Grease Fire",
        type:         "FUEGO",
        category:     "special",
        power:        70,
        accuracy:     100,
        priority:     0,
        effect:       "super_water",
        effectChance: 100,
        description:  "Súper efectivo contra Pokémon de tipo Agua.",
    },
    "Shortcut": {
        name:         "Shortcut",
        type:         "ELÉCTRICO",
        category:     "special",
        power:        130,
        accuracy:     90,
        priority:     0,
        effect:       "lower_spa",
        effectChance: 100,
        description:  "Potente descarga que baja el Ataque Especial del usuario.",
    },
    "Rusted Edge": {
        name:         "Rusted Edge",
        type:         "VENENO",
        category:     "physical",
        power:        75,
        accuracy:     100,
        priority:     0,
        effect:       "toxic_spikes",
        effectChance: 100,
        description:  "Coloca púas tóxicas en el campo contrario (Contact).",
    },
    "Seismic Wave": {
        name:         "Seismic Wave",
        type:         "TIERRA",
        category:     "special",
        power:        60,
        accuracy:     100,
        priority:     0,
        effect:       "power_hazards",
        effectChance: 100,
        description:  "Poder aumenta por cada peligro de campo activo.",
    },
    "Rowdy Tussle": {
        name:         "Rowdy Tussle",
        type:         "SINIESTRO",
        category:     "physical",
        power:        120,
        accuracy:     90,
        priority:     0,
        effect:       "lower_atk",
        effectChance: 100,
        description:  "Ataque brutal que baja el Ataque del usuario.",
    },
    "Healing Spa": {
        name:         "Healing Spa",
        type:         "NORMAL",
        category:     "physical",
        power:        60,
        accuracy:     100,
        priority:     0,
        effect:       "heal_status_double",
        effectChance: 100,
        description:  "Poder x2 si está paralizado/quemado/confuso/congelado. Cura estados.",
    },
    "Gatling Slug": {
        name:         "Gatling Slug",
        type:         "LUCHA",
        category:     "physical",
        power:        120,
        accuracy:     95,
        priority:     0,
        effect:       "lower_defenses",
        effectChance: 100,
        description:  "Lluvia de puñetazos que baja Defensa y Def.Esp.",
    },
    "Harmful Strike": {
        name:         "Harmful Strike",
        type:         "SINIESTRO",
        category:     "physical",
        power:        95,
        accuracy:     100,
        priority:     0,
        effect:       "dark_effective",
        effectChance: 100,
        description:  "Combina la efectividad del tipo Siniestro.",
    },
    "Bridge Burn": {
        name:         "Bridge Burn",
        type:         "FUEGO",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "switch_burn",
        effectChance: 100,
        description:  "El usuario cambia y quema al Pokémon que entra.",
    },
    "Guard Room": {
        name:         "Guard Room",
        type:         "PSÍQUICO",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "invert_stats_room",
        effectChance: 100,
        description:  "Crea una sala que invierte stats ofensivos/defensivos por 5 turnos.",
    },
    "Cryofreeze": {
        name:         "Cryofreeze",
        type:         "HIELO",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     -7,
        effect:       "apply_freeze",
        effectChance: 100,
        description:  "Prioridad muy baja: congela al objetivo si no recibió daño directo.",
    },
    "Landscape": {
        name:         "Landscape",
        type:         "TIERRA",
        category:     "physical",
        power:        70,
        accuracy:     100,
        priority:     0,
        effect:       "switch_after_hit",
        effectChance: 100,
        description:  "El usuario cambia tras dañar después de atacar.",
    },
    "Cultivation": {
        name:         "Cultivation",
        type:         "PLANTA",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     -1,
        effect:       "boost_ally_random",
        effectChance: 100,
        description:  "Sube un stat aleatorio del aliado. Consume bayas si las tiene.",
    },
    "Possession": {
        name:         "Possession",
        type:         "FANTASMA",
        category:     "status",
        power:        0,
        accuracy:     100,
        priority:     0,
        effect:       "force_self_hit",
        effectChance: 100,
        description:  "Fuerza al objetivo a usar su movimiento ofensivo contra sí mismo.",
    },
    "Boo-mbs": {
        name:         "Boo-mbs",
        type:         "FANTASMA",
        category:     "physical",
        power:        20,
        accuracy:     90,
        priority:     0,
        effect:       "multi_hit",
        effectChance: 100,
        description:  "Golpea 2-5 veces al objetivo con proyectiles.",
    },
    "Boulder Bout": {
        name:         "Boulder Bout",
        type:         "ROCA",
        category:     "physical",
        power:        120,
        accuracy:     100,
        priority:     0,
        effect:       "lower_defenses",
        effectChance: 100,
        description:  "Ataque rocoso devastador que baja Defensa y Def.Esp.",
    },
    "Antler Shed": {
        name:         "Antler Shed",
        type:         "NORMAL",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "shed_switch_boost",
        effectChance: 100,
        description:  "El usuario pierde 1/3 de PS, cambia y sube Ataque del entrante.",
    },
    "Gravitas Clasp": {
        name:         "Gravitas Clasp",
        type:         "PSÍQUICO",
        category:     "special",
        power:        80,
        accuracy:     100,
        priority:     0,
        effect:       "gravity_field",
        effectChance: 100,
        description:  "Invoca Gravedad durante 3 turnos después de dañar.",
    },
    "Powder Bomb": {
        name:         "Powder Bomb",
        type:         "BICHO",
        category:     "special",
        power:        130,
        accuracy:     90,
        priority:     0,
        effect:       "paralysis_lower_spa",
        effectChance: 20,
        description:  "Bomba de polvo que puede paralizar y baja Ataque Especial del usuario.",
    },
    "Armored Up": {
        name:         "Armored Up",
        type:         "ROCA",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "switch_petrify_heal",
        effectChance: 100,
        description:  "El usuario cambia y petrifica/restaura PS al Pokémon entrante.",
    },
    "Biorrosion": {
        name:         "Biorrosion",
        type:         "VENENO",
        category:     "physical",
        power:        90,
        accuracy:     100,
        priority:     0,
        effect:       "super_steel",
        effectChance: 100,
        description:  "Súper efectivo contra Pokémon de tipo Acero (Contact).",
    },
    "Supernova": {
        name:         "Supernova",
        type:         "FUEGO",
        category:     "special",
        power:        250,
        accuracy:     100,
        priority:     0,
        effect:       "explode_damage",
        effectChance: 100,
        description:  "Explosión masiva que daña adyacentes pero debilita al usuario.",
    },
    "Rock Climb": {
        name:         "Rock Climb",
        type:         "ROCA",
        category:     "physical",
        power:        120,
        accuracy:     90,
        priority:     0,
        effect:       "charge_climb",
        effectChance: 100,
        description:  "Turno 1: sube +2 Velocidad. Turno 2: atacar con gran poder.",
    },
    "Blossom Needle": {
        name:         "Blossom Needle",
        type:         "PLANTA",
        category:     "physical",
        power:        120,
        accuracy:     70,
        priority:     0,
        effect:       "heal_cure_never_miss",
        effectChance: 100,
        description:  "Cura estados negativos del usuario y nunca falla.",
    },
    "Stalactbite": {
        name:         "Stalactbite",
        type:         "ROCA",
        category:     "physical",
        power:        85,
        accuracy:     100,
        priority:     0,
        effect:       "break_screens",
        effectChance: 100,
        description:  "Mordisco rocoso que destruye pantallas (Contact/Bite).",
    },
    "Froglare Bash": {
        name:         "Froglare Bash",
        type:         "HIELO",
        category:     "physical",
        power:        120,
        accuracy:     95,
        priority:     0,
        effect:       "freeze_confuse_recoil",
        effectChance: 20,
        description:  "20% congela/confunde + 33% de retroceso (Contact/Recoil).",
    },
    "Flame Jet": {
        name:         "Flame Jet",
        type:         "FUEGO",
        category:     "physical",
        power:        40,
        accuracy:     100,
        priority:     1,
        effect:       null,
        effectChance: 0,
        description:  "Ataque rápido de fuego con prioridad +1 (Contact).",
    },
    "Frenzy Jungle": {
        name:         "Frenzy Jungle",
        type:         "PLANTA",
        category:     "special",
        power:        150,
        accuracy:     100,
        priority:     0,
        effect:       "power_low_hp",
        effectChance: 100,
        description:  "Ataque de área que pierde poder si el PS es bajo.",
    },
    "Steely Spikes": {
        name:         "Steely Spikes",
        type:         "ACERO",
        category:     "status",
        power:        0,
        accuracy:     null,
        priority:     0,
        effect:       "steely_hazard",
        effectChance: 100,
        description:  "Coloca púas de acero en el campo. Máx 3 capas.",
    },
    "Hasting": {
        name:         "Hasting",
        type:         "NORMAL",
        category:     "status",
        power:        0,
        accuracy:     90,
        priority:     0,
        effect:       "boost_speed_confuse",
        effectChance: 100,
        description:  "Sube +2 la Velocidad del objetivo y lo confunde (Sound).",
    },
    "Seismic Land": {
        name:         "Seismic Land",
        type:         "TIERRA",
        category:     "physical",
        power:        130,
        accuracy:     85,
        priority:     0,
        effect:       "recoil_50_miss",
        effectChance: 100,
        description:  "50% de retroceso PS máximo si falla (Contact/Recoil).",
    },
    "Arctic Slide": {
        name:         "Arctic Slide",
        type:         "HIELO",
        category:     "physical",
        power:        70,
        accuracy:     100,
        priority:     0,
        effect:       "boost_spe",
        effectChance: 100,
        description:  "Deslice gélido que siempre sube +1 la Velocidad (Contact).",
    },
    "Spirit Charge": {
        name:         "Spirit Charge",
        type:         "FANTASMA",
        category:     "physical",
        power:        60,
        accuracy:     100,
        priority:     0,
        effect:       "boost_spe",
        effectChance: 100,
        description:  "Carga espectral que siempre sube +1 la Velocidad (Contact).",
    },

}; // fin MovesDB


// ─── FUNCIÓN AUXILIAR (usada por el motor de batalla) ────────────────────────
// No hace falta tocar esto al añadir movimientos.
function getMoveInfo(moveName) {
    const move = MovesDB[moveName];
    if (!move) {
        // Movimiento desconocido: devuelve un ataque normal por defecto
        return {
            name:         moveName,
            type:         "NORMAL",
            category:     "physical",
            power:        80,
            accuracy:     100,
            priority:     0,
            effect:       null,
            effectChance: 0,
            description:  "Ataque básico",
        };
    }
    return move;
}
