# 🎮 Kanto Battle Simulator Pro

Simulador de batallas Pokémon estilo Showdown con los Pokémon de la región de Kanto.

## 📁 Estructura de Archivos

```
kanto-battle-simulator/
│
├── index.html              # Archivo HTML principal
├── styles.css              # Estilos CSS
├── README.md              # Este archivo
│
├── data/                   # Capa de datos
│   ├── types.js           # Tipos de Pokémon y efectividades
│   ├── moves.js           # Base de datos de movimientos
│   └── pokemon.js         # 20 Pokémon de Kanto
│
└── js/                     # Lógica del juego
    ├── state.js           # Gestor del estado del juego
    ├── battle-engine.js   # Motor de cálculos de batalla
    ├── ui-manager.js      # Gestor de la interfaz
    ├── team-builder.js    # Constructor de equipos
    ├── battle-system.js   # Sistema principal de batalla
    └── main.js            # Punto de entrada
```

## ⚡ Características

### 🎯 Pokémon Disponibles (20)
- **Iniciales Gen I**: Venusaur, Charizard, Blastoise
- **Eléctricos**: Pikachu, Raichu, Jolteon, Zapdos
- **Fuego**: Arcanine, Flareon
- **Agua**: Starmie, Gyarados, Lapras
- **Psíquico**: Alakazam, Exeggutor
- **Lucha**: Machamp
- **Fantasma/Veneno**: Gengar
- **Tierra/Roca**: Rhydon
- **Normal**: Snorlax
- **Hielo/Volador**: Articuno
- **Dragón/Volador**: Dragonite

### ⚔️ Sistema de Batalla
- **Cálculo de daño realista**: Basado en las fórmulas originales de Pokémon
- **STAB (Same Type Attack Bonus)**: +50% de daño para movimientos del mismo tipo
- **Sistema de tipos completo**: Con todas las efectividades y resistencias
- **Movimientos físicos vs especiales**: Usa las estadísticas correctas
- **IA inteligente**: Prioriza movimientos súper efectivos con 70% de probabilidad

### 🎨 Diseño
- **Estética retro**: Fuente Press Start 2P
- **Animaciones fluidas**: Shake, hit, faint
- **Background dinámico**: Imagen de fondo de batalla Pokémon
- **Interfaz intuitiva**: Badges de tipos, indicadores de efectividad
- **Mini-equipos**: Vista rápida del estado de todos los Pokémon

## 🚀 Cómo Usar

### 1. Configuración
Asegúrate de que todos los archivos estén en la estructura correcta:
- `index.html` en la raíz
- `styles.css` en la raíz
- Carpeta `data/` con los 3 archivos JS
- Carpeta `js/` con los 6 archivos JS

### 2. Ejecutar
Simplemente abre `index.html` en tu navegador web.

### 3. Jugar
1. **Selecciona tu equipo**: Haz clic en los Pokémon disponibles para añadirlos (3-6 Pokémon)
2. **Inicia la batalla**: Presiona el botón "⚔️ INICIAR BATALLA"
3. **Elige movimientos**: Haz clic en los movimientos para atacar
4. **Cambia Pokémon**: Usa el botón "🔄 CAMBIAR" para cambiar de Pokémon
5. **Gana**: ¡Derrota a todos los Pokémon enemigos!

## 📊 Añadir Nuevo Contenido

### Añadir un Nuevo Pokémon

**Archivo**: `data/pokemon.js`

```javascript
151: {
    id: 151,
    name: "MEW",
    types: ["PSÍQUICO"],
    moves: ["Psíquico", "Bola Sombra", "Onda Ígnea", "Rayo Hielo"],
    stats: {hp: 170, atk: 130, def: 130, spa: 130, spd: 130, spe: 130}
}
```

### Añadir un Nuevo Movimiento

**Archivo**: `data/moves.js`

1. Añadir el tipo del movimiento en `MoveTypes`:
```javascript
"Psicorayo": "PSÍQUICO"
```

2. Añadir el poder en `MovePower`:
```javascript
"Psicorayo": 65
```

3. Si es físico, añadirlo a `PhysicalMoves`:
```javascript
"Psicorayo"  // Solo si es físico
```

### Añadir un Nuevo Tipo

**Archivo**: `data/types.js`

1. Añadir color en `TypeColors`:
```javascript
HADA: "bg-pink-300"
```

2. Añadir efectividades en `TypeChart`:
```javascript
HADA: {
    LUCHA: 2,
    DRAGÓN: 2,
    SINIESTRO: 2,
    FUEGO: 0.5,
    VENENO: 0.5,
    ACERO: 0.5
}
```

## 🎯 Características Técnicas

### Arquitectura Modular
- **Separación de responsabilidades**: Cada archivo tiene una función clara
- **Sin dependencias externas**: Solo usa Tailwind CSS via CDN
- **Código limpio y documentado**: Comentarios en español
- **Fácil de mantener**: Estructura lógica y organizada

### Cálculo de Daño
```
Daño = ((2 × Nivel / 5 + 2) × Poder × Ataque / Defensa) / 50 + 2
Daño × STAB (1.5 si aplica)
Daño × Efectividad (0, 0.5, 1, 2, o 4)
Daño × Factor aleatorio (0.85 - 1.0)
```

### Sistema de Tipos
- 15 tipos implementados
- Efectividades múltiples (4x, 2x, 1x, 0.5x, 0.25x, 0x)
- Inmunidades correctas (Tierra vs Eléctrico, Normal vs Fantasma, etc.)

## 🐛 Solución de Problemas

### Los sprites no cargan
- Verifica tu conexión a internet (usa sprites de PokeAPI)
- Los sprites se cargan desde: `https://raw.githubusercontent.com/PokeAPI/sprites/`

### Los archivos JS no se cargan
- Asegúrate de que la estructura de carpetas sea correcta
- Abre la consola del navegador (F12) para ver errores

### El diseño se ve mal
- Verifica que Tailwind CSS se cargue correctamente
- Comprueba la conexión a `https://cdn.tailwindcss.com`

## 📝 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🎉 Créditos

- **Sprites**: PokeAPI (https://pokeapi.co/)
- **Fuente**: Press Start 2P (Google Fonts)
- **Background**: Alpha Coders
- **Framework CSS**: Tailwind CSS

---

**¡Disfruta del simulador de batallas Pokémon!** ⚡🔥💧🌿
