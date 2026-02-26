// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/battle-main.js  —  INICIALIZACIÓN Y MODOS DE BATALLA                ║
// ║                                                                          ║
// ║  Modos:                                                                  ║
// ║   &trainer=ID  → vs. entrenador fijo (TrainersDB)                       ║
// ║   &wild=DIFF   → ambos equipos aleatorios (normal/hard/chaos)           ║
// ║   (sin modo)   → batalla libre vs rival random                          ║
// ║   &level=N     → nivel 1–100 (defecto 100)                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

let battleMode     = 'free';
let trainerData    = null;
let wildDifficulty = 'normal';
let battleLevel    = 100;

// Estado de revelación: oculta habilidad y objeto del rival hasta que se usen
const enemyRevealed  = { item:false, ability:false };
const playerRevealed = { item:false, ability:false };

function init() {
    const params = new URLSearchParams(window.location.search);
    battleLevel  = Math.min(100, Math.max(1, parseInt(params.get('level') || '100')));

    // ─ MODO MULTIJUGADOR: el servidor controla todo ───────────────────────
    // multiplayer.js registra handlers y llama startMPBattle() cuando
    // el servidor confirma la batalla. Aquí solo ocultamos el layout.
    if (params.has('mp')) {
        battleMode = 'online';
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = 'none';
        return; // El resto lo gestiona multiplayer.js
    }

    const trainerId = params.get('trainer');
    const wildDiff  = params.get('wild');

    // ─ Determinar modo ───────────────────────────────────────────────────────
    if (trainerId && typeof TrainersDB !== 'undefined' && TrainersDB[trainerId]) {
        battleMode  = 'trainer';
        trainerData = TrainersDB[trainerId];
    } else if (wildDiff !== null) {
        battleMode     = 'wild';
        wildDifficulty = wildDiff || 'normal';
    } else {
        battleMode = 'free';
    }

    // ─ Modo salvaje: ambos equipos aleatorios, no hace falta leer team param ─
    if (battleMode === 'wild') {
        buildWildBattle();
        return;
    }

    // ─ Modo trainer/libre: leer equipo del jugador ───────────────────────────
    let rawData = null;
    try {
        const tp = params.get('team');
        if (tp) {
            rawData = decodeURIComponent(tp);
            try { localStorage.setItem('kantoTeam', rawData); } catch(e){}
            try { sessionStorage.setItem('kantoTeam', rawData); } catch(e){}
        }
    } catch(e){}
    if (!rawData) try { rawData = sessionStorage.getItem('kantoTeam'); } catch(e){}
    if (!rawData) try { rawData = localStorage.getItem('kantoTeam') || localStorage.getItem('savedTeam'); } catch(e){}

    if (!rawData) { showError('NO HAY EQUIPO', 'Ve al constructor y arma tu equipo.'); return; }

    let parsed;
    try { parsed = JSON.parse(rawData); }
    catch(e) { showError('ERROR DE DATOS', 'Datos corruptos. Ve al constructor.'); return; }

    if (!Array.isArray(parsed) || !parsed.length) { showError('EQUIPO VACÍO', 'Añade al menos 3 Pokémon.'); return; }

    playerTeamRaw = parsed.filter(e => PokemonDB[e.id]);
    if (!playerTeamRaw.length) { showError('POKÉMON NO ENCONTRADOS', 'Reconstruye el equipo.'); return; }

    buildPlayerBattle();
}

// ─── CONSTRUIR BATALLA CON EQUIPO DEL JUGADOR ─────────────────────────────────
function buildPlayerBattle() {
    playerTeam = playerTeamRaw.map(e => makePokemon(PokemonDB[e.id], e, battleLevel));

    if (battleMode === 'trainer') {
        // Equipo del entrenador con sus propios EVs/naturaleza definidos en trainers.js
        enemyTeam = trainerData.team
            .map(te => { const b = PokemonDB[te.id]; return b ? makePokemon(b, te, battleLevel) : null; })
            .filter(Boolean);
    } else {
        // Batalla libre: rival con Pokémon aleatorios del pool
        const usedIds = new Set(playerTeam.map(p => p.id));
        const pool    = Object.values(PokemonDB).filter(p => !usedIds.has(p.id));
        const shuffled = pool.sort(() => Math.random() - 0.5);
        enemyTeam = shuffled.slice(0, playerTeam.length).map(p => makeWildPokemon(p, 'normal', battleLevel));
    }

    startBattle();
}

// ─── MODO SALVAJE: AMBOS EQUIPOS ALEATORIOS ───────────────────────────────────
function buildWildBattle() {
    const allPokemon = Object.values(PokemonDB).sort(() => Math.random() - 0.5);
    const size       = Math.min(6, Math.max(3, Math.floor(allPokemon.length / 2)));
    const half       = Math.floor(allPokemon.length / 2);

    playerTeam = allPokemon.slice(0, Math.min(size, half))
        .map(p => makeWildPokemon(p, wildDifficulty, battleLevel));
    enemyTeam  = allPokemon.slice(half, half + Math.min(size, allPokemon.length - half))
        .map(p => makeWildPokemon(p, wildDifficulty, battleLevel));

    startBattle();
}

// ─── FACTORY: CREAR POKÉMON CON FÓRMULA OFICIAL ───────────────────────────────
function makePokemon(base, entry, level) {
    entry  = entry  || {};
    level  = level  || 100;
    const evs     = entry.evs     || {hp:0,atk:0,def:0,spa:0,spd:0,spe:0};
    const nature  = entry.nature  || 'Seria';
    const ability = entry.ability || (base.abilities && base.abilities[0]) || base.ability || '';
    const moves   = (entry.moves && entry.moves.length) ? entry.moves : [...base.moves];
    const stats   = buildStats(base.stats, evs, level, nature);
    return {
        ...base,
        stats, moves, ability, nature, level,
        item:       entry.item || 'Ninguno',
        currentHp:  stats.hp,
        fainted:    false,
        itemUsed:   false,
        status:     null,
        statBoosts: { atk:0, def:0, spa:0, spd:0, spe:0 },
    };
}

function makeWildPokemon(base, difficulty, level) {
    const natures = Object.keys(NaturesDB);
    const nature  = natures[Math.floor(Math.random() * natures.length)];
    const ability = pickRandAbility(base);
    let evs, item;

    if (difficulty === 'chaos') {
        evs  = { hp:rndEv(252), atk:rndEv(252), def:rndEv(252), spa:rndEv(252), spd:rndEv(252), spe:rndEv(252) };
        item = randFrom(Object.values(ItemsDB).map(i => i.name));
    } else if (difficulty === 'hard') {
        const phys = base.stats.atk >= base.stats.spa;
        evs  = { hp:4, atk:phys?252:0, def:phys?0:4, spa:phys?0:252, spd:0, spe:252 };
        item = randFrom(['Restos','Orbe Vida','Banda Elegida','Gafas Especiales','Cinta Focus']);
    } else {
        evs  = { hp:rndEv(100), atk:rndEv(100), def:rndEv(100), spa:rndEv(100), spd:rndEv(100), spe:rndEv(100) };
        item = randFrom(['Ninguno','Ninguno','Restos','Orbe Vida','Baya Zidra']);
    }

    const stats = buildStats(base.stats, evs, level, nature);
    return {
        ...base,
        stats, ability, nature, level,
        moves:      [...base.moves],
        item, currentHp: stats.hp,
        fainted:    false,
        itemUsed:   false,
        status:     null,
        statBoosts: { atk:0, def:0, spa:0, spd:0, spe:0 },
    };
}

// ─── MODO ONLINE: iniciar batalla con datos del servidor ──────────────────────
// Llamado desde multiplayer.js cuando llega 'battle_start'
function startMPBattle(myTeam, oppTeam, myName, myAvatar, oppName, oppAvatar, seed) {
    battleMode   = 'online';
    playerTeam   = myTeam;
    enemyTeam    = oppTeam;
    playerActive = 0;
    enemyActive  = 0;
    battleOver   = false;
    turnCount    = 1;
    isBusy       = false;
    window._matchSeed = seed;

    const layout = document.querySelector('.battle-layout');
    if (layout) layout.style.display = '';

    startBattle();
}

// ─── ARRANCAR BATALLA ─────────────────────────────────────────────────────────
function startBattle() {
    enemyRevealed.item = false; enemyRevealed.ability = false;
    playerRevealed.item = false; playerRevealed.ability = false;

    updateUI();
    renderMoves();

    // Actualizar header con info del modo
    const hdr = document.querySelector('.field-header div:nth-child(2)');
    if (hdr) {
        if (battleMode === 'trainer')
            hdr.innerHTML = `${trainerData.avatar} ${trainerData.name} <span style="font-size:5px;color:#64748b;">— ${trainerData.title}</span>`;
        else if (battleMode === 'wild')
            hdr.innerHTML = `🎲 SALVAJE <span style="font-size:5px;color:#64748b;">${wildDifficulty.toUpperCase()} · Nvl ${battleLevel}</span>`;
        else
            hdr.innerHTML = `⚔️ BATALLA LIBRE <span style="font-size:5px;color:#64748b;">Nvl ${battleLevel}</span>`;
    }

    addLog('⚔️ ¡LA BATALLA COMENZÓ!', 'important');
    if (battleMode === 'trainer')
        addLog(`${trainerData.avatar} ¡${trainerData.name} quiere combatir!`, 'important');
    else if (battleMode === 'wild')
        addLog('🎲 ¡Modo Salvaje! Ambos equipos son aleatorios.', 'important');
    addLog(`Tu equipo: ${playerTeam.map(p => `${p.name}(${p.stats.hp}hp)`).join(', ')}`, 'important');
    addLog(`Rival: ${enemyTeam.map(p => p.name).join(', ')}`, 'important');
    addLog('━━━━━━━━━━━━━━', 'separator');

    const fp = playerTeam[playerActive];
    const fe = enemyTeam[enemyActive];
    applyAbilitySwitchIn(fp, fe, addLog);
    applyAbilitySwitchIn(fe, fp, addLog);
    if (fp.statBoosts.atk !== 0 || fe.statBoosts.atk !== 0) updateUI();
}

// ─── REVELAR STATS DEL RIVAL CUANDO SE USAN ──────────────────────────────────
function revealEnemyStat(type, pokemon) {
    if (type === 'item' && !enemyRevealed.item && pokemon.item && pokemon.item !== 'Ninguno') {
        enemyRevealed.item = true;
        addLog(`🔍 ¡${pokemon.name} lleva ${pokemon.item}!`, 'boost');
    }
    if (type === 'ability' && !enemyRevealed.ability) {
        const ab = AbilitiesDB[pokemon.ability];
        enemyRevealed.ability = true;
        addLog(`${ab ? ab.icon : '⚡'} ¡${pokemon.name} tiene ${pokemon.ability}!`, 'boost');
    }
}
function revealPlayerStat(type, pokemon) {
    if (type === 'item' && !playerRevealed.item && pokemon.item && pokemon.item !== 'Ninguno') {
        playerRevealed.item = true;
    }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function rndEv(max)          { return Math.floor(Math.random() * (max / 4 + 1)) * 4; }
function randFrom(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }
function pickRandAbility(b)  { const a = b.abilities || [b.ability]; return a[Math.floor(Math.random()*a.length)] || a[0]; }

function showError(titulo, msg) {
    const l = document.querySelector('.battle-layout');
    if (l) l.style.display = 'none';
    document.body.innerHTML += `<div style="position:fixed;inset:0;background:#050510;display:flex;align-items:center;justify-content:center;font-family:'Courier New',Courier,monospace;z-index:9999"><div style="background:#0a0a1a;border:2px solid #ef4444;border-radius:8px;padding:2.5rem;max-width:480px;width:90%;text-align:center"><div style="font-size:36px;margin-bottom:1rem">⚠️</div><div style="color:#ef4444;font-size:11px;margin-bottom:1rem">${titulo}</div><div style="color:#64748b;font-size:7.5px;line-height:2;margin-bottom:2rem">${msg}</div><a href="team-builder.html" style="display:inline-block;padding:.8rem 1.8rem;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#1a1a2e;border-radius:4px;font-family:'Courier New',Courier,monospace;font-size:8px;text-decoration:none">⚙️ IR AL CONSTRUCTOR</a></div></div>`;
}

// generateEnemyTeam() obsoleto — mantenido por compatibilidad con training-mode.js
function generateEnemyTeam() { /* Ahora gestionado por buildPlayerBattle() / buildWildBattle() */ }

function revancha() { window.location.reload(); }

init();