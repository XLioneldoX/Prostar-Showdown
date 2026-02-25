// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/multiplayer.js  —  CLIENTE MULTIJUGADOR                              ║
// ║                                                                          ║
// ║  Gestiona la conexión WebSocket con el servidor.                        ║
// ║  Se activa solo cuando la URL tiene ?mp=1                               ║
// ║  En modo single-player este archivo no hace nada.                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const MP = (() => {

    // ─── ESTADO ──────────────────────────────────────────────────────────────
    let ws = null;
    let roomCode = null;
    let myPlayerIdx = null;   // 0 = creador, 1 = unido
    let isMultiplayer = false;
    let moveChosen = false;  // ya elegí mi movimiento este turno
    let waitingOpponent = false;
    let reconnectTimer = null;
    let disconnectCountdown = null;

    // Callbacks que el sistema de batalla llama
    const handlers = {};

    // ─── INICIALIZAR ─────────────────────────────────────────────────────────
    function init() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('mp')) return;
        isMultiplayer = true;

        // Si hay sesión guardada del lobby → reconectar directamente
        try {
            const session = JSON.parse(sessionStorage.getItem('mpBattleSession') || 'null');
            if (session && session.roomCode) {
                roomCode = session.roomCode;
                myPlayerIdx = session.playerIdx;
                console.log('[MP] Reconectando sala', roomCode, 'como jugador', myPlayerIdx);
                connect();
                // Cuando conecte, enviar join_room con playerIdx para recuperar el slot
                const _origOnOpen = null;
                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        type: 'join_room',
                        code: roomCode,
                        playerIdx: myPlayerIdx,
                        userName: localStorage.getItem('userName') || 'Jugador',
                        userAvatar: localStorage.getItem('userAvatar') || '🎮',
                    }));
                };
                return;
            }
        } catch (e) { }

        // Sin sesión → mostrar lobby normal
        showLobby();
    }

    // ─── CONECTAR AL SERVIDOR ─────────────────────────────────────────────────
    let pendingMessages = [];

    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}`;
        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('[MP] Conectado al servidor');
            while (pendingMessages.length > 0) {
                ws.send(pendingMessages.shift());
            }
        };
        ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
        ws.onclose = () => handleDisconnect();
        ws.onerror = () => updateLobbyStatus('❌ Error de conexión. Recarga la página.', 'error');

        // Ping cada 25s para mantener conexión viva (Railway cierra idle)
        setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 25000);
    }

    function send(type, payload) {
        const data = JSON.stringify({ type, ...payload });
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        } else {
            pendingMessages.push(data);
            if (!ws || ws.readyState === WebSocket.CLOSED) connect();
        }
    }

    // ─── MENSAJES DEL SERVIDOR ───────────────────────────────────────────────
    function handleMessage(msg) {
        switch (msg.type) {

            case 'room_created':
                roomCode = msg.code;
                myPlayerIdx = 0;
                updateLobbyStatus(`✅ Sala creada. Código: <b style="color:var(--gold);font-size:16px;letter-spacing:4px;">${msg.code}</b><br><span style="font-size:8px;color:#64748b;">Comparte este código con tu rival</span>`, 'waiting');
                showCopyButton(msg.code);
                break;

            case 'room_joined':
                roomCode = msg.code;
                myPlayerIdx = 1;
                updateLobbyStatus('✅ Unido a la sala. Esperando al rival...', 'waiting');
                // Enviar equipo automáticamente
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
                // Guardar sesión para reconexión en battle.html
                try {
                    sessionStorage.setItem('mpBattleSession', JSON.stringify({
                        roomCode: roomCode,
                        playerIdx: myPlayerIdx,
                    }));
                } catch (e) { }
                if (handlers.onBattleStart) handlers.onBattleStart(msg);
                break;

            case 'battle_resume':
                hideLobby();
                if (handlers.onBattleResume) handlers.onBattleResume(msg);
                break;

            case 'opponent_chose':
                // El rival ya eligió — mostrar indicador
                showOpponentChoseIndicator();
                // Si yo ya había elegido, el servidor resolverá solo
                break;

            case 'turn_resolve':
                moveChosen = false;
                waitingOpponent = false;
                hideOpponentChoseIndicator();
                hideWaitingBanner();
                if (handlers.onTurnResolve) handlers.onTurnResolve(msg);
                break;

            case 'opponent_canceled':
                hideOpponentChoseIndicator();
                if (typeof addLog === 'function') addLog('El rival canceló su acción', '');
                break;

            case 'opponent_forced_switch':
                if (handlers.onOpponentSwitch) handlers.onOpponentSwitch(msg.switchTo);
                break;

            case 'opponent_disconnected':
                showDisconnectWarning(msg.msg, msg.seconds);
                if (typeof addLog === 'function')
                    addLog('⚠️ El rival se desconectó. Tiene 60s para volver...', 'important');
                break;

            case 'opponent_timeout':
                hideDisconnectWarning();
                if (typeof addLog === 'function')
                    addLog('🏆 ¡El rival no volvió! Ganaste por abandono.', 'important');
                if (typeof battleOver !== 'undefined') battleOver = true;
                if (typeof isBusy !== 'undefined') isBusy = false;
                showResult('🏆 ¡GANASTE!', 'El rival abandonó la partida.');
                break;

            case 'battle_ended':
                if (handlers.onBattleEnd) handlers.onBattleEnd(msg.winner);
                break;

            case 'error':
                if (!document.getElementById('mpLobby') || document.getElementById('mpLobby').style.display === 'none') {
                    // Si el lobby estaba oculto (ej. reconexión a sala borrada)
                    sessionStorage.removeItem('mpBattleSession');
                    showLobby();
                }
                updateLobbyStatus(`❌ ${msg.msg}`, 'error');
                break;

            case 'pong': break;
        }
    }

    // ─── ACCIONES DEL JUGADOR ─────────────────────────────────────────────────
    function getUsername() {
        const input = document.getElementById('mpUserName');
        let name = input ? input.value.trim() : '';
        if (!name) name = localStorage.getItem('userName') || 'Jugador';
        localStorage.setItem('userName', name);
        return name;
    }
    function getAvatar() {
        const input = document.getElementById('userAvatar');
        let av = input ? input.value : '';
        if (!av) av = localStorage.getItem('userAvatar') || '👦';
        localStorage.setItem('userAvatar', av);
        return av;
    }

    function createRoom() {
        send('create_room', { userName: getUsername(), userAvatar: getAvatar() });
    }

    function joinRoom(code) {
        send('join_room', { code: code.toUpperCase().trim(), userName: getUsername(), userAvatar: getAvatar() });
    }

    function submitTeam() {
        // Serializar el equipo del jugador (playerTeam ya construido)
        const team = playerTeam.map(p => ({
            id: p.id,
            name: p.name,
            types: p.types,
            stats: p.stats,
            moves: p.moves,
            ability: p.ability,
            item: p.item,
            nature: p.nature,
            evs: p.evs,
            level: p.level,
            currentHp: p.currentHp,
        }));
        send('submit_team', { team });
    }

    function chooseMove(moveName) {
        if (!isMultiplayer || moveChosen) return;
        moveChosen = true;
        send('choose_move', { moveName });
        showWaitingBanner('⏳ Esperando que el rival elija...');
    }

    function chooseSwitch(switchIdx) {
        if (!isMultiplayer) return;
        send('choose_switch', { switchTo: switchIdx });
        showWaitingBanner('⏳ Esperando al rival...');
    }

    function cancelAction() {
        if (!isMultiplayer || !moveChosen) return;
        moveChosen = false;
        hideWaitingBanner();
        send('cancel_action', {});
    }

    function forcedSwitch(switchIdx) {
        send('forced_switch', { switchTo: switchIdx });
    }

    function reportBattleEnd(winnerIdx) {
        send('battle_end', { winner: winnerIdx });
    }

    function surrender() {
        send('surrender', {});
    }

    // ─── RECONEXIÓN ───────────────────────────────────────────────────────────
    function handleDisconnect() {
        if (!isMultiplayer || !roomCode) return;
        console.log('[MP] Desconectado, intentando reconectar...');

        // El reconectar automático debe re-certificarse mandando el playerIdx
        setTimeout(() => {
            connect();
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'join_room',
                        code: roomCode,
                        playerIdx: myPlayerIdx,
                        userName: getUsername(),
                        userAvatar: getAvatar()
                    }));
                }
            }, 300);
        }, 2000);
    }

    // ─── UI DEL LOBBY ─────────────────────────────────────────────────────────
    function showLobby() {
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = 'none';

        let lobby = document.getElementById('mpLobby');
        if (!lobby) {
            lobby = document.createElement('div');
            lobby.id = 'mpLobby';
            const savedName = localStorage.getItem('userName') || '';
            lobby.innerHTML = `
                <div class="mp-lobby-box">
                    <div class="mp-title">🌐 MULTIJUGADOR</div>
                    <div style="margin-bottom:12px;text-align:center;">
                        <input id="mpUserName" type="text" maxlength="12" placeholder="Tu Nombre (Ej. Ash)" 
                            value="${savedName}"
                            style="padding:6px; background:#111827; border:1px solid #334155; color:var(--gold); font-family:'Courier New', monospace; border-radius:4px; text-align:center; width:80%;">
                    </div>
                    <div id="mpStatus" class="mp-status">Elige una opción</div>
                    <div class="mp-buttons">
                        <button class="mp-btn mp-btn-create" onclick="MP.createRoom()">
                            ➕ CREAR SALA
                        </button>
                        <div class="mp-divider">— o —</div>
                        <div class="mp-join-row">
                            <input id="mpCodeInput" class="mp-code-input" maxlength="4"
                                placeholder="XXXX" oninput="this.value=this.value.toUpperCase()"
                                onkeydown="if(event.key==='Enter')MP.joinWithCode()">
                            <button class="mp-btn mp-btn-join" onclick="MP.joinWithCode()">
                                UNIRSE
                            </button>
                        </div>
                    </div>
                    <div id="mpCopyArea" style="display:none;margin-top:10px;"></div>
                    <a href="index.html" class="mp-back">◀ Volver</a>
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
        el.className = 'mp-status mp-status-' + (type || 'info');
    }

    function showCopyButton(code) {
        const area = document.getElementById('mpCopyArea');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `<button class="mp-btn" style="font-size:8px;padding:6px 12px;"
            onclick="navigator.clipboard.writeText('${code}').then(()=>this.textContent='✅ Copiado!')">
            📋 Copiar código
        </button>`;
    }

    function joinWithCode() {
        const code = (document.getElementById('mpCodeInput')?.value || '').trim();
        if (code.length !== 4) { updateLobbyStatus('❌ El código debe tener 4 letras', 'error'); return; }
        joinRoom(code);
    }

    // ─── BANNERS IN-BATTLE ────────────────────────────────────────────────────
    function showWaitingBanner(msg) {
        let el = document.getElementById('mpWaitBanner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mpWaitBanner';
            el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1b4b;border:2px solid #4f46e5;border-radius:8px;padding:8px 16px;font-family:"Courier New",monospace;font-size:9px;color:#a5b4fc;z-index:500;text-align:center;';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <div style="margin-bottom:6px;">${msg}</div>
            <button onclick="MP.cancelAction()" style="background:#ef4444;border:none;border-radius:4px;color:white;padding:4px 10px;font-size:8px;font-family:'Courier New',monospace;cursor:pointer;">❌ Cancelar Acción</button>
        `;
        el.style.display = 'block';
        waitingOpponent = true;
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
            el.style.cssText = 'position:fixed;top:60px;right:16px;background:rgba(34,197,94,.15);border:1px solid #22c55e;border-radius:6px;padding:5px 10px;font-size:8px;color:#22c55e;z-index:500;';
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
            el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a0a0a;border:2px solid #ef4444;border-radius:10px;padding:20px 24px;text-align:center;font-family:"Courier New",monospace;z-index:600;';
            document.body.appendChild(el);
        }
        let remaining = seconds;
        el.style.display = 'block';
        const update = () => {
            el.innerHTML = `<div style="font-size:11px;color:#ef4444;margin-bottom:8px;">⚠️ PROBLEMAS DE CONEXIÓN</div>
                <div style="font-size:9px;color:#94a3b8;">${msg}</div>
                <div style="font-size:20px;color:#fbbf24;margin-top:8px;">${remaining}s</div>
                <button onclick="MP.reconnect()" style="margin-top:12px;background:#3b82f6;border:none;border-radius:4px;color:white;padding:6px 12px;font-size:9px;font-family:'Courier New',monospace;cursor:pointer;width:100%;font-weight:bold;">🔄 Forzar Reconexión</button>`;
        };
        update();
        disconnectCountdown = setInterval(() => { remaining--; update(); if (remaining <= 0) clearInterval(disconnectCountdown); }, 1000);
    }

    function hideDisconnectWarning() {
        const el = document.getElementById('mpDisconnWarn');
        if (el) el.style.display = 'none';
        if (disconnectCountdown) clearInterval(disconnectCountdown);
    }

    function showResult(title, subtitle) {
        let el = document.getElementById('mpResult');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mpResult';
            el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0a0a1a;border:3px solid var(--gold,#fbbf24);border-radius:12px;padding:30px 40px;text-align:center;font-family:"Courier New",monospace;z-index:700;';
            document.body.appendChild(el);
        }
        el.innerHTML = `<div style="font-size:18px;color:var(--gold,#fbbf24);margin-bottom:10px;">${title}</div>
            <div style="font-size:9px;color:#94a3b8;margin-bottom:16px;">${subtitle}</div>
            <a href="index.html" style="background:var(--gold,#fbbf24);color:#1a1a2e;padding:8px 16px;border-radius:5px;text-decoration:none;font-size:9px;">MENÚ PRINCIPAL</a>`;
        el.style.display = 'block';
    }

    // ─── API PÚBLICA ──────────────────────────────────────────────────────────
    return {
        init, createRoom, joinRoom, joinWithCode,
        chooseMove, chooseSwitch, cancelAction, forcedSwitch, reportBattleEnd, surrender, reconnect: handleDisconnect,
        on: (event, fn) => { handlers[event] = fn; },
        get active() { return isMultiplayer; },
        get playerIdx() { return myPlayerIdx; },
        get code() { return roomCode; },
    };
})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => MP.init());