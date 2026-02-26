// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  server/server.js  —  SERVIDOR MULTIJUGADOR v3                           ║
// ║                                                                          ║
// ║  CAMBIO FUNDAMENTAL:                                                     ║
// ║   El servidor ejecuta TODA la física de batalla:                        ║
// ║   daño, crits, estados, fainted, fin de turno.                          ║
// ║   Los clientes ANIMAN los resultados que el servidor manda.             ║
// ║   Esto elimina: desincronización de estados, daño diferente,            ║
// ║   y el bug de bloqueo al debilitar un Pokémon.                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '..')));

const rooms = new Map();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code;
    do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
    while (rooms.has(code));
    return code;
}
function send(ws, type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type, ...payload }));
}
function broadcast(room, type, payload) {
    room.players.forEach(ws => send(ws, type, payload));
}
function opp(idx) { return idx === 0 ? 1 : 0; }

// ═══════════════════════════════════════════════════════════════════════════════
//  MOTOR DE BATALLA (SERVER-SIDE)
//  Toda la aleatoriedad ocurre aquí → ambos clientes reciben resultados iguales
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_CHART = {
    FUEGO:     { PLANTA:2, HIELO:2, BICHO:2, ACERO:2, AGUA:.5, ROCA:.5, FUEGO:.5, DRAGÓN:.5 },
    AGUA:      { FUEGO:2, TIERRA:2, ROCA:2, PLANTA:.5, AGUA:.5, DRAGÓN:.5 },
    PLANTA:    { AGUA:2, TIERRA:2, ROCA:2, FUEGO:.5, PLANTA:.5, VENENO:.5, VOLADOR:.5, BICHO:.5, DRAGÓN:.5, ACERO:.5 },
    ELÉCTRICO: { AGUA:2, VOLADOR:2, PLANTA:.5, ELÉCTRICO:.5, DRAGÓN:.5, TIERRA:0 },
    HIELO:     { PLANTA:2, TIERRA:2, VOLADOR:2, DRAGÓN:2, FUEGO:.5, AGUA:.5, HIELO:.5, ACERO:.5 },
    LUCHA:     { NORMAL:2, HIELO:2, ROCA:2, SINIESTRO:2, ACERO:2, VENENO:.5, BICHO:.5, PSÍQUICO:.5, VOLADOR:.5, HADA:.5, FANTASMA:0 },
    VENENO:    { PLANTA:2, HADA:2, VENENO:.5, TIERRA:.5, ROCA:.5, FANTASMA:.5, ACERO:0 },
    TIERRA:    { FUEGO:2, ELÉCTRICO:2, VENENO:2, ROCA:2, ACERO:2, PLANTA:.5, BICHO:.5, VOLADOR:0 },
    VOLADOR:   { PLANTA:2, LUCHA:2, BICHO:2, ELÉCTRICO:.5, ROCA:.5, ACERO:.5 },
    PSÍQUICO:  { LUCHA:2, VENENO:2, PSÍQUICO:.5, ACERO:.5, SINIESTRO:0 },
    BICHO:     { PLANTA:2, PSÍQUICO:2, SINIESTRO:2, FUEGO:.5, LUCHA:.5, VOLADOR:.5, FANTASMA:.5, ACERO:.5, HADA:.5 },
    ROCA:      { FUEGO:2, HIELO:2, VOLADOR:2, BICHO:2, LUCHA:.5, TIERRA:.5, ACERO:.5 },
    FANTASMA:  { FANTASMA:2, PSÍQUICO:2, SINIESTRO:.5, NORMAL:0 },
    DRAGÓN:    { DRAGÓN:2, ACERO:.5, HADA:0 },
    SINIESTRO: { FANTASMA:2, PSÍQUICO:2, LUCHA:.5, SINIESTRO:.5, HADA:.5 },
    ACERO:     { HIELO:2, ROCA:2, HADA:2, FUEGO:.5, AGUA:.5, ELÉCTRICO:.5, ACERO:.5 },
    HADA:      { LUCHA:2, DRAGÓN:2, SINIESTRO:2, FUEGO:.5, VENENO:.5, ACERO:.5 },
    NORMAL:    { ROCA:.5, ACERO:.5, FANTASMA:0 },
};

function calcEffectiveness(type, defTypes) {
    let m = 1;
    for (const dt of (defTypes || [])) m *= ((TYPE_CHART[type] || {})[dt] !== undefined ? (TYPE_CHART[type] || {})[dt] : 1);
    return m;
}

function stageMult(s) {
    const c = Math.max(-6, Math.min(6, s || 0));
    return c >= 0 ? (2 + c) / 2 : 2 / (2 - c);
}

function getModStats(p) {
    const b = p.statBoosts || {};
    const paraMult = p.status === 'paralysis' ? 0.5 : 1;
    return {
        atk: Math.floor(p.stats.atk * stageMult(b.atk)),
        def: Math.floor(p.stats.def * stageMult(b.def)),
        spa: Math.floor(p.stats.spa * stageMult(b.spa)),
        spd: Math.floor(p.stats.spd * stageMult(b.spd)),
        spe: Math.floor(p.stats.spe * stageMult(b.spe) * paraMult),
    };
}

function calcDmg(atk, def, move, rnd) {
    if (!move || !move.power || move.category === 'status') return { damage: 0, eff: 1 };
    const isPhys = move.category === 'physical';
    const aS = getModStats(atk), dS = getModStats(def);
    const a = isPhys ? aS.atk : aS.spa;
    const d = isPhys ? dS.def : dS.spd;
    const lvl = atk.level || 100;
    let dmg = Math.floor(Math.floor(Math.floor(2 * lvl / 5 + 2) * move.power * a / d) / 50) + 2;
    const stab = (atk.types || []).includes(move.type) ? 1.5 : 1;
    const eff = calcEffectiveness(move.type, def.types);
    dmg *= stab * eff;
    if (atk.status === 'burn' && isPhys) dmg *= 0.5;
    dmg *= (0.85 + rnd * 0.15); // factor aleatorio 85-100%
    return { damage: Math.max(1, Math.floor(dmg)), eff };
}

function immuneToStatus(p, sk) {
    const t = p.types || [];
    if (sk === 'burn'     && t.includes('FUEGO'))     return true;
    if (sk === 'freeze'   && t.includes('HIELO'))     return true;
    if (sk === 'paralysis'&& t.includes('ELÉCTRICO')) return true;
    if ((sk==='poison'||sk==='toxic') && (t.includes('VENENO')||t.includes('ACERO'))) return true;
    return false;
}

// ─── RESOLVER TURNO (física 100% server-side) ─────────────────────────────────
function resolveTurn(room) {
    const m0 = room.moves[0], m1 = room.moves[1];
    if (!m0 || !m1) return;

    const gs   = room.gameState;
    const T    = gs.teams;
    const AI   = gs.activeIdx;
    const evs  = [];

    // Números aleatorios para este turno (uno por uso)
    let rIdx = 0;
    const RNDS = Array.from({ length: 20 }, () => Math.random());
    const R = () => RNDS[rIdx++ % RNDS.length];

    const getA = i => T[i][AI[i]];

    // ── Cambios voluntarios primero ───────────────────────────────────────
    let sw0 = false, sw1 = false;
    if (m0.type === 'switch') { const old = getA(0).name; AI[0] = m0.switchTo; sw0 = true; evs.push({ t:'switch', player:0, from:old, to:getA(0).name, idx:m0.switchTo }); }
    if (m1.type === 'switch') { const old = getA(1).name; AI[1] = m1.switchTo; sw1 = true; evs.push({ t:'switch', player:1, from:old, to:getA(1).name, idx:m1.switchTo }); }

    if (sw0 && sw1) { endOfTurn(T, AI, evs, R); return finalizeTurn(room, evs, gs); }

    // ── Determinar orden ─────────────────────────────────────────────────
    let order;
    if (sw0 && !sw1)      { order = [1, 0]; }
    else if (sw1 && !sw0) { order = [0, 1]; }
    else {
        const s0 = getModStats(getA(0)).spe;
        const s1 = getModStats(getA(1)).spe;
        if (s0 !== s1) { order = s0 > s1 ? [0,1] : [1,0]; evs.push({ t:'speed', faster: s0>s1?0:1 }); }
        else { order = R() < 0.5 ? [0,1] : [1,0]; evs.push({ t:'speed_tie', winner: order[0] }); }
    }

    // ── Ejecutar ataques ─────────────────────────────────────────────────
    for (const atkI of order) {
        const defI  = opp(atkI);
        const move  = atkI === 0 ? m0 : m1;
        if (move.type !== 'move') continue;

        const a = getA(atkI), d = getA(defI);
        if (a.fainted || d.fainted) continue;

        // Chequeo de estado
        if (a.status === 'sleep') {
            if (a.sleepTurns === undefined) a.sleepTurns = 1 + Math.floor(R() * 3);
            a.sleepTurns--;
            if (a.sleepTurns <= 0) { a.status = null; evs.push({ t:'wake', player:atkI, pokemon:a.name }); }
            else { evs.push({ t:'status_block', player:atkI, status:'sleep', pokemon:a.name }); continue; }
        }
        if (a.status === 'freeze') {
            if (R() < 0.2) { a.status = null; evs.push({ t:'thaw', player:atkI, pokemon:a.name }); }
            else { evs.push({ t:'status_block', player:atkI, status:'freeze', pokemon:a.name }); continue; }
        }
        if (a.status === 'paralysis' && R() < 0.25) {
            evs.push({ t:'status_block', player:atkI, status:'paralysis', pokemon:a.name }); continue;
        }

        evs.push({ t:'use_move', player:atkI, moveName:move.moveName, attacker:a.name, defender:d.name });

        const mv = move.moveData || { name:move.moveName, power:80, category:'physical', type:'NORMAL', accuracy:100, effect:null, effectChance:0 };

        // Movimiento de estado
        if (mv.category === 'status') {
            applyStatusMove(a, d, mv, atkI, defI, evs, R, AI, T);
            continue;
        }

        // Accuracy
        if (mv.accuracy && mv.accuracy < 100 && R() * 100 > mv.accuracy) {
            evs.push({ t:'miss', player:atkI, moveName:move.moveName }); continue;
        }

        // Calcular daño
        const { damage, eff } = calcDmg(a, d, mv, R());
        let dmgApplied = damage;

        // Cinta Focus
        if (!d.itemUsed && d.item === 'Cinta Focus' && d.currentHp === d.stats.hp && d.currentHp - dmgApplied <= 0) {
            d.currentHp = 1; d.itemUsed = true;
            evs.push({ t:'focus_sash', player:defI, pokemon:d.name });
        } else {
            d.currentHp = Math.max(0, d.currentHp - dmgApplied);
            if (d.currentHp <= 0) d.fainted = true;
        }

        evs.push({ t:'damage', player:defI, pokemon:d.name, damage:dmgApplied, eff, currentHp:d.currentHp, maxHp:d.stats.hp });
        if (eff > 1)  evs.push({ t:'eff', level:'super' });
        if (eff < 1 && eff > 0) evs.push({ t:'eff', level:'weak' });
        if (eff === 0) evs.push({ t:'eff', level:'none' });

        // Recoil
        if (mv.effect === 'recoil_33') {
            const r = Math.floor(dmgApplied * 0.33);
            a.currentHp = Math.max(0, a.currentHp - r);
            if (a.currentHp <= 0) a.fainted = true;
            evs.push({ t:'recoil', player:atkI, damage:r, currentHp:a.currentHp });
        }

        // Orbe Vida
        if (a.item === 'Orbe Vida' && !a.fainted) {
            const o = Math.floor(a.stats.hp * 0.1);
            a.currentHp = Math.max(0, a.currentHp - o);
            if (a.currentHp <= 0) a.fainted = true;
            evs.push({ t:'life_orb', player:atkI, damage:o, currentHp:a.currentHp });
        }

        // Efecto secundario de estado
        if (!d.fainted && mv.effect?.startsWith('apply_') && R() * 100 < (mv.effectChance || 0)) {
            const sk = mv.effect.replace('apply_', '');
            if (!d.status && !immuneToStatus(d, sk)) {
                d.status = sk;
                if (sk === 'sleep') d.sleepTurns = 1 + Math.floor(R() * 3);
                evs.push({ t:'apply_status', player:defI, pokemon:d.name, status:sk });
            }
        }

        // Baya Zidra
        if (!d.fainted && !d.itemUsed && d.item === 'Baya Zidra' && d.currentHp / d.stats.hp < 0.25) {
            const h = Math.floor(d.stats.hp / 3);
            d.currentHp = Math.min(d.currentHp + h, d.stats.hp);
            d.itemUsed = true;
            evs.push({ t:'berry', player:defI, pokemon:d.name, heal:h, currentHp:d.currentHp });
        }

        // ── Verificar fainted INMEDIATAMENTE tras el ataque ───────────────
        if (d.fainted) {
            evs.push({ t:'faint', player:defI, pokemon:d.name });
            if (T[defI].every(p => p.fainted)) {
                evs.push({ t:'battle_over', winner:atkI });
                finalizeTurn(room, evs, gs);
                endBattleServer(room, atkI);
                return;
            }
            // El defensor necesita elegir nuevo Pokémon — pausar turno aquí
            evs.push({ t:'need_switch', player:defI });
            finalizeTurn(room, evs, gs);
            room.waitingForSwitch = defI;
            return;
        }

        if (a.fainted) {
            evs.push({ t:'faint', player:atkI, pokemon:a.name });
            if (T[atkI].every(p => p.fainted)) {
                evs.push({ t:'battle_over', winner:defI });
                finalizeTurn(room, evs, gs);
                endBattleServer(room, defI);
                return;
            }
            evs.push({ t:'need_switch', player:atkI });
            finalizeTurn(room, evs, gs);
            room.waitingForSwitch = atkI;
            return;
        }
    }

    // ── Fin de turno ─────────────────────────────────────────────────────
    endOfTurn(T, AI, evs, R);

    // Fainted por daño de estado
    for (let i = 0; i < 2; i++) {
        const active = T[i][AI[i]];
        if (active.fainted && !evs.some(e => e.t === 'faint' && e.player === i)) {
            evs.push({ t:'faint', player:i, pokemon:active.name });
            if (T[i].every(p => p.fainted)) {
                evs.push({ t:'battle_over', winner:opp(i) });
                finalizeTurn(room, evs, gs);
                endBattleServer(room, opp(i));
                return;
            }
            evs.push({ t:'need_switch', player:i });
        }
    }

    finalizeTurn(room, evs, gs);
}

function endOfTurn(T, AI, evs, R) {
    for (let i = 0; i < 2; i++) {
        const p = T[i][AI[i]];
        if (p.fainted) continue;
        if (p.item === 'Restos') {
            const h = Math.floor(p.stats.hp / 16);
            p.currentHp = Math.min(p.currentHp + h, p.stats.hp);
            evs.push({ t:'heal', player:i, source:'leftovers', amount:h, currentHp:p.currentHp });
        }
        const statusDmg = { burn: 1/16, poison: 1/8 };
        if (statusDmg[p.status]) {
            const d = Math.max(1, Math.floor(p.stats.hp * statusDmg[p.status]));
            p.currentHp = Math.max(0, p.currentHp - d);
            if (p.currentHp <= 0) p.fainted = true;
            evs.push({ t:'status_damage', player:i, status:p.status, damage:d, currentHp:p.currentHp });
        }
        if (p.status === 'toxic') {
            p.toxicCounter = (p.toxicCounter || 1);
            const d = Math.max(1, Math.floor(p.stats.hp / 16 * p.toxicCounter));
            p.toxicCounter++;
            p.currentHp = Math.max(0, p.currentHp - d);
            if (p.currentHp <= 0) p.fainted = true;
            evs.push({ t:'status_damage', player:i, status:'toxic', damage:d, currentHp:p.currentHp });
        }
        p.protected = false;
    }
}

function applyStatusMove(a, d, mv, atkI, defI, evs, R, AI, T) {
    if (mv.effect === 'heal_50') {
        const h = Math.floor(a.stats.hp * 0.5);
        a.currentHp = Math.min(a.currentHp + h, a.stats.hp);
        evs.push({ t:'heal', player:atkI, source:'move', amount:h, currentHp:a.currentHp }); return;
    }
    if (mv.effect === 'boost_atk_spe') {
        a.statBoosts.atk = Math.min(6, (a.statBoosts.atk||0)+1);
        a.statBoosts.spe = Math.min(6, (a.statBoosts.spe||0)+1);
        evs.push({ t:'boost', player:atkI, stat:'atk+spe', amount:1 }); return;
    }
    if (mv.effect === 'boost_spe') {
        a.statBoosts.spe = Math.min(6, (a.statBoosts.spe||0)+1);
        evs.push({ t:'boost', player:atkI, stat:'spe', amount:1 }); return;
    }
    if (mv.effect === 'protect') {
        a.protected = true;
        evs.push({ t:'protect', player:atkI }); return;
    }
    if (mv.effect?.startsWith('apply_')) {
        if (mv.accuracy && mv.accuracy < 100 && R()*100 > mv.accuracy) { evs.push({ t:'miss', player:atkI }); return; }
        const sk = mv.effect.replace('apply_', '');
        if (d.status)               { evs.push({ t:'status_fail', reason:'has_status', player:defI }); return; }
        if (immuneToStatus(d, sk))  { evs.push({ t:'status_fail', reason:'immune',     player:defI }); return; }
        d.status = sk;
        if (sk === 'sleep') d.sleepTurns = 1 + Math.floor(R() * 3);
        evs.push({ t:'apply_status', player:defI, pokemon:d.name, status:sk });
    }
}

function initGameState(room) {
    room.gameState = {
        teams: [0, 1].map(i => room.teams[i].map(p => ({
            ...p,
            statBoosts: { atk:0, def:0, spa:0, spd:0, spe:0 },
            fainted:    false,
            itemUsed:   false,
            currentHp:  p.stats?.hp || 100,
            status:     null,
        }))),
        activeIdx: [0, 0],
    };
}

function finalizeTurn(room, evs, gs) {
    room.moves = [null, null];
    room.turnCount++;
    room.players.forEach((ws, i) => {
        send(ws, 'turn_result', {
            events: evs,
            myTeamState:  gs.teams[i].map(p => ({ id:p.id, currentHp:p.currentHp, fainted:p.fainted, status:p.status, statBoosts:p.statBoosts })),
            oppTeamState: gs.teams[opp(i)].map(p => ({ id:p.id, currentHp:p.currentHp, fainted:p.fainted, status:p.status, statBoosts:p.statBoosts })),
            myActiveIdx:   gs.activeIdx[i],
            oppActiveIdx:  gs.activeIdx[opp(i)],
            turnCount:     room.turnCount,
        });
    });
}

function endBattleServer(room, winnerIdx) {
    room.state = 'ended';
    setTimeout(() => rooms.delete(room.code), 60000);
    console.log(`[${room.code}] Batalla terminada — ganador: jugador ${winnerIdx}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════════════════════════════════════════
wss.on('connection', (ws) => {
    ws._roomCode  = null;
    ws._playerIdx = null;

    ws.on('message', (raw) => {
        let msg; try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {

            case 'create_room': {
                const code = genCode();
                const seed = msg.matchSeed || Date.now().toString(36);
                const room = {
                    code, state: 'waiting',
                    players: [ws, null],
                    teams:   [null, null],
                    userNames:   [msg.userName  || 'Jugador 1', null],
                    userAvatars: [msg.userAvatar || '🎮',        null],
                    moves:   [null, null],
                    activeIdx: [0, 0],
                    turnCount: 1,
                    disconnectTimers: [null, null],
                    matchSeed: seed,
                    waitingForSwitch: null,
                    gameState: null,
                };
                rooms.set(code, room);
                ws._roomCode = code; ws._playerIdx = 0;
                send(ws, 'room_created', { code, playerIdx:0, matchSeed:seed });
                console.log(`[${code}] Sala creada — ${room.userNames[0]}`);
                break;
            }

            case 'join_room': {
                const code = (msg.code || '').toUpperCase().trim();
                const room = rooms.get(code);
                if (!room) { send(ws, 'error', { msg:'Sala no encontrada. Puede haber expirado.' }); break; }
                if (room.state === 'ended') { send(ws, 'error', { msg:'Partida ya terminada.' }); break; }

                // Reconexión
                if (msg.playerIdx !== undefined) {
                    const idx = parseInt(msg.playerIdx);
                    if (idx >= 0 && idx < 2 && room.players[idx] === null) {
                        if (room.disconnectTimers[idx]) { clearTimeout(room.disconnectTimers[idx]); room.disconnectTimers[idx] = null; }
                        room.players[idx] = ws;
                        if (msg.userName)   room.userNames[idx]   = msg.userName;
                        if (msg.userAvatar) room.userAvatars[idx] = msg.userAvatar;
                        ws._roomCode = code; ws._playerIdx = idx;
                        const o = room.players[opp(idx)];
                        if (o) send(o, 'opponent_reconnected', {});
                        if (room.state === 'battle') send(ws, 'reconnected_ok', { myIdx:idx, turnCount:room.turnCount });
                        else send(ws, 'room_joined', { code, playerIdx:idx });
                        console.log(`[${code}] Jugador ${idx+1} reconectado`);
                        break;
                    }
                }

                if (room.players[1]) { send(ws, 'error', { msg:'Sala llena.' }); break; }
                room.players[1] = ws;
                room.userNames[1]  = msg.userName  || 'Jugador 2';
                room.userAvatars[1]= msg.userAvatar || '🎮';
                ws._roomCode = code; ws._playerIdx = 1;
                send(ws, 'room_joined', { code, playerIdx:1 });
                send(room.players[0], 'opponent_joined', {});
                console.log(`[${code}] Jugador 2: ${room.userNames[1]}`);
                break;
            }

            case 'submit_team': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                const idx = ws._playerIdx;
                room.teams[idx] = msg.team;

                if (room.teams[0] && room.teams[1]) {
                    room.state = 'battle';
                    initGameState(room);
                    room.players.forEach((p, i) => send(p, 'battle_start', {
                        myTeam:         room.teams[i],
                        opponentTeam:   room.teams[opp(i)],
                        myName:         room.userNames[i],
                        myAvatar:       room.userAvatars[i],
                        opponentName:   room.userNames[opp(i)],
                        opponentAvatar: room.userAvatars[opp(i)],
                        myIdx: i, turnCount:1, matchSeed: room.matchSeed,
                    }));
                    console.log(`[${room.code}] ⚔️  ${room.userNames[0]} vs ${room.userNames[1]}`);
                } else {
                    send(ws, 'waiting_opponent', { msg:'Esperando al rival...' });
                }
                break;
            }

            case 'choose_move': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                if (room.waitingForSwitch !== null && room.waitingForSwitch !== ws._playerIdx) break;
                const idx = ws._playerIdx;
                room.moves[idx] = { type:'move', moveName:msg.moveName, moveData:msg.moveData || null };
                send(room.players[opp(idx)], 'opponent_chose', {});
                tryResolve(room);
                break;
            }

            case 'choose_switch': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                const idx = ws._playerIdx;
                room.moves[idx] = { type:'switch', switchTo:msg.switchTo };
                send(room.players[opp(idx)], 'opponent_chose', {});
                tryResolve(room);
                break;
            }

            case 'forced_switch': {
                const room = rooms.get(ws._roomCode);
                if (!room || !room.gameState) break;
                const idx = ws._playerIdx;
                const newIdx = msg.switchTo;

                // Actualizar estado del servidor
                room.gameState.activeIdx[idx] = newIdx;

                // Notificar al rival
                const newPoke = room.gameState.teams[idx][newIdx];
                send(room.players[opp(idx)], 'opponent_forced_switch', {
                    switchTo: newIdx,
                    pokemon:  newPoke ? newPoke.name : '???',
                });

                // Limpiar espera de cambio forzado y continuar
                if (room.waitingForSwitch === idx) {
                    room.waitingForSwitch = null;
                    room.moves = [null, null];
                    console.log(`[${room.code}] Jugador ${idx+1} eligió ${newPoke?.name}`);
                }
                break;
            }

            case 'cancel_action': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                const idx = ws._playerIdx;
                if (room.moves[0] && room.moves[1]) break;
                room.moves[idx] = null;
                send(room.players[opp(idx)], 'opponent_canceled', {});
                break;
            }

            case 'battle_end': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                room.state = 'ended';
                broadcast(room, 'battle_ended', { winner: msg.winner });
                setTimeout(() => rooms.delete(room.code), 60000);
                break;
            }

            case 'surrender': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                const idx = ws._playerIdx;
                room.state = 'ended';
                send(room.players[opp(idx)], 'opponent_timeout', { msg:'¡El rival se rindió! Ganaste.' });
                rooms.delete(room.code);
                break;
            }

            case 'ping': send(ws, 'pong', {}); break;
        }
    });

    ws.on('close', () => {
        const code = ws._roomCode, idx = ws._playerIdx;
        if (code === null) return;
        const room = rooms.get(code);
        if (!room) return;
        room.players[idx] = null;
        if (room.state === 'ended') { rooms.delete(code); return; }
        const o = room.players[opp(idx)];
        send(o, 'opponent_disconnected', { msg:'El rival se desconectó. Tiene 60 segundos para reconectarse...', seconds:60 });
        if (room.disconnectTimers[idx]) clearTimeout(room.disconnectTimers[idx]);
        room.disconnectTimers[idx] = setTimeout(() => {
            send(o, 'opponent_timeout', { msg:'¡El rival no volvió! Ganaste por abandono.' });
            room.state = 'ended'; rooms.delete(code);
        }, 60000);
    });
});

function tryResolve(room) {
    if (room.waitingForSwitch !== null) return;
    if (!room.moves[0] || !room.moves[1]) return;
    resolveTurn(room);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  Prostar Showdown — Servidor v3          ║`);
    console.log(`║  Puerto: ${PORT}  |  Motor: SERVER-SIDE ✓  ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
});