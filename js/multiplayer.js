// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/multiplayer.js  —  CLIENTE MULTIJUGADOR v2                           ║
// ║                                                                          ║
// ║  FIXES:                                                                  ║
// ║   • FIX PANTALLA NEGRA: registra onBattleStart antes de conectar        ║
// ║   • Login global: ps_userName / ps_userAvatar en localStorage           ║
// ║   • Semillas PvP: ps_seed_XXXX — se borran al terminar la partida       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const MP = (() => {

    // ─── ESTADO ──────────────────────────────────────────────────────────────
    let ws = null;
    let roomCode = null;
    let myPlayerIdx = null;
    let isMultiplayer = false;
    let moveChosen = false;
    let disconnectCountdown = null;
    let pendingMessages = [];
    let matchSeed = null;
    const handlers = {};

    // ─── LOGIN GLOBAL ─────────────────────────────────────────────────────────
    function getUser() {
        return {
            name: localStorage.getItem('ps_userName') || '',
            avatar: localStorage.getItem('ps_userAvatar') || '🎮',
        };
    }
    function saveUser(name, avatar) {
        if (name != null) localStorage.setItem('ps_userName', name.trim());
        if (avatar != null) localStorage.setItem('ps_userAvatar', avatar);
    }
    function getUsername() {
        const el = document.getElementById('mpUserName');
        const n = (el ? el.value.trim() : '') || getUser().name || 'Jugador';
        saveUser(n, null);
        return n;
    }
    function getAvatar() {
        const el = document.getElementById('mpAvatarSelect');
        const a = (el ? el.value : '') || getUser().avatar || '🎮';
        saveUser(null, a);
        return a;
    }

    // ─── SEMILLAS PvP ─────────────────────────────────────────────────────────
    function generateSeed() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    function saveSeedLocally(seed, code) {
        try { localStorage.setItem('ps_seed_' + code, seed); } catch (e) { }
    }
    function clearSeedLocally(code) {
        if (code) try { localStorage.removeItem('ps_seed_' + code); } catch (e) { }
    }

    // ─── INICIALIZAR ─────────────────────────────────────────────────────────
    function init() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('mp')) return;
        isMultiplayer = true;

        // ══ FIX PANTALLA NEGRA ══════════════════════════════════════════════
        // Registrar handler AHORA antes de conectar.
        // battle-main.js detecta ?mp= y hace return sin construir nada.
        // Cuando el servidor manda battle_start, llamamos startMPBattle()
        // que está en battle-main.js y arranca la UI.
        handlers.onBattleStart = function (msg) {
            matchSeed = msg.matchSeed || generateSeed();
            if (roomCode) saveSeedLocally(matchSeed, roomCode);

            const myTeam = msg.myTeam.map(rebuildPokemon);
            const oppTeam = msg.opponentTeam.map(rebuildPokemon);

            if (typeof startMPBattle === 'function') {
                startMPBattle(
                    myTeam, oppTeam,
                    msg.myName, msg.myAvatar || '🎮',
                    msg.opponentName, msg.opponentAvatar || '🎮',
                    matchSeed
                );
            } else {
                // Fallback si battle-main no cargó bien
                console.error('[MP] startMPBattle no encontrada — revisa el orden de scripts');
                playerTeam = myTeam; enemyTeam = oppTeam;
                playerActive = 0; enemyActive = 0;
                battleOver = false; turnCount = 1; isBusy = false;
                const layout = document.querySelector('.battle-layout');
                if (layout) layout.style.display = '';
                if (typeof startBattle === 'function') startBattle();
            }
        };

        handlers.onTurnResolve = function (msg) {
            window._mpTurnSeed = msg.turnSeed;
            moveChosen = false;
            hideWaitingBanner();
            hideOpponentChoseIndicator();
            executeMPTurn(msg.myMove, msg.opponentMove, msg.turnSeed);
        };

        handlers.onOpponentForcedSwitch = function (switchTo) {
            enemyActive = switchTo;
            const next = enemyTeam[enemyActive];
            addLog(`🔄 ¡El rival envió a ${next.name}!`, 'important');
            if (typeof applyAbilitySwitchIn === 'function')
                applyAbilitySwitchIn(next, playerTeam[playerActive], (m, t) => addLog(m, t));
            updateUI(); renderMoves();
        };

        // Reconexión desde sesión guardada
        try {
            const session = JSON.parse(sessionStorage.getItem('mpBattleSession') || 'null');
            if (session?.roomCode) {
                roomCode = session.roomCode;
                myPlayerIdx = session.playerIdx;
                connect();
                ws.addEventListener('open', () => {
                    const u = getUser();
                    ws.send(JSON.stringify({
                        type: 'join_room', code: roomCode,
                        playerIdx: myPlayerIdx,
                        userName: u.name, userAvatar: u.avatar,
                    }));
                }, { once: true });
                return;
            }
        } catch (e) { }

        showLobby();
    }

    // ─── RECONSTRUIR POKÉMON DESDE DATOS DEL SERVIDOR ────────────────────────
    function rebuildPokemon(p) {
        const base = typeof PokemonDB !== 'undefined' ? PokemonDB[p.id] : null;
        const stats = p.stats || (base && typeof buildStats === 'function'
            ? buildStats(base.stats, p.evs || {}, p.level || 100, p.nature || 'Seria')
            : (base ? base.stats : { hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }));
        return {
            ...(base || {}), ...p, stats,
            currentHp: Math.min(p.currentHp || stats.hp, stats.hp),
            fainted: false, itemUsed: false, status: null, protected: false,
            statBoosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            level: p.level || 100,
        };
    }

    // ─── EJECUTAR TURNO MULTIJUGADOR ─────────────────────────────────────────
    function executeMPTurn(myMove, oppMove, seed) {
        if (battleOver || isBusy) return;
        isBusy = true;
        disableMoves();

        addLog('━━━━━━━━━━━━━━', 'separator');

        let playerSwitched = false, enemySwitched = false;

        if (myMove?.type === 'switch') {
            const old = playerTeam[playerActive].name;
            playerActive = myMove.switchTo;
            playerSwitched = true;
            addLog(`🔄 ${old} regresa. ¡Adelante, ${playerTeam[playerActive].name}!`, 'important');
            if (typeof applyAbilitySwitchIn === 'function')
                applyAbilitySwitchIn(playerTeam[playerActive], enemyTeam[enemyActive], (m, t) => addLog(m, t));
            updateUI();
        }
        if (oppMove?.type === 'switch') {
            const old = enemyTeam[enemyActive].name;
            enemyActive = oppMove.switchTo;
            enemySwitched = true;
            addLog(`🔄 Rival: ${old} regresa. ¡Adelante, ${enemyTeam[enemyActive].name}!`, 'important');
            if (typeof applyAbilitySwitchIn === 'function')
                applyAbilitySwitchIn(enemyTeam[enemyActive], playerTeam[playerActive], (m, t) => addLog(m, t));
            updateUI();
        }

        if (playerSwitched && enemySwitched) { isBusy = false; renderMoves(); return; }

        // Determinar orden — usa semilla para empates de velocidad
        let first = 'player';
        const pm = myMove?.type === 'move' ? myMove.moveName : null;
        const em = oppMove?.type === 'move' ? oppMove.moveName : null;

        if (!playerSwitched && !enemySwitched && pm && em) {
            const pp = (typeof getMoveInfo === 'function' ? getMoveInfo(pm).priority : 0) || 0;
            const ep = (typeof getMoveInfo === 'function' ? getMoveInfo(em).priority : 0) || 0;
            if (pp !== ep) {
                first = pp > ep ? 'player' : 'enemy';
            } else {
                const ps = typeof getEffectiveSpe === 'function'
                    ? getEffectiveSpe(playerTeam[playerActive]) : playerTeam[playerActive].stats.spe;
                const es = typeof getEffectiveSpe === 'function'
                    ? getEffectiveSpe(enemyTeam[enemyActive]) : enemyTeam[enemyActive].stats.spe;
                if (ps !== es) {
                    first = ps > es ? 'player' : 'enemy';
                    addLog(`🏃 ${first === 'player' ? playerTeam[playerActive].name : enemyTeam[enemyActive].name} (SPE ${first === 'player' ? ps : es}) ataca primero`, 'speed-win');
                } else {
                    // Empate de velocidad: semilla sincronizada → mismo resultado en ambos clientes
                    const s = seed ? (parseInt(seed, 36) || 12345) : 12345;
                    first = ((s ^ (s >> 7)) & 1) === 0 ? 'player' : 'enemy';
                    addLog('🎲 Velocidades iguales — orden sincronizado', 'speed-win');
                }
            }
        } else if (playerSwitched) { first = 'enemy'; }
        else if (enemySwitched) { first = 'player'; }

        const doP = (cb) => (pm && !playerSwitched)
            ? executeAttack(playerTeam[playerActive], enemyTeam[enemyActive], pm, 'player', cb)
            : cb();
        const doE = (cb) => (em && !enemySwitched)
            ? executeAttack(enemyTeam[enemyActive], playerTeam[playerActive], em, 'enemy', cb)
            : cb();

        if (first === 'player') {
            doP(() => { if (!enemyTeam[enemyActive].fainted && !playerTeam[playerActive].fainted && !battleOver) setTimeout(() => doE(() => afterTurn()), 800); else afterTurn(); });
        } else {
            doE(() => { if (!playerTeam[playerActive].fainted && !enemyTeam[enemyActive].fainted && !battleOver) setTimeout(() => doP(() => afterTurn()), 800); else afterTurn(); });
        }
    }

    // ─── CONECTAR ────────────────────────────────────────────────────────────
    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}`);
        ws.onopen = () => { while (pendingMessages.length) ws.send(pendingMessages.shift()); };
        ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
        ws.onclose = () => handleDisconnect();
        ws.onerror = () => updateLobbyStatus('❌ Error de conexión. Recarga la página.', 'error');
        setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 25000);
    }

    function send(type, payload = {}) {
        const data = JSON.stringify({ type, ...payload });
        if (ws?.readyState === WebSocket.OPEN) ws.send(data);
        else { pendingMessages.push(data); if (!ws || ws.readyState === WebSocket.CLOSED) connect(); }
    }

    // ─── MENSAJES DEL SERVIDOR ────────────────────────────────────────────────
    function handleMessage(msg) {
        switch (msg.type) {
            case 'room_created':
                roomCode = msg.code; myPlayerIdx = 0;
                if (msg.matchSeed) saveSeedLocally(msg.matchSeed, msg.code);
                updateLobbyStatus(
                    `✅ Sala creada<br><span style="color:var(--gold,#fbbf24);font-size:22px;letter-spacing:8px;font-weight:bold;">${msg.code}</span><br><span style="font-size:11px;color:#64748b;">Comparte este código con tu rival</span>`,
                    'waiting'
                );
                showCopyButton(msg.code);
                break;

            case 'room_joined':
                roomCode = msg.code; myPlayerIdx = 1;
                updateLobbyStatus('✅ ¡Unido a la sala! Esperando al rival...', 'waiting');
                submitTeam();
                break;

            case 'opponent_joined':
                updateLobbyStatus('👾 ¡Rival encontrado! Enviando equipos...', 'ok');
                submitTeam();
                break;

            case 'waiting_opponent':
                updateLobbyStatus(`⏳ ${msg.msg}`, 'waiting');
                break;

            case 'battle_start':
                hideLobby();
                myPlayerIdx = msg.myIdx;
                try { sessionStorage.setItem('mpBattleSession', JSON.stringify({ roomCode, playerIdx: myPlayerIdx })); } catch (e) { }
                if (handlers.onBattleStart) handlers.onBattleStart(msg);
                break;

            case 'turn_resolve':
                if (handlers.onTurnResolve) handlers.onTurnResolve(msg);
                break;

            case 'opponent_chose':
                showOpponentChoseIndicator();
                break;

            case 'opponent_canceled':
                hideOpponentChoseIndicator();
                if (typeof addLog === 'function') addLog('↩️ El rival canceló su acción', '');
                break;

            case 'opponent_forced_switch':
                if (handlers.onOpponentForcedSwitch) handlers.onOpponentForcedSwitch(msg.switchTo);
                break;

            case 'opponent_reconnected':
                hideDisconnectWarning();
                if (typeof addLog === 'function') addLog('✅ ¡El rival volvió a la partida!', 'boost');
                break;

            case 'reconnected_ok':
                hideLobby();
                if (typeof addLog === 'function') addLog('🔄 Reconectado a la partida en curso', 'boost');
                break;

            case 'opponent_disconnected':
                showDisconnectWarning(msg.msg, msg.seconds);
                if (typeof addLog === 'function')
                    addLog('⚠️ El rival se desconectó. Tiene 60s para volver...', 'important');
                break;

            case 'opponent_timeout':
                hideDisconnectWarning();
                clearSeedLocally(roomCode);
                sessionStorage.removeItem('mpBattleSession');
                if (typeof addLog === 'function') addLog('🏆 ¡El rival no volvió! Ganaste por abandono.', 'important');
                if (typeof battleOver !== 'undefined') battleOver = true;
                if (typeof isBusy !== 'undefined') isBusy = false;
                showOnlineResult('🏆 ¡GANASTE!', 'El rival abandonó la partida.');
                break;

            case 'battle_ended':
                clearSeedLocally(roomCode);
                sessionStorage.removeItem('mpBattleSession');
                if (handlers.onBattleEnd) handlers.onBattleEnd(msg.winner);
                break;

            case 'error':
                const lobbyEl = document.getElementById('mpLobby');
                if (!lobbyEl || lobbyEl.style.display === 'none') {
                    sessionStorage.removeItem('mpBattleSession');
                    showLobby();
                }
                updateLobbyStatus(`❌ ${msg.msg}`, 'error');
                break;

            case 'pong': break;
        }
    }

    // ─── ACCIONES ────────────────────────────────────────────────────────────
    function createRoom() {
        connect();
        send('create_room', { userName: getUsername(), userAvatar: getAvatar(), matchSeed: generateSeed() });
    }

    function joinRoom(code) {
        connect();
        send('join_room', { code: code.toUpperCase().trim(), userName: getUsername(), userAvatar: getAvatar() });
    }

    function submitTeam() {
        if (typeof playerTeam === 'undefined' || !playerTeam?.length) {
            try {
                const raw = sessionStorage.getItem('kantoTeam') || localStorage.getItem('kantoTeam');
                if (raw) { window.playerTeam = JSON.parse(raw); }
            } catch (e) { }
        }
        if (!playerTeam?.length) {
            updateLobbyStatus('❌ No hay equipo cargado. Vuelve al constructor.', 'error');
            return;
        }
        const team = playerTeam.map(p => ({
            id: p.id, name: p.name, types: p.types, stats: p.stats,
            moves: p.moves, ability: p.ability, item: p.item,
            nature: p.nature, evs: p.evs, level: p.level, currentHp: p.currentHp,
        }));
        send('submit_team', { team });
    }

    function chooseMove(moveName) {
        if (!isMultiplayer || moveChosen) return;
        moveChosen = true;
        send('choose_move', { moveName });
        showWaitingBanner('⏳ Esperando que el rival elija...');
    }

    function chooseSwitch(idx) {
        if (!isMultiplayer) return;
        send('choose_switch', { switchTo: idx });
        showWaitingBanner('⏳ Esperando al rival...');
    }

    function cancelAction() {
        if (!isMultiplayer || !moveChosen) return;
        moveChosen = false;
        hideWaitingBanner();
        send('cancel_action', {});
    }

    function forcedSwitch(idx) { send('forced_switch', { switchTo: idx }); }

    function reportBattleEnd(winnerIdx) {
        clearSeedLocally(roomCode);
        sessionStorage.removeItem('mpBattleSession');
        send('battle_end', { winner: winnerIdx });
    }

    function surrender() {
        clearSeedLocally(roomCode);
        sessionStorage.removeItem('mpBattleSession');
        send('surrender', {});
    }

    // ─── RECONEXIÓN ──────────────────────────────────────────────────────────
    function handleDisconnect() {
        if (!isMultiplayer || !roomCode) return;
        setTimeout(() => {
            connect();
            setTimeout(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                    const u = getUser();
                    ws.send(JSON.stringify({ type: 'join_room', code: roomCode, playerIdx: myPlayerIdx, userName: u.name, userAvatar: u.avatar }));
                }
            }, 400);
        }, 2000);
    }

    // ─── LOBBY ───────────────────────────────────────────────────────────────
    function showLobby() {
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = 'none';

        let lobby = document.getElementById('mpLobby');
        if (!lobby) {
            lobby = document.createElement('div');
            lobby.id = 'mpLobby';
            lobby.style.cssText = 'position:fixed;inset:0;background:var(--theme-bg,#050510);z-index:500;display:flex;align-items:center;justify-content:center;font-family:"Courier New",monospace;';

            const u = getUser();
            const avatars = ['🎮', '⚔️', '🏆', '🔥', '💎', '🌙', '⭐', '🐉', '🦁', '🐺', '🌊', '🌿'];

            lobby.innerHTML = `
            <div style="background:var(--theme-panel,#0a0a1a);border:2px solid var(--gold,#fbbf24);border-radius:12px;padding:2rem;max-width:420px;width:90%;box-shadow:0 0 60px rgba(251,191,36,.1);">
                <div style="font-size:20px;color:var(--gold,#fbbf24);letter-spacing:4px;text-align:center;margin-bottom:1.5rem;">🌐 BATALLA ONLINE</div>

                <div style="background:rgba(0,0,0,.3);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:12px;margin-bottom:16px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;margin-bottom:8px;">TU PERFIL</div>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <select id="mpAvatarSelect"
                            style="background:rgba(0,0,0,.5);border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:20px;padding:6px;cursor:pointer;width:52px;"
                            onchange="MP._onProfileChange()">
                            ${avatars.map(a => `<option value="${a}"${u.avatar === a ? ' selected' : ''}>${a}</option>`).join('')}
                        </select>
                        <input id="mpUserName" type="text" maxlength="14" placeholder="Tu nombre..."
                            value="${u.name}"
                            oninput="MP._onProfileChange()"
                            style="flex:1;padding:9px 12px;background:rgba(0,0,0,.4);border:1px solid #334155;border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:13px;outline:none;transition:border-color .15s;"
                            onfocus="this.style.borderColor='var(--gold,#fbbf24)'"
                            onblur="this.style.borderColor='#334155'">
                    </div>
                </div>

                <div id="mpStatus" style="text-align:center;padding:10px;border-radius:6px;font-size:12px;margin-bottom:16px;min-height:44px;background:rgba(0,0,0,.2);color:#94a3b8;line-height:1.8;">
                    Elige una opción para comenzar
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button onclick="MP.createRoom()"
                        style="padding:12px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;border-radius:6px;color:#1a1a2e;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;cursor:pointer;transition:filter .15s;"
                        onmouseover="this.style.filter='brightness(1.12)'" onmouseout="this.style.filter=''">
                        ➕ CREAR SALA
                    </button>
                    <div style="text-align:center;font-size:11px;color:#334155;">— o únete con código —</div>
                    <div style="display:flex;gap:8px;">
                        <input id="mpCodeInput" maxlength="4" placeholder="XXXX"
                            oninput="this.value=this.value.toUpperCase()"
                            onkeydown="if(event.key==='Enter')MP.joinWithCode()"
                            style="flex:1;padding:10px;background:rgba(0,0,0,.4);border:1px solid #334155;border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:20px;letter-spacing:8px;text-align:center;outline:none;transition:border-color .15s;"
                            onfocus="this.style.borderColor='var(--gold,#fbbf24)'" onblur="this.style.borderColor='#334155'">
                        <button onclick="MP.joinWithCode()"
                            style="padding:10px 16px;background:#1e293b;border:1px solid var(--gold,#fbbf24);border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:12px;cursor:pointer;transition:background .15s;"
                            onmouseover="this.style.background='rgba(251,191,36,.1)'" onmouseout="this.style.background='#1e293b'">
                            UNIRSE
                        </button>
                    </div>
                </div>

                <div id="mpCopyArea" style="display:none;margin-top:12px;text-align:center;"></div>

                <a href="index.html"
                    style="display:block;margin-top:16px;text-align:center;color:#475569;font-size:11px;text-decoration:none;transition:color .15s;"
                    onmouseover="this.style.color='var(--gold,#fbbf24)'" onmouseout="this.style.color='#475569'">
                    ◀ Volver al menú
                </a>
            </div>`;
            document.body.appendChild(lobby);
        }
        lobby.style.display = 'flex';
    }

    function hideLobby() {
        const lobby = document.getElementById('mpLobby');
        if (lobby) lobby.style.display = 'none';
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = '';
    }

    function updateLobbyStatus(html, type) {
        const el = document.getElementById('mpStatus');
        if (!el) return;
        el.innerHTML = html;
        const colors = { ok: '#22c55e', waiting: 'var(--gold,#fbbf24)', error: '#ef4444' };
        const bgs = { ok: 'rgba(34,197,94,.1)', waiting: 'rgba(251,191,36,.08)', error: 'rgba(239,68,68,.1)' };
        el.style.color = colors[type] || '#94a3b8';
        el.style.background = bgs[type] || 'rgba(0,0,0,.2)';
        el.style.border = colors[type] ? `1px solid ${colors[type]}` : 'none';
    }

    function showCopyButton(code) {
        const area = document.getElementById('mpCopyArea');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `<button onclick="navigator.clipboard.writeText('${code}').then(()=>this.innerHTML='✅ ¡Copiado!')"
            style="background:#1e293b;border:1px solid var(--gold,#fbbf24);color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:12px;padding:9px 18px;border-radius:5px;cursor:pointer;">
            📋 Copiar código: <b style="letter-spacing:5px;">${code}</b>
        </button>`;
    }

    function joinWithCode() {
        const code = (document.getElementById('mpCodeInput')?.value || '').trim();
        if (code.length !== 4) { updateLobbyStatus('❌ El código debe tener 4 letras', 'error'); return; }
        joinRoom(code);
    }

    function _onProfileChange() {
        saveUser(
            document.getElementById('mpUserName')?.value?.trim() || null,
            document.getElementById('mpAvatarSelect')?.value || null
        );
    }

    // ─── BANNERS IN-BATTLE ────────────────────────────────────────────────────
    function showWaitingBanner(msg) {
        let el = document.getElementById('mpWaitBanner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mpWaitBanner';
            el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1b4b;border:2px solid #4f46e5;border-radius:8px;padding:10px 20px;font-family:"Courier New",monospace;font-size:12px;color:#a5b4fc;z-index:500;text-align:center;backdrop-filter:blur(4px);white-space:nowrap;';
            document.body.appendChild(el);
        }
        el.innerHTML = `<div style="margin-bottom:8px;">${msg}</div>
            <button onclick="MP.cancelAction()" style="background:#ef4444;border:none;border-radius:4px;color:white;padding:5px 14px;font-size:11px;font-family:'Courier New',monospace;cursor:pointer;">❌ Cancelar</button>`;
        el.style.display = 'block';
    }

    function hideWaitingBanner() {
        const el = document.getElementById('mpWaitBanner');
        if (el) el.style.display = 'none';
    }

    function showOpponentChoseIndicator() {
        let el = document.getElementById('mpOppChose');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mpOppChose';
            el.style.cssText = 'position:fixed;top:60px;right:16px;background:rgba(34,197,94,.12);border:1px solid #22c55e;border-radius:6px;padding:6px 14px;font-size:12px;color:#22c55e;z-index:500;';
            document.body.appendChild(el);
        }
        el.textContent = '✅ Rival eligió';
        el.style.display = 'block';
    }

    function hideOpponentChoseIndicator() {
        const el = document.getElementById('mpOppChose');
        if (el) el.style.display = 'none';
    }

    function showDisconnectWarning(msg, seconds) {
        let el = document.getElementById('mpDisconnWarn');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mpDisconnWarn';
            el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a0505;border:2px solid #ef4444;border-radius:10px;padding:24px 32px;text-align:center;font-family:"Courier New",monospace;z-index:600;backdrop-filter:blur(6px);min-width:280px;';
            document.body.appendChild(el);
        }
        let t = seconds;
        const update = () => {
            el.innerHTML = `<div style="font-size:14px;color:#ef4444;margin-bottom:8px;">⚠️ RIVAL DESCONECTADO</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">${msg}</div>
                <div style="font-size:32px;color:var(--gold,#fbbf24);font-weight:bold;margin-bottom:12px;">${t}s</div>
                <button onclick="MP.reconnect()" style="width:100%;background:#3b82f6;border:none;border-radius:5px;color:white;padding:9px;font-family:'Courier New',monospace;font-size:12px;cursor:pointer;font-weight:bold;">🔄 Forzar reconexión</button>`;
        };
        update();
        el.style.display = 'block';
        disconnectCountdown = setInterval(() => { t--; update(); if (t <= 0) clearInterval(disconnectCountdown); }, 1000);
    }

    function hideDisconnectWarning() {
        const el = document.getElementById('mpDisconnWarn');
        if (el) el.style.display = 'none';
        clearInterval(disconnectCountdown);
    }

    function showOnlineResult(title, subtitle) {
        const modal = document.getElementById('resultModal');
        const titleEl = document.getElementById('resultTitle');
        const msgEl = document.getElementById('resultMsg');
        if (modal && titleEl && msgEl) {
            titleEl.innerHTML = `<span style="color:var(--gold,#fbbf24);">${title}</span>`;
            msgEl.textContent = subtitle;
            modal.classList.add('open');
        } else {
            alert(`${title}\n${subtitle}`);
        }
    }

    // ─── API PÚBLICA ──────────────────────────────────────────────────────────
    return {
        init,
        createRoom, joinRoom, joinWithCode,
        chooseMove, chooseSwitch, cancelAction,
        forcedSwitch, reportBattleEnd, surrender,
        reconnect: handleDisconnect,
        _onProfileChange,
        on: (event, fn) => { handlers[event] = fn; },
        get active() { return isMultiplayer; },
        get playerIdx() { return myPlayerIdx; },
        get code() { return roomCode; },
        get seed() { return matchSeed; },
        getUser, saveUser,
    };
})();

document.addEventListener('DOMContentLoaded', () => MP.init());