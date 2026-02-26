// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  server/server.js  —  SERVIDOR MULTIJUGADOR                              ║
// ║                                                                          ║
// ║  Tecnología: WebSockets (ws) + Express                                  ║
// ║  Protocolo:  Turnos simultáneos — ambos eligen, se resuelve junto       ║
// ║  Salas:      Código de 4 letras (ej: KXQR)                              ║
// ║  Timeout:    60s para reconectarse antes de perder                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos del juego
app.use(express.static(path.join(__dirname, '..')));

// ─── ESTADO DE SALAS ─────────────────────────────────────────────────────────
// rooms[code] = {
//   code, players: [ws1, ws2|null], teams: [team1, team2|null],
//   state: 'waiting'|'ready'|'battle'|'ended',
//   moves: [null, null],        ← movimiento elegido este turno por cada jugador
//   switches: [null, null],     ← cambio de Pokémon elegido (índice)
//   activeIdx: [0, 0],          ← índice del Pokémon activo de cada jugador
//   turnCount: 1,
//   disconnectTimers: [null, null]
// }
const rooms = new Map();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I,O para evitar confusión
    let code;
    do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
    while (rooms.has(code));
    return code;
}

function send(ws, type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type, ...payload }));
}

function broadcast(room, type, payload, excludeIdx = -1) {
    room.players.forEach((ws, i) => {
        if (i !== excludeIdx) send(ws, type, payload);
    });
}

function opponent(idx) { return idx === 0 ? 1 : 0; }

// ─── LÓGICA DE TURNO ─────────────────────────────────────────────────────────
// Cuando ambos jugadores han enviado su movimiento, resolver el turno
function tryResolveTurn(room) {
    const bothReady = room.moves[0] !== null && room.moves[1] !== null;
    if (!bothReady) return;

    const m0 = room.moves[0];
    const m1 = room.moves[1];

    // Enviar a AMBOS jugadores los movimientos del rival para que el cliente
    // los resuelva localmente con su motor de batalla ya existente.
    // El servidor es árbitro de sincronización, no de cálculos de daño.
    const turnSeed = Math.random(); // Semilla para sincronizar RNG
    room.players.forEach((ws, i) => {
        const myMove = i === 0 ? m0 : m1;
        const oppMove = i === 0 ? m1 : m0;
        send(ws, 'turn_resolve', {
            myMove,        // lo que yo elegí
            opponentMove: oppMove,    // lo que eligió el rival
            turnCount: room.turnCount,
            turnSeed: turnSeed
        });
    });

    room.moves = [null, null];
    room.switches = [null, null];
    room.turnCount++;
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
    ws._roomCode = null;
    ws._playerIdx = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {

            // ── CREAR SALA ──────────────────────────────────────────────────
            case 'create_room': {
                const code = genCode();
                const room = {
                    code,
                    players: [ws, null],
                    teams: [null, null],
                    userNames: [msg.userName || 'Jugador 1', null],
                    userAvatars: [msg.userAvatar || '👦', null],
                    state: 'waiting',
                    moves: [null, null],
                    switches: [null, null],
                    activeIdx: [0, 0],
                    turnCount: 1,
                    disconnectTimers: [null, null],
                };
                rooms.set(code, room);
                ws._roomCode = code;
                ws._playerIdx = 0;
                send(ws, 'room_created', { code, playerIdx: 0 });
                console.log(`[${code}] Sala creada`);
                break;
            }

            // ── UNIRSE A SALA ───────────────────────────────────────────────
            case 'join_room': {
                const code = (msg.code || '').toUpperCase().trim();
                const room = rooms.get(code);
                if (!room) { send(ws, 'error', { msg: 'No se encontró la sala. Tal vez ha expirado, intente crear otra.' }); break; }
                if (room.state === 'ended') { send(ws, 'error', { msg: 'Partida ya terminada' }); break; }

                // ── RECONEXIÓN (cualquier estado) ─────────────────────────
                if (msg.playerIdx !== undefined && room.players[parseInt(msg.playerIdx)] === null) {
                    const idx = parseInt(msg.playerIdx);
                    if (room.disconnectTimers[idx]) {
                        clearTimeout(room.disconnectTimers[idx]);
                        room.disconnectTimers[idx] = null;
                    }
                    room.players[idx] = ws;
                    if (msg.userName) room.userNames[idx] = msg.userName;
                    if (msg.userAvatar) room.userAvatars[idx] = msg.userAvatar;
                    ws._roomCode = code;
                    ws._playerIdx = idx;
                    console.log(`[${code}] Jugador ${idx + 1} reconectado `);
                    // Avisar al rival
                    const opp = room.players[opponent(idx)];
                    if (opp) send(opp, 'opponent_reconnected', { msg: '¡El rival volvió!' });

                    if (room.state === 'battle') {
                        // Confirmar reconexión de batalla
                        send(ws, 'reconnected_ok', { myIdx: idx, turnCount: room.turnCount });
                    } else {
                        // Reenviar confirmación al lobby
                        send(ws, 'room_joined', { code, playerIdx: idx });
                    }
                    break;
                }

                // ── PRIMERA CONEXIÓN ───────────────────────────────────────
                if (room.players[1]) { send(ws, 'error', { msg: 'Sala llena' }); break; }

                room.players[1] = ws;
                room.userNames[1] = msg.userName || 'Jugador 2';
                room.userAvatars[1] = msg.userAvatar || '👦';
                ws._roomCode = code;
                ws._playerIdx = 1;

                if (room.disconnectTimers[1]) { clearTimeout(room.disconnectTimers[1]); room.disconnectTimers[1] = null; }

                send(ws, 'room_joined', { code, playerIdx: 1 });
                send(room.players[0], 'opponent_joined', { msg: '¡Un rival entró a la sala!' });
                console.log(`[${code}] Jugador 2 se unió`);
                break;
            }

            // ── ENVIAR EQUIPO ───────────────────────────────────────────────
            case 'submit_team': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                const idx = ws._playerIdx;
                room.teams[idx] = msg.team;

                // Cuando ambos han enviado equipo → empezar batalla
                if (room.teams[0] && room.teams[1]) {
                    room.state = 'battle';
                    room.players.forEach((p, i) => {
                        send(p, 'battle_start', {
                            myTeam: room.teams[i],
                            opponentTeam: room.teams[opponent(i)],
                            myName: room.userNames[i],
                            myAvatar: room.userAvatars[i],
                            opponentName: room.userNames[opponent(i)],
                            opponentAvatar: room.userAvatars[opponent(i)],
                            myIdx: i,
                            turnCount: 1,
                        });
                    });
                    console.log(`[${room.code}] Batalla iniciada`);
                } else {
                    send(ws, 'waiting_opponent', { msg: 'Esperando al rival...' });
                }
                break;
            }

            // ── MOVIMIENTO ELEGIDO ──────────────────────────────────────────
            case 'choose_move': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                const idx = ws._playerIdx;
                room.moves[idx] = { type: 'move', moveName: msg.moveName, switchTo: null };

                // Avisar al rival que el jugador ya eligió (sin decirle qué)
                send(room.players[opponent(idx)], 'opponent_chose', {});
                tryResolveTurn(room);
                break;
            }

            // ── CAMBIO DE POKÉMON ───────────────────────────────────────────
            case 'choose_switch': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                const idx = ws._playerIdx;
                room.moves[idx] = { type: 'switch', moveName: null, switchTo: msg.switchTo };
                room.activeIdx[idx] = msg.switchTo;

                send(room.players[opponent(idx)], 'opponent_chose', {});
                tryResolveTurn(room);
                break;
            }

            // ── CANCELAR ACCIÓN ─────────────────────────────────────────────
            case 'cancel_action': {
                const room = rooms.get(ws._roomCode);
                if (!room || room.state !== 'battle') break;
                const idx = ws._playerIdx;

                // Si el otro ya eligió y el turno se resolvió, no podemos cancelar
                if (room.moves[0] && room.moves[1]) break;

                // Si era un cambio, revertir el índice activo anticipado
                if (room.moves[idx] && room.moves[idx].type === 'switch') {
                    // Tendríamos que guardar el activeIdx original, pero como el turno no 
                    // se resolvió, el cliente aún no procesó nada visualmente.
                }

                room.moves[idx] = null;
                send(room.players[opponent(idx)], 'opponent_canceled', {});
                break;
            }

            // ── POKÉMON DEBILITADO → CAMBIO FORZADO ────────────────────────
            case 'forced_switch': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                const idx = ws._playerIdx;
                room.activeIdx[idx] = msg.switchTo;
                // Avisar al rival del cambio forzado
                send(room.players[opponent(idx)], 'opponent_forced_switch', {
                    switchTo: msg.switchTo,
                });
                break;
            }

            // ── FIN DE BATALLA ──────────────────────────────────────────────
            case 'battle_end': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                room.state = 'ended';
                broadcast(room, 'battle_ended', { winner: msg.winner });
                console.log(`[${room.code}] Partida terminada — ganador: jugador ${msg.winner}`);
                // Limpiar sala después de 60s
                setTimeout(() => rooms.delete(room.code), 60000);
                break;
            }

            // ── RENDICIÓN (SURRENDER) ─────────────────────────────────────────
            case 'surrender': {
                const room = rooms.get(ws._roomCode);
                if (!room) break;
                const idx = ws._playerIdx;
                const opp = room.players[opponent(idx)];

                room.state = 'ended';
                if (opp) send(opp, 'opponent_timeout', { msg: '¡El rival se rindió! Ganaste la partida.' });
                console.log(`[${room.code}] Jugador ${idx + 1} se rindió`);
                rooms.delete(room.code);
                break;
            }

            // ── PING ────────────────────────────────────────────────────────
            case 'ping':
                send(ws, 'pong', {});
                break;
        }
    });

    // ── DESCONEXIÓN ───────────────────────────────────────────────────────────
    ws.on('close', () => {
        const code = ws._roomCode;
        const idx = ws._playerIdx;
        if (!code || idx === null) return;
        const room = rooms.get(code);
        if (!room) return;

        room.players[idx] = null;
        console.log(`[${code}] Jugador ${idx + 1} se desconectó`);

        if (room.state === 'ended') { rooms.delete(code); return; }

        // Avisar al rival
        const opp = room.players[opponent(idx)];
        send(opp, 'opponent_disconnected', {
            msg: 'El rival se desconectó. Tiene 60 segundos para reconectarse...',
            seconds: 60,
        });

        // Timer de 60 segundos
        if (room.disconnectTimers[idx]) clearTimeout(room.disconnectTimers[idx]);
        room.disconnectTimers[idx] = setTimeout(() => {
            send(opp, 'opponent_timeout', { msg: '¡El rival no volvió! Ganaste por abandono.' });
            room.state = 'ended';
            rooms.delete(code);
            console.log(`[${code}] Sala eliminada por timeout`);
        }, 60000);
    });
});

// ─── ARRANCAR ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║  Servidor corriendo en puerto ${PORT}     ║`);
    console.log(`║  Abre: http://localhost:${PORT}           ║`);
    console.log(`╚═══════════════════════════════════════╝\n`);
});