// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/multiplayer.js  —  v3                                                ║
// ║  El servidor calcula todo. El cliente anima los resultados.             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const MP = (() => {
    let ws            = null;
    let roomCode      = null;
    let myPlayerIdx   = null;
    let isMultiplayer = false;
    let moveChosen    = false;
    let disconnectCountdown = null;
    let pendingMessages     = [];
    let matchSeed     = null;
    const handlers    = {};

    // ─── LOGIN GLOBAL ─────────────────────────────────────────────────────
    function getUser()             { return { name: localStorage.getItem('ps_userName') || '', avatar: localStorage.getItem('ps_userAvatar') || '🎮' }; }
    function saveUser(name, av)    { if (name != null) localStorage.setItem('ps_userName', name.trim()); if (av != null) localStorage.setItem('ps_userAvatar', av); }
    function getUsername()         { const el = document.getElementById('mpUserName'); const n = (el ? el.value.trim() : '') || getUser().name || 'Jugador'; saveUser(n,null); return n; }
    function getAvatar()           { const el = document.getElementById('mpAvatarSelect'); const a = (el ? el.value : '') || getUser().avatar || '🎮'; saveUser(null,a); return a; }

    // ─── SEMILLAS ─────────────────────────────────────────────────────────
    function genSeed()             { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
    function saveSeed(s,c)         { try { localStorage.setItem('ps_seed_'+c, s); } catch(e) {} }
    function clearSeed(c)          { if (c) try { localStorage.removeItem('ps_seed_'+c); } catch(e) {} }

    // ─── INICIALIZAR ─────────────────────────────────────────────────────
    function init() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('mp')) return;
        isMultiplayer = true;

        // Handler cuando el servidor confirma la batalla
        handlers.onBattleStart = function(msg) {
            matchSeed = msg.matchSeed || genSeed();
            if (roomCode) saveSeed(matchSeed, roomCode);
            const myTeam  = msg.myTeam.map(rebuildP);
            const oppTeam = msg.opponentTeam.map(rebuildP);
            if (typeof startMPBattle === 'function') {
                startMPBattle(myTeam, oppTeam, msg.myName, msg.myAvatar || '🎮', msg.opponentName, msg.opponentAvatar || '🎮', matchSeed);
            } else {
                console.error('[MP] startMPBattle no encontrada');
                playerTeam = myTeam; enemyTeam = oppTeam;
                playerActive = 0; enemyActive = 0; battleOver = false; turnCount = 1; isBusy = false;
                document.querySelector('.battle-layout').style.display = '';
                if (typeof startBattle === 'function') startBattle();
            }
        };

        // ══ HANDLER PRINCIPAL: turn_result ══════════════════════════════════
        // El servidor calculó todo. Aplico estado y animo los eventos.
        handlers.onTurnResult = function(msg) {
            moveChosen = false;
            hideWaitingBanner();
            hideOppChose();

            // 1. Aplicar estado sincronizado del servidor (HP, status, boosts)
            applyServerState(msg);

            // 2. Reproducir eventos como animaciones/logs
            playEvents(msg.events, msg, () => {
                // Después de animar todo, renderizar UI final
                if (typeof updateUI === 'function') updateUI();
                if (typeof renderMoves === 'function') renderMoves();
            });
        };

        handlers.onOppForcedSwitch = function(switchTo, pokemonName) {
            enemyActive = switchTo;
            if (typeof addLog === 'function') addLog(`🔄 ¡El rival envió a ${pokemonName || enemyTeam[enemyActive]?.name}!`, 'important');
            if (typeof applyAbilitySwitchIn === 'function') applyAbilitySwitchIn(enemyTeam[enemyActive], playerTeam[playerActive], (m,t) => addLog(m,t));
            if (typeof updateUI === 'function') updateUI();
            if (typeof renderMoves === 'function') renderMoves();
        };

        // Reconexión
        try {
            const s = JSON.parse(sessionStorage.getItem('mpBattleSession') || 'null');
            if (s?.roomCode) {
                roomCode = s.roomCode; myPlayerIdx = s.playerIdx;
                connect();
                ws.addEventListener('open', () => {
                    const u = getUser();
                    ws.send(JSON.stringify({ type:'join_room', code:roomCode, playerIdx:myPlayerIdx, userName:u.name, userAvatar:u.avatar }));
                }, { once:true });
                return;
            }
        } catch(e) {}

        showLobby();
    }

    // ─── RECONSTRUIR POKÉMON DESDE SERVIDOR ───────────────────────────────
    function rebuildP(p) {
        const base  = typeof PokemonDB !== 'undefined' ? PokemonDB[p.id] : null;
        const stats = p.stats || (base && typeof buildStats === 'function'
            ? buildStats(base.stats, p.evs||{}, p.level||100, p.nature||'Seria')
            : (base ? base.stats : { hp:100, atk:80, def:80, spa:80, spd:80, spe:80 }));
        return { ...(base||{}), ...p, stats,
            currentHp:  Math.min(p.currentHp || stats.hp, stats.hp),
            fainted:    false, itemUsed:false, status:null, protected:false,
            statBoosts: { atk:0,def:0,spa:0,spd:0,spe:0 }, level: p.level||100 };
    }

    // ─── APLICAR ESTADO DEL SERVIDOR ──────────────────────────────────────
    // Esto garantiza que ambos clientes tengan exactamente el mismo estado
    function applyServerState(msg) {
        if (!msg.myTeamState || !msg.oppTeamState) return;

        msg.myTeamState.forEach((s, i) => {
            if (!playerTeam[i]) return;
            playerTeam[i].currentHp  = s.currentHp;
            playerTeam[i].fainted    = s.fainted;
            playerTeam[i].status     = s.status;
            playerTeam[i].statBoosts = s.statBoosts || { atk:0,def:0,spa:0,spd:0,spe:0 };
        });

        msg.oppTeamState.forEach((s, i) => {
            if (!enemyTeam[i]) return;
            enemyTeam[i].currentHp  = s.currentHp;
            enemyTeam[i].fainted    = s.fainted;
            enemyTeam[i].status     = s.status;
            enemyTeam[i].statBoosts = s.statBoosts || { atk:0,def:0,spa:0,spd:0,spe:0 };
        });

        if (msg.myActiveIdx  !== undefined) playerActive = msg.myActiveIdx;
        if (msg.oppActiveIdx !== undefined) enemyActive  = msg.oppActiveIdx;
        if (msg.turnCount    !== undefined) turnCount    = msg.turnCount;
    }

    // ─── REPRODUCIR EVENTOS COMO LOGS Y ANIMACIONES ───────────────────────
    function playEvents(events, msg, onDone) {
        if (!events || !events.length) { onDone && onDone(); return; }

        const log = (text, type) => { if (typeof addLog === 'function') addLog(text, type); };

        events.forEach(ev => {
            switch (ev.t) {
                case 'speed':
                    log(`🏃 ${ev.faster === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} ataca primero`, 'speed-win');
                    break;
                case 'speed_tie':
                    log('🎲 Velocidades iguales — orden determinado por el servidor', 'speed-win');
                    break;
                case 'switch':
                    if (ev.player === myPlayerIdx) log(`🔄 ${ev.from} regresa. ¡Adelante, ${ev.to}!`, 'important');
                    else log(`🔄 Rival: ${ev.from} regresa. ¡Adelante, ${ev.to}!`, 'important');
                    break;
                case 'use_move':
                    if (ev.player === myPlayerIdx) log(`▶️ ${ev.attacker} usa <b>${ev.moveName}</b>`, 'important');
                    else log(`◀️ ${ev.attacker} usa <b>${ev.moveName}</b>`, '');
                    break;
                case 'status_block':
                    if (ev.status === 'sleep')     log(`💤 ${ev.pokemon} está dormido.`, '');
                    if (ev.status === 'freeze')    log(`🧊 ${ev.pokemon} está congelado.`, '');
                    if (ev.status === 'paralysis') log(`⚡ ${ev.pokemon} está paralizado y no pudo moverse.`, '');
                    break;
                case 'wake':   log(`💤 ¡${ev.pokemon} se despertó!`, 'boost'); break;
                case 'thaw':   log(`🧊 ¡${ev.pokemon} se descongeló!`, 'boost'); break;
                case 'miss':   log(`✗ ¡${ev.moveName || 'El ataque'} falló!`, ''); break;
                case 'eff':
                    if (ev.level === 'super') log('💥 ¡Es súper efectivo!', 'important');
                    if (ev.level === 'weak')  log('💨 No es muy efectivo...', '');
                    if (ev.level === 'none')  log('❌ No tiene efecto.', '');
                    break;
                case 'damage':
                    log(`💔 ${Math.floor(ev.damage)} de daño a ${ev.pokemon}`, 'damage');
                    if (ev.player === myPlayerIdx) { if (typeof animHit === 'function') animHit('player'); }
                    else { if (typeof animHit === 'function') animHit('enemy'); }
                    break;
                case 'recoil':
                    log(`⚡ ${ev.player === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} recibe ${ev.damage} de retroceso`, 'damage');
                    break;
                case 'life_orb':
                    log(`🔴 Orbe Vida: ${ev.damage} de daño`, 'damage');
                    break;
                case 'focus_sash':
                    log(`💪 ¡Cinta Focus: ${ev.pokemon} aguantó con 1 HP!`, 'boost');
                    break;
                case 'apply_status': {
                    const msgs = { sleep:'quedó dormido 💤', paralysis:'quedó paralizado ⚡', burn:'quedó quemado 🔥', poison:'quedó envenenado ☠️', freeze:'quedó congelado 🧊', toxic:'quedó intoxicado ☠️' };
                    log(`${ev.pokemon} ${msgs[ev.status] || 'fue afectado'}`, 'boost');
                    break;
                }
                case 'status_fail':
                    log(ev.reason === 'has_status' ? 'Ya tiene un estado alterado' : 'Es inmune al estado', '');
                    break;
                case 'status_damage':
                    if (ev.status === 'burn')   log(`🔥 ${ev.player === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} sufre ${ev.damage} por quemadura`, 'damage');
                    if (ev.status === 'poison')  log(`☠️ ${ev.player === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} sufre ${ev.damage} por veneno`, 'damage');
                    if (ev.status === 'toxic')   log(`☠️ ${ev.player === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} sufre ${ev.damage} por intoxicación`, 'damage');
                    break;
                case 'heal':
                    if (ev.source === 'leftovers') log(`♻️ Restos: recuperó ${ev.amount} HP`, 'heal');
                    if (ev.source === 'move')       log(`💚 Recuperó ${ev.amount} HP`, 'heal');
                    break;
                case 'berry':
                    log(`🍓 ¡Baya Zidra restauró ${ev.heal} HP a ${ev.pokemon}!`, 'heal');
                    break;
                case 'boost':
                    log(`⬆️ ${ev.stat} subió`, 'boost');
                    break;
                case 'protect':
                    log(`🛡️ ¡${ev.player === myPlayerIdx ? playerTeam[playerActive]?.name : enemyTeam[enemyActive]?.name} se protegió!`, 'boost');
                    break;
                case 'faint': {
                    const isMe = ev.player === myPlayerIdx;
                    log(`😵 ¡${ev.pokemon} se debilitó!`, 'important');
                    if (typeof animFaint === 'function') animFaint(isMe ? 'player' : 'enemy');
                    break;
                }
                case 'need_switch':
                    if (ev.player === myPlayerIdx) {
                        // Yo tengo que cambiar
                        setTimeout(() => {
                            if (typeof openSwitch === 'function') {
                                switchForced = true;
                                isBusy = false;
                                openSwitch(true);
                            }
                        }, 1000);
                    } else {
                        log('⏳ Esperando que el rival elija Pokémon...', '');
                    }
                    break;
                case 'battle_over': {
                    const iWon = ev.winner === myPlayerIdx;
                    setTimeout(() => {
                        if (typeof endBattle === 'function') {
                            clearSeed(roomCode);
                            sessionStorage.removeItem('mpBattleSession');
                            endBattle(iWon);
                        }
                    }, 1200);
                    break;
                }
            }
        });

        // UI se actualiza una sola vez al final (no en cada evento)
        setTimeout(() => {
            if (typeof updateUI === 'function') updateUI();
            if (onDone) onDone();
        }, 400);
    }

    // ─── CONECTAR ────────────────────────────────────────────────────────
    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}`);
        ws.onopen    = () => { while (pendingMessages.length) ws.send(pendingMessages.shift()); };
        ws.onmessage = (e) => handleMsg(JSON.parse(e.data));
        ws.onclose   = ()  => reconnect();
        ws.onerror   = ()  => updateStatus('❌ Error de conexión. Recarga la página.', 'error');
        setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'ping' })); }, 25000);
    }

    function send2(type, payload = {}) {
        const d = JSON.stringify({ type, ...payload });
        if (ws?.readyState === WebSocket.OPEN) ws.send(d);
        else { pendingMessages.push(d); if (!ws || ws.readyState === WebSocket.CLOSED) connect(); }
    }

    // ─── MENSAJES DEL SERVIDOR ────────────────────────────────────────────
    function handleMsg(msg) {
        switch (msg.type) {
            case 'room_created':
                roomCode = msg.code; myPlayerIdx = 0;
                updateStatus(`✅ Sala creada<br><span style="color:var(--gold,#fbbf24);font-size:22px;letter-spacing:8px;font-weight:bold;">${msg.code}</span><br><small style="color:#64748b;">Comparte este código con tu rival</small>`, 'waiting');
                showCopyBtn(msg.code);
                break;
            case 'room_joined':
                roomCode = msg.code; myPlayerIdx = 1;
                updateStatus('✅ ¡Unido! Enviando equipo...', 'waiting');
                submitTeam();
                break;
            case 'opponent_joined':
                updateStatus('👾 ¡Rival encontrado! Enviando equipos...', 'ok');
                submitTeam();
                break;
            case 'waiting_opponent':
                updateStatus(`⏳ ${msg.msg}`, 'waiting');
                break;
            case 'battle_start':
                hideLobby();
                myPlayerIdx = msg.myIdx;
                try { sessionStorage.setItem('mpBattleSession', JSON.stringify({ roomCode, playerIdx:myPlayerIdx })); } catch(e) {}
                if (handlers.onBattleStart) handlers.onBattleStart(msg);
                break;
            case 'turn_result':
                // ← Nuevo mensaje del servidor v3 con eventos y estado completo
                if (handlers.onTurnResult) handlers.onTurnResult(msg);
                break;
            case 'opponent_chose':
                showOppChose();
                break;
            case 'opponent_canceled':
                hideOppChose();
                if (typeof addLog === 'function') addLog('↩️ El rival canceló su acción', '');
                break;
            case 'opponent_forced_switch':
                if (handlers.onOppForcedSwitch) handlers.onOppForcedSwitch(msg.switchTo, msg.pokemon);
                break;
            case 'opponent_reconnected':
                hideDisconnWarn();
                if (typeof addLog === 'function') addLog('✅ ¡El rival volvió!', 'boost');
                break;
            case 'reconnected_ok':
                hideLobby();
                if (typeof addLog === 'function') addLog('🔄 Reconectado a la partida', 'boost');
                break;
            case 'opponent_disconnected':
                showDisconnWarn(msg.msg, msg.seconds);
                if (typeof addLog === 'function') addLog('⚠️ El rival se desconectó. Tiene 60s...', 'important');
                break;
            case 'opponent_timeout':
                hideDisconnWarn();
                clearSeed(roomCode);
                sessionStorage.removeItem('mpBattleSession');
                if (typeof addLog === 'function') addLog('🏆 ¡El rival no volvió! Ganaste.', 'important');
                if (typeof battleOver !== 'undefined') battleOver = true;
                if (typeof isBusy    !== 'undefined') isBusy    = false;
                showResult('🏆 ¡GANASTE!', 'El rival abandonó la partida.');
                break;
            case 'battle_ended':
                clearSeed(roomCode);
                sessionStorage.removeItem('mpBattleSession');
                break;
            case 'error':
                const lob = document.getElementById('mpLobby');
                if (!lob || lob.style.display === 'none') { sessionStorage.removeItem('mpBattleSession'); showLobby(); }
                updateStatus(`❌ ${msg.msg}`, 'error');
                break;
            case 'pong': break;
        }
    }

    // ─── ACCIONES ────────────────────────────────────────────────────────
    function createRoom()  { connect(); send2('create_room', { userName:getUsername(), userAvatar:getAvatar(), matchSeed:genSeed() }); }
    function joinRoom(c)   { connect(); send2('join_room',   { code:c.toUpperCase().trim(), userName:getUsername(), userAvatar:getAvatar() }); }
    function joinWithCode(){ const c=(document.getElementById('mpCodeInput')?.value||'').trim(); if(c.length!==4){updateStatus('❌ El código debe tener 4 letras','error');return;} joinRoom(c); }

    function submitTeam() {
        if (typeof playerTeam === 'undefined' || !playerTeam?.length) {
            try { const r = sessionStorage.getItem('kantoTeam') || localStorage.getItem('kantoTeam'); if(r) window.playerTeam = JSON.parse(r); } catch(e) {}
        }
        if (!playerTeam?.length) { updateStatus('❌ No hay equipo cargado. Vuelve al constructor.', 'error'); return; }
        const team = playerTeam.map(p => ({
            id:p.id, name:p.name, types:p.types, stats:p.stats, moves:p.moves,
            ability:p.ability, item:p.item, nature:p.nature, evs:p.evs, level:p.level, currentHp:p.currentHp,
        }));
        send2('submit_team', { team });
    }

    // Enviar movimiento con datos del movimiento para que el servidor calcule correctamente
    function chooseMove(moveName) {
        if (!isMultiplayer || moveChosen) return;
        moveChosen = true;
        // Enviar datos del movimiento para que el servidor lo calcule bien
        const moveData = typeof getMoveInfo === 'function' ? getMoveInfo(moveName) : null;
        send2('choose_move', { moveName, moveData });
        showWaiting('⏳ Esperando que el rival elija...');
    }

    function chooseSwitch(idx)  { if (!isMultiplayer) return; send2('choose_switch', { switchTo:idx }); showWaiting('⏳ Esperando al rival...'); }
    function cancelAction()     { if (!isMultiplayer || !moveChosen) return; moveChosen = false; hideWaitingBanner(); send2('cancel_action', {}); }
    function forcedSwitch(idx)  { send2('forced_switch', { switchTo:idx }); }
    function reportBattleEnd(w) { clearSeed(roomCode); sessionStorage.removeItem('mpBattleSession'); send2('battle_end', { winner:w }); }
    function surrender()        { clearSeed(roomCode); sessionStorage.removeItem('mpBattleSession'); send2('surrender', {}); }

    function reconnect() {
        if (!isMultiplayer || !roomCode) return;
        setTimeout(() => {
            connect();
            setTimeout(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                    const u = getUser();
                    ws.send(JSON.stringify({ type:'join_room', code:roomCode, playerIdx:myPlayerIdx, userName:u.name, userAvatar:u.avatar }));
                }
            }, 400);
        }, 2000);
    }

    // ─── LOBBY ───────────────────────────────────────────────────────────
    function showLobby() {
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = 'none';
        let lob = document.getElementById('mpLobby');
        if (!lob) {
            lob = document.createElement('div');
            lob.id = 'mpLobby';
            lob.style.cssText = 'position:fixed;inset:0;background:var(--theme-bg,#050510);z-index:500;display:flex;align-items:center;justify-content:center;font-family:"Courier New",monospace;';
            const u = getUser();
            const avs = ['🎮','⚔️','🏆','🔥','💎','🌙','⭐','🐉','🦁','🌊'];
            lob.innerHTML = `
            <div style="background:var(--theme-panel,#0a0a1a);border:2px solid var(--gold,#fbbf24);border-radius:12px;padding:2rem;max-width:400px;width:90%;box-shadow:0 0 60px rgba(251,191,36,.1);">
                <div style="font-size:20px;color:var(--gold,#fbbf24);letter-spacing:4px;text-align:center;margin-bottom:1.5rem;">🌐 BATALLA ONLINE</div>
                <div style="background:rgba(0,0,0,.3);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:12px;margin-bottom:14px;">
                    <div style="font-size:10px;color:#64748b;letter-spacing:2px;margin-bottom:8px;">TU PERFIL</div>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <select id="mpAvatarSelect" onchange="MP._pc()" style="background:rgba(0,0,0,.5);border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:20px;padding:6px;cursor:pointer;width:52px;">
                            ${avs.map(a=>`<option value="${a}"${u.avatar===a?' selected':''}>${a}</option>`).join('')}
                        </select>
                        <input id="mpUserName" type="text" maxlength="14" placeholder="Tu nombre..." value="${u.name}" oninput="MP._pc()"
                            style="flex:1;padding:9px 12px;background:rgba(0,0,0,.4);border:1px solid #334155;border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:13px;outline:none;"
                            onfocus="this.style.borderColor='var(--gold,#fbbf24)'" onblur="this.style.borderColor='#334155'">
                    </div>
                </div>
                <div id="mpStatus" style="text-align:center;padding:10px;border-radius:6px;font-size:12px;margin-bottom:14px;min-height:44px;background:rgba(0,0,0,.2);color:#94a3b8;line-height:1.8;">Elige una opción para comenzar</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button onclick="MP.createRoom()" style="padding:12px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;border-radius:6px;color:#1a1a2e;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;cursor:pointer;" onmouseover="this.style.filter='brightness(1.12)'" onmouseout="this.style.filter=''">➕ CREAR SALA</button>
                    <div style="text-align:center;font-size:11px;color:#334155;">— o únete con código —</div>
                    <div style="display:flex;gap:8px;">
                        <input id="mpCodeInput" maxlength="4" placeholder="XXXX" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')MP.joinWithCode()"
                            style="flex:1;padding:10px;background:rgba(0,0,0,.4);border:1px solid #334155;border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:20px;letter-spacing:8px;text-align:center;outline:none;"
                            onfocus="this.style.borderColor='var(--gold,#fbbf24)'" onblur="this.style.borderColor='#334155'">
                        <button onclick="MP.joinWithCode()" style="padding:10px 16px;background:#1e293b;border:1px solid var(--gold,#fbbf24);border-radius:6px;color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:12px;cursor:pointer;" onmouseover="this.style.background='rgba(251,191,36,.1)'" onmouseout="this.style.background='#1e293b'">UNIRSE</button>
                    </div>
                </div>
                <div id="mpCopyArea" style="display:none;margin-top:12px;text-align:center;"></div>
                <a href="index.html" style="display:block;margin-top:16px;text-align:center;color:#475569;font-size:11px;text-decoration:none;" onmouseover="this.style.color='var(--gold,#fbbf24)'" onmouseout="this.style.color='#475569'">◀ Volver al menú</a>
            </div>`;
            document.body.appendChild(lob);
        }
        lob.style.display = 'flex';
    }

    function hideLobby() {
        const l = document.getElementById('mpLobby');
        if (l) l.style.display = 'none';
        const layout = document.querySelector('.battle-layout');
        if (layout) layout.style.display = '';
    }

    function updateStatus(html, type) {
        const el = document.getElementById('mpStatus'); if (!el) return;
        el.innerHTML = html;
        const C = { ok:'#22c55e', waiting:'var(--gold,#fbbf24)', error:'#ef4444' };
        const B = { ok:'rgba(34,197,94,.1)', waiting:'rgba(251,191,36,.08)', error:'rgba(239,68,68,.1)' };
        el.style.color = C[type]||'#94a3b8'; el.style.background = B[type]||'rgba(0,0,0,.2)';
        el.style.border = C[type] ? `1px solid ${C[type]}` : 'none';
    }

    function showCopyBtn(code) {
        const a = document.getElementById('mpCopyArea'); if (!a) return;
        a.style.display = 'block';
        a.innerHTML = `<button onclick="navigator.clipboard.writeText('${code}').then(()=>this.innerHTML='✅ ¡Copiado!')" style="background:#1e293b;border:1px solid var(--gold,#fbbf24);color:var(--gold,#fbbf24);font-family:'Courier New',monospace;font-size:12px;padding:9px 18px;border-radius:5px;cursor:pointer;">📋 Copiar: <b style="letter-spacing:5px;">${code}</b></button>`;
    }

    function _pc() {
        saveUser(document.getElementById('mpUserName')?.value?.trim()||null, document.getElementById('mpAvatarSelect')?.value||null);
    }

    function showWaiting(msg) {
        let el = document.getElementById('mpWaitBanner');
        if (!el) { el = document.createElement('div'); el.id='mpWaitBanner'; el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1b4b;border:2px solid #4f46e5;border-radius:8px;padding:10px 20px;font-family:"Courier New",monospace;font-size:12px;color:#a5b4fc;z-index:500;text-align:center;backdrop-filter:blur(4px);white-space:nowrap;'; document.body.appendChild(el); }
        el.innerHTML = `<div style="margin-bottom:8px;">${msg}</div><button onclick="MP.cancelAction()" style="background:#ef4444;border:none;border-radius:4px;color:white;padding:5px 14px;font-size:11px;font-family:'Courier New',monospace;cursor:pointer;">❌ Cancelar</button>`;
        el.style.display = 'block';
    }
    function hideWaitingBanner() { const el=document.getElementById('mpWaitBanner'); if(el) el.style.display='none'; }
    function showWaiting2(msg)   { showWaiting(msg); }

    function showOppChose() {
        let el = document.getElementById('mpOppChose');
        if (!el) { el=document.createElement('div'); el.id='mpOppChose'; el.style.cssText='position:fixed;top:60px;right:16px;background:rgba(34,197,94,.12);border:1px solid #22c55e;border-radius:6px;padding:6px 14px;font-size:12px;color:#22c55e;z-index:500;'; document.body.appendChild(el); }
        el.textContent='✅ Rival eligió'; el.style.display='block';
    }
    function hideOppChose() { const el=document.getElementById('mpOppChose'); if(el) el.style.display='none'; }

    function showDisconnWarn(msg, sec) {
        let el = document.getElementById('mpDisconnWarn');
        if (!el) { el=document.createElement('div'); el.id='mpDisconnWarn'; el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a0505;border:2px solid #ef4444;border-radius:10px;padding:24px 32px;text-align:center;font-family:"Courier New",monospace;z-index:600;backdrop-filter:blur(6px);min-width:280px;'; document.body.appendChild(el); }
        let t = sec;
        const upd = () => { el.innerHTML=`<div style="font-size:14px;color:#ef4444;margin-bottom:8px;">⚠️ RIVAL DESCONECTADO</div><div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">${msg}</div><div style="font-size:32px;color:var(--gold,#fbbf24);font-weight:bold;margin-bottom:12px;">${t}s</div><button onclick="MP.reconnect()" style="width:100%;background:#3b82f6;border:none;border-radius:5px;color:white;padding:9px;font-family:'Courier New',monospace;font-size:12px;cursor:pointer;font-weight:bold;">🔄 Forzar reconexión</button>`; };
        upd(); el.style.display='block';
        disconnectCountdown = setInterval(()=>{ t--; upd(); if(t<=0) clearInterval(disconnectCountdown); },1000);
    }
    function hideDisconnWarn() { const el=document.getElementById('mpDisconnWarn'); if(el) el.style.display='none'; clearInterval(disconnectCountdown); }

    function showResult(title, sub) {
        const m=document.getElementById('resultModal'), te=document.getElementById('resultTitle'), me=document.getElementById('resultMsg');
        if (m && te && me) { te.innerHTML=`<span style="color:var(--gold,#fbbf24);">${title}</span>`; me.textContent=sub; m.classList.add('open'); }
        else alert(`${title}\n${sub}`);
    }

    return {
        init, createRoom, joinRoom, joinWithCode,
        chooseMove, chooseSwitch, cancelAction,
        forcedSwitch, reportBattleEnd, surrender,
        reconnect, _pc,
        on: (ev, fn) => { handlers[ev] = fn; },
        get active()    { return isMultiplayer; },
        get playerIdx() { return myPlayerIdx; },
        get code()      { return roomCode; },
        get seed()      { return matchSeed; },
        getUser, saveUser,
    };
})();

document.addEventListener('DOMContentLoaded', () => MP.init());