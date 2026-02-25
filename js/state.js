// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/state.js  —  ESTADO DEL JUEGO                                        ║
// ║  Variables globales que representan el estado actual de la partida.      ║
// ║  No tocar salvo que sepas lo que haces.                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

let playerTeamRaw = [];    // Datos raw del team-builder (IDs, EVs, items)
let playerTeam    = [];    // Pokémon activos con currentHp, statBoosts, etc.
let enemyTeam     = [];
let playerActive  = 0;     // Índice del Pokémon activo del jugador
let enemyActive   = 0;
let battleOver    = false;
let turnCount     = 1;
let isBusy        = false; // Bloquea botones mientras hay animación
let switchForced  = false; // El cambio es obligatorio (Pokémon debilitado)

// ─── EFECTOS DE CAMPO ─────────────────────────────────────────────────────────
// Almacenar efectos de campo (Stealth Rock, etc.) por lado
const fieldState = {
    playerSide: { stealthRock: false },
    enemySide:  { stealthRock: false }
};
