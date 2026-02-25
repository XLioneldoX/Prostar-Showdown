// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/battle-system.js  —  LÓGICA DE BATALLA                               ║
// ║  Turnos, ataques, habilidades, cambios de Pokémon, victoria/derrota.    ║
// ║  Para cambiar datos ve a data/ · Para cambiar fórmulas ve a battle-engine║
// ╚══════════════════════════════════════════════════════════════════════════╝

// generateEnemyTeam() → movido a battle-main.js (soporta trainer + wild)

// ─── TURNO DEL JUGADOR ────────────────────────────────────────────────────────
function playerAttack(moveIndex) {
    if (battleOver || isBusy) return;

    // ── MODO MULTIJUGADOR: enviar movimiento al servidor ─────────────────────
    if (typeof MP !== 'undefined' && MP.active) {
        const moveName = playerTeam[playerActive].moves[moveIndex];
        MP.chooseMove(moveName);
        // En MP, el turno se ejecuta cuando el servidor envía turn_resolve
        return;
    }

    isBusy = true;
    disableMoves();

    const player = playerTeam[playerActive];
    const enemy = enemyTeam[enemyActive];
    const playerMove = player.moves[moveIndex];
    const enemyMove = enemy.moves[chooseEnemyMove(enemy, player)];
    const first = whoGoesFirst(playerMove, enemyMove);

    const pSpe = getEffectiveSpe(player);
    const eSpe = getEffectiveSpe(enemy);

    addLog('━━━━━━━━━━━━━━', 'separator');

    // Log de orden de turno
    const pPrio = getMoveInfo(playerMove).priority || 0;
    const ePrio = getMoveInfo(enemyMove).priority || 0;
    if (pPrio !== ePrio)
        addLog(first === 'player' ? `⚡ ${playerMove} tiene PRIORIDAD` : `⚡ ${enemyMove} tiene PRIORIDAD (rival)`, 'speed-win');
    else if (pSpe !== eSpe)
        addLog(`🏃 ${first === 'player' ? player.name : enemy.name} (SPE ${first === 'player' ? pSpe : eSpe}) ataca primero`, 'speed-win');
    else
        addLog('🎲 Velocidades iguales – orden aleatorio', 'speed-win');

    const doPlayerAtk = (cb) => executeAttack(player, enemy, playerMove, 'player', cb);
    const doEnemyAtk = (cb) => executeAttack(enemy, player, enemyMove, 'enemy', cb);

    if (first === 'player') {
        doPlayerAtk(() => {
            if (!enemy.fainted && !player.fainted && !battleOver)
                setTimeout(() => doEnemyAtk(() => afterTurn()), 800);
            else afterTurn();
        });
    } else {
        doEnemyAtk(() => {
            if (!player.fainted && !enemy.fainted && !battleOver)
                setTimeout(() => doPlayerAtk(() => afterTurn()), 800);
            else afterTurn();
        });
    }
}


// ─── CHEQUEO DE ESTADO ANTES DE ATACAR ───────────────────────────────────────
// Devuelve true si el Pokémon PUEDE moverse, false si el estado lo bloquea.
// Gestiona: parálisis (25%), sueño (100% hasta despertar), congelación (hasta descongelar)
function checkStatusBlock(pokemon, logFn) {
    const sd = StatusDB[pokemon.status];
    if (!sd || !sd.blockMove) return true; // sin estado bloqueante → puede moverse

    switch (pokemon.status) {

        case 'sleep': {
            // Inicializar contador de sueño si no existe
            if (pokemon.sleepTurns === undefined) {
                const min = sd.turnsMin || 1;
                const max = sd.turnsMax || 3;
                pokemon.sleepTurns = min + Math.floor(BattleRNG.random() * (max - min + 1));
            }
            pokemon.sleepTurns--;
            if (pokemon.sleepTurns <= 0) {
                pokemon.status = null;
                pokemon.sleepTurns = undefined;
                logFn(`💤 ${pokemon.name} ${sd.wakeMsg || 'se despertó!'}`, 'boost');
                return true; // se despertó este turno, puede moverse
            }
            logFn(`💤 ${(sd.blockMsg || '{pokemon} está dormido.').replace('{pokemon}', pokemon.name)}`, '');
            return false;
        }

        case 'freeze': {
            const thawChance = sd.thawChance || 20;
            if (BattleRNG.random() * 100 < thawChance) {
                pokemon.status = null;
                logFn(`🧊 ${pokemon.name} ${sd.thawMsg || 'se descongeló!'}`, 'boost');
                return true; // se descongeló, puede actuar
            }
            logFn(`🧊 ${(sd.blockMsg || '{pokemon} está congelado.').replace('{pokemon}', pokemon.name)}`, '');
            return false;
        }

        case 'paralysis': {
            const blockChance = sd.blockChance || 25;
            if (BattleRNG.random() * 100 < blockChance) {
                logFn(`⚡ ${(sd.blockMsg || '{pokemon} está paralizado.').replace('{pokemon}', pokemon.name)}`, '');
                return false;
            }
            return true;
        }

        default:
            return true;
    }
}

// ─── EJECUTAR UN ATAQUE ───────────────────────────────────────────────────────
function executeAttack(attacker, defender, moveName, side, callback) {
    const move = getMoveInfo(moveName);
    const defSide = side === 'player' ? 'enemy' : 'player';

    // ── Chequeo de estado: ¿puede moverse? ───────────────────────────────
    if (!checkStatusBlock(attacker, (msg, type) => addLog(msg, type))) {
        updateUI(); // actualizar badge de estado (ej. si se descongeló)
        setTimeout(callback, 600);
        return;
    }

    addLog(`${side === 'player' ? '▶️' : '◀️'} ${attacker.name} usa <b>${moveName}</b>`, side === 'player' ? 'important' : '');

    // ── Movimiento de estado ──────────────────────────────────────────────
    if (move.category === 'status') {
        handleStatusMove(attacker, defender, moveName);
        updateUI();
        setTimeout(callback, 600);
        return;
    }

    // ── Inmunidad por tipo de habilidad ──────────────────────────────────
    if (isImmuneByAbility(defender, move.type)) {
        const ab = AbilitiesDB[defender.ability];
        addLog(`${ab.icon} ${ab.name}: ¡${defender.name} es inmune a ${move.type}!`, 'boost');
        if (defSide === 'enemy') revealEnemyStat('ability', defender);
        if (defSide === 'enemy') revealEnemyStat('ability', defender);
        setTimeout(callback, 600);
        return;
    }

    const isPhysical = move.category === 'physical';
    const effectiveness = calculateEffectiveness(move.type, defender.types);
    let dmg = calculateDamage(attacker, defender, moveName);

    // ── Cinta Focus ───────────────────────────────────────────────────────
    if (defender.currentHp - dmg <= 0 && !defender.itemUsed
        && defender.item === 'Cinta Focus' && defender.currentHp === defender.stats.hp) {
        defender.currentHp = 1;
        defender.itemUsed = true;
        addLog(`💪 ¡Cinta Focus: ${defender.name} aguantó con 1 HP!`, 'boost');
        if (defSide === 'enemy') revealEnemyStat('item', defender);
        else revealPlayerStat('item', defender);
        // Revelar objeto si es enemigo
        if (defSide === 'enemy') revealEnemyStat('item', defender);
        else revealPlayerStat('item', defender);
    } else {
        defender.currentHp = Math.max(0, defender.currentHp - dmg);
        if (defender.currentHp <= 0) defender.fainted = true;
    }

    // ── Log efectividad ───────────────────────────────────────────────────
    if (effectiveness > 1) addLog('💥 ¡Es súper efectivo!', 'important');
    if (effectiveness < 1 && effectiveness > 0) addLog('💨 No es muy efectivo...', '');
    if (effectiveness === 0) addLog('❌ No tiene efecto', '');
    addLog(`💔 ${Math.floor(dmg)} de daño a ${defender.name}`, 'damage');

    // ── Recoil del movimiento ─────────────────────────────────────────────
    if (move.effect === 'recoil_33') {
        const r = Math.floor(dmg * 0.33);
        attacker.currentHp = Math.max(0, attacker.currentHp - r);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        addLog(`⚡ ${attacker.name} recibe ${r} de retroceso`, 'damage');
        if (side === 'enemy') revealEnemyStat('item', attacker);
        else revealPlayerStat('item', attacker);
        if (side === 'enemy') revealEnemyStat('item', attacker);
        else revealPlayerStat('item', attacker);
    }

    // ── Orbe Vida ─────────────────────────────────────────────────────────
    if (attacker.item === 'Orbe Vida') {
        const o = Math.floor(attacker.stats.hp * 0.1);
        attacker.currentHp = Math.max(0, attacker.currentHp - o);
        if (attacker.currentHp <= 0) attacker.fainted = true;
    }

    // ── Efectos secundarios de estado del movimiento ──────────────────────
    // (solo si el defensor no tiene habilidad Fuerza Bruta en el atacante)
    const bruteForce = AbilitiesDB[attacker.ability]?.effect === 'brute_force';
    if (!bruteForce && move.effect?.startsWith('apply_') && !defender.fainted) {
        const sk = move.effect.replace('apply_', '');
        const chance = move.effectChance || 0;
        if (!defender.status && !isImmuneToStatus(defender, sk) && BattleRNG.random() * 100 < chance) {
            defender.status = sk;
            const sd = StatusDB[sk];
            addLog(sd?.applyMsg?.replace('{pokemon}', defender.name) || `${defender.name} fue afectado`, 'boost');
        }
    }

    // ── Habilidad del defensor al recibir golpe ───────────────────────────
    if (!defender.fainted) {
        applyAbilityOnHit(defender, attacker, isPhysical, effectiveness, (msg, type) => addLog(msg, type));
    }

    // ── Baya Zidra ────────────────────────────────────────────────────────
    if (!defender.fainted && !defender.itemUsed && defender.item === 'Baya Zidra'
        && (defender.currentHp / defender.stats.hp) < 0.25) {
        const h = Math.floor(defender.stats.hp / 3);
        defender.currentHp = Math.min(defender.currentHp + h, defender.stats.hp);
        defender.itemUsed = true;
        addLog(`🍓 ¡Baya Zidra restauró ${h} HP a ${defender.name}!`, 'heal');
    }

    animHit(defSide);
    updateUI();

    if (defender.fainted) { setTimeout(() => handleFaint(defSide, callback), 600); return; }
    if (attacker.fainted) { setTimeout(() => handleFaint(side, callback), 600); return; }
    setTimeout(callback, 600);
}

// ─── MOVIMIENTOS DE ESTADO ────────────────────────────────────────────────────
function handleStatusMove(user, target, moveName) {
    const move = getMoveInfo(moveName);

    if (move.effect === 'heal_50') {
        const h = Math.floor(user.stats.hp * 0.5);
        user.currentHp = Math.min(user.currentHp + h, user.stats.hp);
        addLog(`💚 ${user.name} recuperó ${h} HP`, 'heal');
        return;
    }
    if (move.effect === 'heal_100_sleep') {
        user.currentHp = user.stats.hp;
        user.status = 'sleep';
        addLog(`💚 ${user.name} se durmió y recuperó todo el HP`, 'heal');
        return;
    }
    if (move.effect === 'boost_atk_spe') {
        user.statBoosts.atk = Math.min(6, (user.statBoosts.atk || 0) + 1);
        user.statBoosts.spe = Math.min(6, (user.statBoosts.spe || 0) + 1);
        addLog(`⬆️ ${user.name}: ↑ ATK y ↑ SPE`, 'boost');
        return;
    }
    if (move.effect === 'boost_spe') {
        user.statBoosts.spe = Math.min(6, (user.statBoosts.spe || 0) + 1);
        addLog(`⬆️ ${user.name}: ↑ SPE`, 'boost');
        return;
    }
    if (move.effect === 'protect') {
        user.protected = true;
        addLog(`🛡️ ${user.name} se protege este turno`, 'boost');
        return;
    }
    if (move.effect?.startsWith('apply_')) {
        const sk = move.effect.replace('apply_', '');
        if (move.accuracy !== null && BattleRNG.random() * 100 > (move.accuracy || 100)) {
            addLog(`✗ ${moveName} falló`, ''); return;
        }
        if (target.status) { addLog(`${target.name} ya tiene un estado`, ''); return; }
        if (isImmuneToStatus(target, sk)) {
            const ab = AbilitiesDB[target.ability];
            addLog(`${ab.icon} ${ab.name}: ${target.name} es inmune`, 'boost'); return;
        }
        target.status = sk;
        const sd = StatusDB[sk];
        addLog(sd?.applyMsg?.replace('{pokemon}', target.name) || `${target.name} fue afectado`, 'boost');
    }
}

// ─── FIN DE TURNO ─────────────────────────────────────────────────────────────
function afterTurn() {
    if (battleOver) return;
    turnCount++;
    const tb = document.getElementById('turnBadge');
    if (tb) tb.textContent = `Turno ${turnCount}`;

    [
        { p: playerTeam[playerActive] },
        { p: enemyTeam[enemyActive] },
    ].forEach(({ p }) => {
        if (p.fainted) return;

        // Restos
        if (p.item === 'Restos') {
            const h = Math.floor(p.stats.hp / 16);
            p.currentHp = Math.min(p.currentHp + h, p.stats.hp);
            addLog(`♻️ Restos: ${p.name} recuperó ${h} HP`, 'heal');
            if (enemyTeam.includes(p)) revealEnemyStat('item', p);
            // Revelar si es el rival
            if (enemyTeam.includes(p)) revealEnemyStat('item', p);
        }

        // Habilidades de fin de turno (Recuperación pasiva, Ímpetu Veloz)
        const abMsg = applyAbilityEndOfTurn(p);
        if (abMsg) addLog(abMsg, 'heal');

        // Estados que dañan (veneno, quemadura, etc.)
        const statusRes = applyStatusEffects(p);
        if (statusRes) {
            addLog(statusRes.message, 'damage');
            // Marcar fainted inmediatamente si llega a 0
            if (p.currentHp <= 0) { p.currentHp = 0; p.fainted = true; }
        }

        // Limpiar protección
        p.protected = false;
    });

    updateUI();

    // Detectar fainted por daño pasivo y llamar handleFaint correctamente
    const pFainted = playerTeam[playerActive].fainted;
    const eFainted = enemyTeam[enemyActive].fainted;

    if (pFainted && eFainted) {
        // Ambos mueren a la vez (raro pero posible con retroceso/estado)
        // El jugador pierde si no tiene más Pokémon
        if (playerTeam.every(p => p.fainted)) { endBattle(false); return; }
        handleFaint('player', () => {
            if (enemyTeam.every(p => p.fainted)) endBattle(true);
            else handleFaint('enemy', () => { isBusy = false; renderMoves(); });
        });
        return;
    }
    if (eFainted) { handleFaint('enemy', () => { isBusy = false; renderMoves(); }); return; }
    if (pFainted) { handleFaint('player', () => { }); return; }
    if (playerTeam.every(p => p.fainted)) { endBattle(false); return; }
    if (enemyTeam.every(p => p.fainted)) { endBattle(true); return; }

    isBusy = false;
    renderMoves();
}

// ─── DEBILITAMIENTO ───────────────────────────────────────────────────────────
function handleFaint(side, callback) {
    const team = side === 'player' ? playerTeam : enemyTeam;
    const active = side === 'player' ? playerActive : enemyActive;
    addLog(`😵 ¡${team[active].name} se debilitó!`, 'important');
    animFaint(side);

    if (team.every(p => p.fainted)) {
        setTimeout(() => endBattle(side === 'enemy'), 1200);
        return;
    }
    setTimeout(() => {
        if (typeof MP !== 'undefined' && MP.active) {
            // MULTIPLAYER: El jugador decide cuándo enviar su nuevo Pokémon.
            // Si el enemigo murió, solo esperamos a que el rival elija.
            // Si yo morí, levanto el switch de manera forzada para elegir.
            if (side === 'player') {
                switchForced = true;
                isBusy = false;
                openSwitch(true);
            }
        } else {
            // SINGLE-PLAYER ORIGINAL
            if (side === 'enemy') {
                enemyActive = enemyTeam.findIndex(p => !p.fainted);
                const newEnemy = enemyTeam[enemyActive];
                addLog(`🔄 ¡El rival envió a ${newEnemy.name}!`, 'important');
                // Habilidad on_switch_in del rival
                applyAbilitySwitchIn(newEnemy, playerTeam[playerActive], (msg, t) => { addLog(msg, t); if (msg) revealEnemyStat('ability', newEnemy); });
                updateUI();
                if (callback) callback();
            } else {
                switchForced = true;
                isBusy = false;
                openSwitch(true);
            }
        }
    }, 1000);
}

// ─── CAMBIO DE POKÉMON ────────────────────────────────────────────────────────
function openSwitch(forced = false) {
    switchForced = forced;
    const available = playerTeam.map((p, i) => ({ p, i })).filter(o => !o.p.fainted && o.i !== playerActive);
    if (!available.length) { addLog('⚠️ No hay Pokémon disponibles', ''); return; }

    const titleEl = document.getElementById('switchTitle');
    if (titleEl) titleEl.textContent = forced ? '¡DEBES ELEGIR UN POKÉMON!' : 'SELECCIONA UN POKÉMON';
    document.getElementById('switchModal').classList.add('open');

    const grid = document.getElementById('switchGrid');
    grid.innerHTML = '';
    available.forEach(({ p, i }) => {
        const hpPct = (p.currentHp / p.stats.hp) * 100;
        const col = hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#eab308' : '#ef4444';
        const sprite = getSpriteUrl(p.id, 'front');
        const ab = AbilitiesDB[p.ability];
        const card = document.createElement('div');
        card.className = 'switch-card';
        card.innerHTML = `
            <img src="${sprite}" onerror="onSpriteError(this,p.id)">
            <div class="switch-card-name">${p.name}</div>
            <div style="font-size:6px;color:#94a3b8;margin-bottom:2px;">${ab ? ab.icon + ' ' + ab.name : ''}</div>
            <div class="switch-card-hp" style="color:${col};">${Math.floor(p.currentHp)}/${p.stats.hp}</div>
            <div style="height:4px;background:#1e293b;border-radius:2px;margin-top:4px;overflow:hidden;">
                <div style="height:100%;width:${hpPct}%;background:${col};border-radius:2px;"></div>
            </div>
        `;
        card.onclick = () => switchTo(i);
        grid.appendChild(card);
    });

    const cancelBtn = document.getElementById('switchCancelBtn');
    if (cancelBtn) cancelBtn.style.display = forced ? 'none' : 'block';
}

function closeSwitch() {
    if (switchForced) return;
    document.getElementById('switchModal').classList.remove('open');
}

function switchTo(newIndex) {
    const oldName = playerTeam[playerActive].name;

    // ── MODO MULTIJUGADOR ─────────────────────────────────────────────────────
    if (typeof MP !== 'undefined' && MP.active) {
        if (switchForced) {
            MP.forcedSwitch(newIndex);
        } else {
            MP.chooseSwitch(newIndex);
            document.getElementById('switchModal').classList.remove('open');
            return; // En multiplayer regular switch, esperar respuesta del servidor
        }
    }

    playerActive = newIndex;
    const newPoke = playerTeam[playerActive];

    document.getElementById('switchModal').classList.remove('open');
    addLog('━━━━━━━━━━━━━━', 'separator');
    addLog(`🔄 ${oldName} regresa. ¡Adelante, ${newPoke.name}!`, 'important');

    // Habilidad on_switch_in del nuevo Pokémon
    applyAbilitySwitchIn(newPoke, enemyTeam[enemyActive], (msg, t) => addLog(msg, t));

    updateUI();
    renderMoves();

    if (!switchForced) {
        isBusy = true;
        disableMoves();
        const enemy = enemyTeam[enemyActive];
        const emIdx = chooseEnemyMove(enemy, newPoke);
        setTimeout(() => executeAttack(enemy, newPoke, enemy.moves[emIdx], 'enemy', () => afterTurn()), 800);
    } else {
        switchForced = false;
        isBusy = false;
    }
}

// ─── FIN DE BATALLA ───────────────────────────────────────────────────────────
function endBattle(playerWon) {
    battleOver = true;
    isBusy = true;
    addLog('━━━━━━━━━━━━━━', 'separator');
    addLog(playerWon ? '🏆 ¡VICTORIA TOTAL!' : '💀 HAS SIDO DERROTADO', 'important');
    setTimeout(() => {
        const modal = document.getElementById('resultModal');
        document.getElementById('resultTitle').innerHTML = playerWon
            ? '<span style="color:#fbbf24;">🎉 ¡VICTORIA!</span>'
            : '<span style="color:#ef4444;">💀 DERROTA</span>';
        document.getElementById('resultMsg').textContent = playerWon
            ? '¡Has derrotado a todos los Pokémon rivales!'
            : 'Todos tus Pokémon fueron derrotados... ¡Entrena más!';
        modal.classList.add('open');
    }, 1800);
}

function confirmSurrender() {
    if (!confirm('¿Seguro que quieres rendirte?')) return;
    if (typeof MP !== 'undefined' && MP.active) {
        MP.surrender();
    }
    endBattle(false);
}
