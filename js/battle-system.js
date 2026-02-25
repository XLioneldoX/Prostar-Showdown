// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/battle-system.js  —  LÓGICA DE BATALLA                               ║
// ║  Turnos, ataques, habilidades, cambios de Pokémon, victoria/derrota.    ║
// ║  Para cambiar datos ve a data/ · Para cambiar fórmulas ve a battle-engine║
// ╚══════════════════════════════════════════════════════════════════════════╝

// generateEnemyTeam() → movido a battle-main.js (soporta trainer + wild)

// ─── TURNO DEL JUGADOR ────────────────────────────────────────────────────────
function playerAttack(moveIndex) {
    if (battleOver || isBusy) return;
    isBusy = true;
    disableMoves();

    const player     = playerTeam[playerActive];
    const enemy      = enemyTeam[enemyActive];
    const playerMove = player.moves[moveIndex];
    const enemyMove  = enemy.moves[chooseEnemyMove(enemy, player)];
    const first      = whoGoesFirst(playerMove, enemyMove);

    const pSpe = getEffectiveSpe(player);
    const eSpe = getEffectiveSpe(enemy);

    addLog('━━━━━━━━━━━━━━', 'separator');

    // Log de orden de turno
    const pPrio = getMoveInfo(playerMove).priority || 0;
    const ePrio = getMoveInfo(enemyMove).priority  || 0;
    if (pPrio !== ePrio)
        addLog(first === 'player' ? `⚡ ${playerMove} tiene PRIORIDAD` : `⚡ ${enemyMove} tiene PRIORIDAD (rival)`, 'speed-win');
    else if (pSpe !== eSpe)
        addLog(`🏃 ${first==='player'?player.name:enemy.name} (SPE ${first==='player'?pSpe:eSpe}) ataca primero`, 'speed-win');
    else
        addLog('🎲 Velocidades iguales – orden aleatorio', 'speed-win');

    const doPlayerAtk = (cb) => executeAttack(player, enemy, playerMove, 'player', cb);
    const doEnemyAtk  = (cb) => executeAttack(enemy, player, enemyMove,  'enemy',  cb);

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
                pokemon.sleepTurns = min + Math.floor(Math.random() * (max - min + 1));
            }
            pokemon.sleepTurns--;
            if (pokemon.sleepTurns <= 0) {
                pokemon.status     = null;
                pokemon.sleepTurns = undefined;
                logFn(`💤 ${pokemon.name} ${sd.wakeMsg || 'se despertó!'}`, 'boost');
                return true; // se despertó este turno, puede moverse
            }
            logFn(`💤 ${(sd.blockMsg || '{pokemon} está dormido.').replace('{pokemon}', pokemon.name)}`, '');
            return false;
        }

        case 'freeze': {
            const thawChance = sd.thawChance || 20;
            if (Math.random() * 100 < thawChance) {
                pokemon.status = null;
                logFn(`🧊 ${pokemon.name} ${sd.thawMsg || 'se descongeló!'}`, 'boost');
                return true; // se descongeló, puede actuar
            }
            logFn(`🧊 ${(sd.blockMsg || '{pokemon} está congelado.').replace('{pokemon}', pokemon.name)}`, '');
            return false;
        }

        case 'paralysis': {
            const blockChance = sd.blockChance || 25;
            if (Math.random() * 100 < blockChance) {
                logFn(`⚡ ${(sd.blockMsg || '{pokemon} está paralizado.').replace('{pokemon}', pokemon.name)}`, '');
                return false;
            }
            return true;
        }

        default:
            return true;
    }
}

// ─── DAÑO POR ROCAS SIGILOSAS ─────────────────────────────────────────────────
function applyStealthRockDamage(pokemon, side) {
    // Determinar si hay Rocas Sigilosas en el campo donde entra el Pokémon
    const hasStealthRock = side === 'player' ? fieldState.playerSide.stealthRock : fieldState.enemySide.stealthRock;
    
    if (!hasStealthRock) return; // No hay Rocas Sigilosas
    
    // Calcular efectividad del tipo ROCA contra los tipos del Pokémon
    const effectiveness = calculateEffectiveness('ROCA', pokemon.types);
    
    // Calcular daño basado en debilidad/resistencia (tabla del usuario)
    let damagePercent = 0;
    if (effectiveness >= 4)      damagePercent = 0.50;    // x4 debilidad
    else if (effectiveness >= 2) damagePercent = 0.25;    // x2 debilidad
    else if (effectiveness >= 1) damagePercent = 0.125;   // x1 (neutral)
    else if (effectiveness >= 0.5) damagePercent = 0.0625; // x1/2 resistencia
    else if (effectiveness > 0)  damagePercent = 0.03125; // x1/4 resistencia
    else                         return;                  // Inmune (effectiveness === 0)
    
    const dmg = Math.max(1, Math.floor(pokemon.stats.hp * damagePercent));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
    
    if (pokemon.currentHp <= 0) pokemon.fainted = true;
    
    // Log del daño
    let effMsg = '';
    if (effectiveness > 1)      effMsg = '💥 ¡Es súper efectivo!';
    else if (effectiveness < 1 && effectiveness > 0) effMsg = '💨 No es muy efectivo...';
    
    addLog(`🪨 ${pokemon.name} toma daño de las Rocas Sigilosas: ${dmg} HP`, 'damage');
    if (effMsg) addLog(effMsg, 'important');
}

// ─── EJECUTAR UN ATAQUE ───────────────────────────────────────────────────────
function executeAttack(attacker, defender, moveName, side, callback) {
    const move    = getMoveInfo(moveName);
    const defSide = side === 'player' ? 'enemy' : 'player';

    // ── Chequeo de estado: ¿puede moverse? ───────────────────────────────
    if (!checkStatusBlock(attacker, (msg, type) => addLog(msg, type))) {
        updateUI(); // actualizar badge de estado (ej. si se descongeló)
        setTimeout(callback, 600);
        return;
    }

    addLog(`${side==='player'?'▶️':'◀️'} ${attacker.name} usa <b>${moveName}</b>`, side==='player'?'important':'');

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

    const isPhysical    = move.category === 'physical';
    const effectiveness = calculateEffectiveness(move.type, defender.types);
    let   dmg           = calculateDamage(attacker, defender, moveName);

    // ── Cinta Focus ───────────────────────────────────────────────────────
    if (defender.currentHp - dmg <= 0 && !defender.itemUsed
        && defender.item === 'Cinta Focus' && defender.currentHp === defender.stats.hp) {
        defender.currentHp = 1;
        defender.itemUsed  = true;
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
    if (effectiveness > 1)             addLog('💥 ¡Es súper efectivo!', 'important');
    if (effectiveness < 1 && effectiveness > 0) addLog('💨 No es muy efectivo...', '');
    if (effectiveness === 0)           addLog('❌ No tiene efecto', '');
    addLog(`💔 ${Math.floor(dmg)} de daño a ${defender.name}`, 'damage');

    // ── Efectos especiales de movimientos de daño ─────────────────────────
    
    // RECOIL EFFECTS
    if (move.effect === 'recoil_33') {
        const r = Math.floor(dmg * 0.33);
        attacker.currentHp = Math.max(0, attacker.currentHp - r);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        addLog(`⚡ ${attacker.name} recibe ${r} de retroceso`, 'damage');
        if (side === 'enemy') revealEnemyStat('item', attacker);
        else revealPlayerStat('item', attacker);
    }
    
    // RECOIL_50: El atacante recibe 50% del daño infligido como retroceso
    if (move.effect === 'drain_50_remaining') {  // Nombre de efecto ajustado para claridad
    const dmg = Math.floor(defender.currentHp * 0.50);  // 50% del HP restante del rival
    defender.currentHp = Math.max(0, defender.currentHp - dmg);
    if (defender.currentHp <= 0) defender.fainted = true;
    addLog(`⚡ ${defender.name} pierde ${dmg} de vida (50% restante)`, 'damage');
    // Opcional: revelar stats, etc.
}
    
    // RECOIL_50_MISS: Si el movimiento falló (misses), el atacante pierde 50% HP
    if (move.effect === 'recoil_50_miss' && effectiveness === 0) {
        const r = Math.floor(attacker.stats.hp * 0.5);
        attacker.currentHp = Math.max(0, attacker.currentHp - r);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        addLog(`⚡ ${attacker.name} pierde ${r} HP por el contraataque`, 'damage');
    }
    
    // MULTI_HIT: Repetir el ataque 2-5 veces (simplificado: 3 veces)
    if (move.effect === 'multi_hit' && !defender.fainted) {
        const hitCount = 2 + Math.floor(Math.random() * 4); // 2-5 golpes
        for (let i = 0; i < hitCount - 1; i++) {
            const dmg2 = Math.floor(dmg * 0.6); // Reducir daño por golpe adicional
            defender.currentHp = Math.max(0, defender.currentHp - dmg2);
            addLog(`💥 Golpe ${i+2}: ${Math.floor(dmg2)} de daño a ${defender.name}`, 'damage');
            if (defender.currentHp <= 0) { defender.fainted = true; break; }
        }
    }
    
    // EXPLODE_DAMAGE (Supernova): Atacante pierde 50% max HP después de atacar
    if (move.effect === 'explode_damage') {
        const debilitation = Math.floor(attacker.stats.hp * 0.5);
        attacker.currentHp = Math.max(0, attacker.currentHp - debilitation);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        else addLog(`💥 ¡${attacker.name} se debilitó parcialmente por el contraataque!`, 'damage');
    }
    
    // FREEZE_CONFUSE_RECOIL (Froglare Bash): 20% congelación O confusión + 33% recoil
    if (move.effect === 'freeze_confuse_recoil' && !defender.fainted) {
        if (Math.random() * 100 < 20) {
            const choice = Math.random() > 0.5;
            if (choice && !defender.status && !isImmuneToStatus(defender, 'freeze')) {
                defender.status = 'freeze';
                addLog(`❄️ ${defender.name} quedó congelado`, 'boost');
            } else if (!choice && !defender.status && !isImmuneToStatus(defender, 'confuse')) {
                defender.status = 'confuse';
                addLog(`😵 ${defender.name} quedó confundido`, 'boost');
            }
        }
        const r = Math.floor(dmg * 0.33);
        attacker.currentHp = Math.max(0, attacker.currentHp - r);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        addLog(`⚡ ${attacker.name} recibe ${r} de retroceso`, 'damage');
    }
    
    // BREAK_SCREENS (Stalactbite): Destruye Reflect y Light Screen del lado del defensor
    if (move.effect === 'break_screens' && !defender.fainted) {
        // Aquí necesitarías un sistema de campo/pantalla implementado
        // Por ahora, solo log
        addLog(`⚔️ ${attacker.name} rompió las pantallas defensivas`, 'damage');
    }
    
    // DARK_EFFECTIVE (Harmful Strike): Potencia oscura extra (x1.3 daño)
    if (move.effect === 'dark_effective') {
        // Ya está incluido en el daño base, pero añadimos log
        addLog(`🌑 ¡Ataque oscuro potenciado!`, 'boost');
    }
    
    // SUPER_WATER (Grease Fire): Super efectivo contra tipo Agua
    if (move.effect === 'super_water') {
        addLog(`💥 ¡Super efectivo contra tipos Agua!`, 'boost');
    }
    
    // SUPER_STEEL (Biorrosion): Super efectivo contra tipo Acero
    if (move.effect === 'super_steel') {
        addLog(`💥 ¡Super efectivo contra tipos Acero!`, 'boost');
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
        const sk     = move.effect.replace('apply_', '');
        const chance = move.effectChance || 0;
        if (!defender.status && !isImmuneToStatus(defender, sk) && Math.random() * 100 < chance) {
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
        defender.itemUsed  = true;
        addLog(`🍓 ¡Baya Zidra restauró ${h} HP a ${defender.name}!`, 'heal');
    }

    animHit(defSide);
    updateUI();

    if (defender.fainted) { setTimeout(() => handleFaint(defSide, callback), 600); return; }
    if (attacker.fainted) { setTimeout(() => handleFaint(side, callback), 600);    return; }
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
        user.status    = 'sleep';
        addLog(`💚 ${user.name} se durmió y recuperó todo el HP`, 'heal');
        return;
    }
    if (move.effect === 'boost_atk_spe') {
        user.statBoosts.atk = Math.min(6, (user.statBoosts.atk||0)+1);
        user.statBoosts.spe = Math.min(6, (user.statBoosts.spe||0)+1);
        addLog(`⬆️ ${user.name}: ↑ ATK y ↑ SPE`, 'boost');
        return;
    }
    if (move.effect === 'boost_spe') {
        user.statBoosts.spe = Math.min(6, (user.statBoosts.spe||0)+1);
        addLog(`⬆️ ${user.name}: ↑ SPE`, 'boost');
        return;
    }
    if (move.effect === 'protect') {
        user.protected = true;
        addLog(`🛡️ ${user.name} se protege este turno`, 'boost');
        return;
    }
    
    // ─────── NUEVOS EFECTOS DE MOVIMIENTOS DE ESTADO ────────────────────────
    
    // HEALING_SPA_DOUBLE (Healing Spa): Cura todos los estados del usuario y aliados
    if (move.effect === 'heal_status_double') {
        user.status = null;
        user.currentHp = Math.min(user.currentHp + Math.floor(user.stats.hp * 0.5), user.stats.hp);
        addLog(`💚 ¡${user.name} se recuperó completamente de sus estados!`, 'heal');
        return;
    }
    
    // PETRIFY_HEAL (Scorch Claw): Paraliza al oponente Y cura al usuario 25%
    if (move.effect === 'petrify_heal') {
        if (!target.status && !isImmuneToStatus(target, 'paralysis')) {
            target.status = 'paralysis';
            addLog(`⚡ ${target.name} quedó paralizado`, 'boost');
        }
        const h = Math.floor(user.stats.hp * 0.25);
        user.currentHp = Math.min(user.currentHp + h, user.stats.hp);
        addLog(`💚 ${user.name} recuperó ${h} HP`, 'heal');
        return;
    }
    
    // LOWER_ATK (Rowdy Tussle): Reduce ATK del oponente -1
    if (move.effect === 'lower_atk') {
        target.statBoosts.atk = Math.max(-6, (target.statBoosts.atk||0)-1);
        addLog(`⬇️ ATK de ${target.name} bajó`, 'boost');
        return;
    }
    
    // LOWER_ATK_30: 30% chance reducir ATK -1
    if (move.effect === 'lower_atk_30') {
        if (Math.random() * 100 < 30) {
            target.statBoosts.atk = Math.max(-6, (target.statBoosts.atk||0)-1);
            addLog(`⬇️ ATK de ${target.name} bajó`, 'boost');
        }
        return;
    }
    
    // LOWER_SPA (Shortcut): Reduce SpA del oponente -1
    if (move.effect === 'lower_spa') {
        target.statBoosts.spa = Math.max(-6, (target.statBoosts.spa||0)-1);
        addLog(`⬇️ SpA de ${target.name} bajó`, 'boost');
        return;
    }
    
    // LOWER_DEF (Gatling Slug) / LOWER_DEFENSES: Reduce DEF -1
    if (move.effect === 'lower_def' || move.effect === 'lower_defenses') {
        target.statBoosts.def = Math.max(-6, (target.statBoosts.def||0)-1);
        addLog(`⬇️ DEF de ${target.name} bajó`, 'boost');
        return;
    }
    
    // SWITCH_BURN (Bridge Burn): Fuerza cambio al usuario y quema al próximo Pokémon
    if (move.effect === 'switch_burn') {
        if (!target.status && !isImmuneToStatus(target, 'burn')) {
            target.status = 'burn';
            addLog(`🔥 ${target.name} quedó quemado`, 'boost');
        }
        if (user.fainted) return;
        switchForced = true;
        isBusy = false;
        openSwitch(true); // Fuerza cambio al usuario
        addLog(`🔄 ${user.name} debe ser reemplazado`, 'important');
        return;
    }
    
    // SWITCH_AFTER_HIT (Landscape): Después del golpe, fuerza cambio al usuario
    if (move.effect === 'switch_after_hit') {
        // Este efecto se ejecuta después del daño en executeAttack
        if (user.fainted) return;
        switchForced = true;
        isBusy = false;
        openSwitch(true);
        addLog(`🔄 ${user.name} debe ser reemplazado`, 'important');
        return;
    }
    
    // SWITCH_PETRIFY_HEAL (Armored Up): Cambio + paraliza al próximo oponente + cura
    if (move.effect === 'switch_petrify_heal') {
        if (!target.status && !isImmuneToStatus(target, 'paralysis')) {
            target.status = 'paralysis';
            addLog(`⚡ ${target.name} quedó paralizado`, 'boost');
        }
        const h = Math.floor(user.stats.hp * 0.25);
        user.currentHp = Math.min(user.currentHp + h, user.stats.hp);
        addLog(`💚 ${user.name} recuperó ${h} HP`, 'heal');
        if (user.fainted) return;
        switchForced = true;
        isBusy = false;
        openSwitch(true);
        return;
    }
    
    // INVERT_STATS_ROOM (Guard Room): Invierte todos los boosts de stats por 5 turnos
    if (move.effect === 'invert_stats_room') {
        // Guardar estado actual
        user.invertedStats = {
            atk: -(user.statBoosts.atk||0),
            def: -(user.statBoosts.def||0),
            spa: -(user.statBoosts.spa||0),
            spd: -(user.statBoosts.spd||0),
            spe: -(user.statBoosts.spe||0)
        };
        user.invertStatsCounter = 5;
        addLog(`🔄 ¡Todos los stats de ${user.name} se invirtieron!`, 'boost');
        return;
    }
    
    // CHARGE_CLIMB (Rock Climb): Primer turno sube SPE +2, segundo turno ataca
    if (move.effect === 'charge_climb') {
        user.statBoosts.spe = Math.min(6, (user.statBoosts.spe||0)+2);
        user.charging = 'rock_climb';
        addLog(`⬆️ ${user.name} se prepara para escalar (SPE +2)`, 'boost');
        addLog(`⏳ Siguiente turno atacará`, 'boost');
        return;
    }
    
    // FORCE_SELF_HIT (Possession): Obliga al oponente a atacarse a sí mismo
    if (move.effect === 'force_self_hit') {
        target.forcedSelfHit = true;
        target.forcedSelfHitCounter = 1;
        addLog(`👻 ¡${target.name} está poseído!`, 'boost');
        return;
    }
    
    // BOOST_ALLY_RANDOM (Cultivation): Sube un stat aleatorio del aliado +1
    if (move.effect === 'boost_ally_random') {
        const stats = ['atk', 'def', 'spa', 'spd', 'spe'];
        const randomStat = stats[Math.floor(Math.random() * stats.length)];
        user.statBoosts[randomStat] = Math.min(6, (user.statBoosts[randomStat]||0)+1);
        const statNames = {atk:'ATK', def:'DEF', spa:'SpA', spd:'SpD', spe:'SPE'};
        addLog(`⬆️ ${user.name}: ↑ ${statNames[randomStat]}`, 'boost');
        return;
    }
    
    // TOXIC_SPIKES (Rusted Edge): Pone púa tóxica (daño pasivo aumenta cada turno)
    if (move.effect === 'toxic_spikes') {
        target.toxicSpikes = true;
        target.toxicCounter = 1;
        addLog(`☠️ ${target.name} está envenenado por púas tóxicas`, 'damag');
        return;
    }
    
    // POWER_HAZARDS (Seismic Wave): Aumenta daño si hay púas/terreno desfavorable
    if (move.effect === 'power_hazards') {
        const boost = (target.toxicSpikes ? 1.5 : 1);
        addLog(`💥 ${user.name} aprovecha el terreno desfavorable (x${boost})`, 'boost');
        return;
    }
    
    // HASTING_BOOST_CONFUSE (Hasting): Sube SPE del oponente +2 pero confunde
    if (move.effect === 'boost_speed_confuse') {
        target.statBoosts.spe = Math.min(6, (target.statBoosts.spe||0)+2);
        if (!target.status && !isImmuneToStatus(target, 'confuse')) {
            target.status = 'confuse';
            addLog(`😵 ${target.name} quedó confundido`, 'boost');
        }
        addLog(`⬆️ ${target.name}: ↑ SPE (¡pero está confundido!)`, 'boost');
        return;
    }
    
    // SUPER_WATER (Grease Fire): Super efectivo contra tipo Agua
    if (move.effect === 'super_water') {
        addLog(`💥 ¡Super efectivo contra tipos Agua!`, 'boost');
        return;
    }
    
    // SUPER_STEEL (Biorrosion): Super efectivo contra tipo Acero
    if (move.effect === 'super_steel') {
        addLog(`💥 ¡Super efectivo contra tipos Acero!`, 'boost');
        return;
    }
    
    // DARK_EFFECTIVE (Harmful Strike): Aumenta efectividad contra tipos Psíquico
    if (move.effect === 'dark_effective') {
        addLog(`💥 ¡Movimiento oscuro muy potente!`, 'boost');
        return;
    }
    
    // POWER_LOW_HP (Frenzy Jungle): Más poder si el usuario tiene HP bajo
    if (move.effect === 'power_low_hp') {
        const hpRatio = user.currentHp / user.stats.hp;
        const boostMsg = hpRatio < 0.33 ? '💪 Triple poder' : hpRatio < 0.66 ? '💪 Doble poder' : '💪 Poder normal';
        addLog(boostMsg, 'boost');
        return;
    }
    
    // STEELY_HAZARD (Steely Spikes): Pone púa de acero (daño a cambios)
    if (move.effect === 'steely_hazard') {
        target.steelySpikes = true;
        addLog(`⚔️ ${target.name} está bajo púa de acero`, 'damage');
        return;
    }
    
    // STEALTH_ROCK: Coloca rocas sigilosas en el campo del rival
    if (move.effect === 'stealth_rock') {
        const defSide = user === playerTeam[playerActive] ? 'enemy' : 'player';
        const stealthRockActive = defSide === 'enemy' ? fieldState.enemySide.stealthRock : fieldState.playerSide.stealthRock;
        
        // Si ya hay rocas sigilosas, falla automáticamente
        if (stealthRockActive) {
            addLog(`❌ ¡Ya hay Rocas Sigilosas en el campo!`, 'important');
            return;
        }
        
        // Colocar rocas y animar
        if (defSide === 'enemy') {
            fieldState.enemySide.stealthRock = true;
            addLog(`🪨 ¡${user.name} colocó Rocas Sigilosas en el campo del rival!`, 'important');
            animateStealthRock('enemy');
        } else {
            fieldState.playerSide.stealthRock = true;
            addLog(`🪨 ¡${user.name} colocó Rocas Sigilosas en el campo!`, 'important');
            animateStealthRock('player');
        }
        return;
    }
    
    // BLOSSOM_NEVER_MISS_HEAL (Blossom Needle): Cura estado del usuario + nunca falla
    if (move.effect === 'heal_cure_never_miss') {
        user.status = null;
        const h = Math.floor(user.stats.hp * 0.25);
        user.currentHp = Math.min(user.currentHp + h, user.stats.hp);
        addLog(`🌸 ${user.name} se curó completamente (${h} HP)`, 'heal');
        return;
    }
    
    // ANTLER_SHED_BOOST (Antler Shed): Usuario pierde 1/3 PS, cambia y sube ATK
    if (move.effect === 'shed_switch_boost') {
        user.statBoosts.atk = Math.min(6, (user.statBoosts.atk||0)+2);
        const lossHp = Math.floor(user.stats.hp / 3);
        user.currentHp = Math.max(0, user.currentHp - lossHp);
        if (user.currentHp <= 0) user.fainted = true;
        else {
            addLog(`💔 ${user.name} perdió ${lossHp} HP`, 'damage');
            switchForced = true;
            isBusy = false;
            openSwitch(true);
        }
        return;
    }
    
    // GRAVITAS_GRAVITY (Gravitas Clasp): Invoca gravedad (reduce velocidades durante 3 turnos)
    if (move.effect === 'gravity_field') {
        user.gravityTurns = 3;
        target.gravityTurns = 3;
        addLog(`⬇️ ¡La gravedad entra en juego! (3 turnos)`, 'boost');
        return;
    }
    
    // PARALYSIS_LOWER_SPA (Powder Bomb): Paraliza + reduce SpA -1
    if (move.effect === 'paralysis_lower_spa') {
        if (!target.status && !isImmuneToStatus(target, 'paralysis')) {
            target.status = 'paralysis';
            addLog(`⚡ ${target.name} quedó paralizado`, 'boost');
        }
        target.statBoosts.spa = Math.max(-6, (target.statBoosts.spa||0)-1);
        addLog(`⬇️ SpA de ${target.name} bajó`, 'boost');
        return;
    }

    if (move.effect?.startsWith('apply_')) {
        const sk = move.effect.replace('apply_', '');
        if (move.accuracy !== null && Math.random()*100 > (move.accuracy||100)) {
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
        { p: enemyTeam[enemyActive]   },
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
    if (eFainted) { handleFaint('enemy',  () => { isBusy = false; renderMoves(); }); return; }
    if (pFainted) { handleFaint('player', () => {}); return; }
    if (playerTeam.every(p => p.fainted)) { endBattle(false); return; }
    if (enemyTeam.every(p => p.fainted))  { endBattle(true);  return; }

    isBusy = false;
    renderMoves();
}

// ─── DEBILITAMIENTO ───────────────────────────────────────────────────────────
function handleFaint(side, callback) {
    const team    = side === 'player' ? playerTeam : enemyTeam;
    const active  = side === 'player' ? playerActive : enemyActive;
    addLog(`😵 ¡${team[active].name} se debilitó!`, 'important');
    animFaint(side);

    if (team.every(p => p.fainted)) {
        setTimeout(() => endBattle(side === 'enemy'), 1200);
        return;
    }
    setTimeout(() => {
        if (side === 'enemy') {
            enemyActive = enemyTeam.findIndex(p => !p.fainted);
            const newEnemy = enemyTeam[enemyActive];
            addLog(`🔄 ¡El rival envió a ${newEnemy.name}!`, 'important');
            // Habilidad on_switch_in del rival
            applyAbilitySwitchIn(newEnemy, playerTeam[playerActive], (msg, t) => { addLog(msg, t); if (msg) revealEnemyStat('ability', newEnemy); });
            
            // Aplicar daño de Rocas Sigilosas si están presentes
            applyStealthRockDamage(newEnemy, 'enemy');
            updateUI();
            if (callback) callback();
        } else {
            switchForced = true;
            isBusy = false;
            openSwitch(true);
        }
    }, 1000);
}

// ─── CAMBIO DE POKÉMON ────────────────────────────────────────────────────────
function openSwitch(forced = false) {
    switchForced = forced;
    const available = playerTeam.map((p,i) => ({p,i})).filter(o => !o.p.fainted && o.i !== playerActive);
    if (!available.length) { addLog('⚠️ No hay Pokémon disponibles', ''); return; }

    const titleEl = document.getElementById('switchTitle');
    if (titleEl) titleEl.textContent = forced ? '¡DEBES ELEGIR UN POKÉMON!' : 'SELECCIONA UN POKÉMON';
    document.getElementById('switchModal').classList.add('open');

    const grid = document.getElementById('switchGrid');
    grid.innerHTML = '';
    available.forEach(({ p, i }) => {
        const hpPct = (p.currentHp / p.stats.hp) * 100;
        const col   = hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#eab308' : '#ef4444';
        const sprite = getSpriteUrl(p.id, 'front');
        const ab     = AbilitiesDB[p.ability];
        const card   = document.createElement('div');
        card.className = 'switch-card';
        card.innerHTML = `
            <img src="${sprite}" onerror="onSpriteError(this,p.id)">
            <div class="switch-card-name">${p.name}</div>
            <div style="font-size:6px;color:#94a3b8;margin-bottom:2px;">${ab ? ab.icon+' '+ab.name : ''}</div>
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
    playerActive  = newIndex;
    const newPoke = playerTeam[playerActive];

    document.getElementById('switchModal').classList.remove('open');
    addLog('━━━━━━━━━━━━━━', 'separator');
    addLog(`🔄 ${oldName} regresa. ¡Adelante, ${newPoke.name}!`, 'important');

    // Habilidad on_switch_in del nuevo Pokémon
    applyAbilitySwitchIn(newPoke, enemyTeam[enemyActive], (msg, t) => addLog(msg, t));

    // Aplicar daño de Rocas Sigilosas si están presentes
    applyStealthRockDamage(newPoke, 'player');
    updateUI();

    if (newPoke.fainted) {
        addLog(`😵 ¡${newPoke.name} se debilitó!`, 'important');
        handleFaint('player', () => {});
        return;
    }

    renderMoves();

    if (!switchForced) {
        isBusy = true;
        disableMoves();
        const enemy = enemyTeam[enemyActive];
        const emIdx = chooseEnemyMove(enemy, newPoke);
        setTimeout(() => executeAttack(enemy, newPoke, enemy.moves[emIdx], 'enemy', () => afterTurn()), 800);
    } else {
        switchForced = false;
        isBusy       = false;
    }
}

// ─── FIN DE BATALLA ───────────────────────────────────────────────────────────
function endBattle(playerWon) {
    battleOver = true;
    isBusy     = true;
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
    endBattle(false);
}
