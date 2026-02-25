// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/training-mode.js  —  MODO ENTRENAMIENTO (SACO DE BOXEO)             ║
// ║                                                                          ║
// ║  Permite probar movimientos contra un saco configurable sin combate real.║
// ║  El saco tiene HP, tipo y DEF/SpDef personalizables.                    ║
// ║  No afecta al combate actual.                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

let trainingPokeIndex = 0;   // Índice del Pokémon activo en training
let dummyCurrentHp    = 1000;
let dummyInfiniteHp   = false;
let trainingTotalDmg  = 0;
let trainingHits      = 0;

// ─── ABRIR / CERRAR ──────────────────────────────────────────────────────────
function openTrainingMode() {
    trainingPokeIndex = playerActive;
    resetDummy();
    renderTrainerPokeRow();
    renderTrainingMoves();
    clearTrainingLog();
    tLog('← Haz clic en un movimiento para testear', 'tlog-entry');
    document.getElementById('trainingModal').classList.add('open');
}

function closeTrainingMode() {
    document.getElementById('trainingModal').classList.remove('open');
}

// ─── POKÉMON SELECTOR ────────────────────────────────────────────────────────
function renderTrainerPokeRow() {
    const row = document.getElementById('trainerPokeRow');
    if (!row) return;
    row.innerHTML = playerTeam.map((p, i) => {
        const sprite = getSpriteUrl(p.id, 'front');
        const faded  = p.fainted ? 'style="opacity:.3"' : '';
        return `
            <div class="trainer-poke-btn ${i === trainingPokeIndex ? 'active' : ''}"
                 onclick="selectTrainingPoke(${i})" ${faded}>
                <img src="${sprite}" alt="${p.name}"
                     onerror="onSpriteError(this, p.id)">
                ${p.name}
            </div>
        `;
    }).join('');
}

function selectTrainingPoke(index) {
    trainingPokeIndex = index;
    renderTrainerPokeRow();
    renderTrainingMoves();
    tLog('━━━━━━━━━━━━━━', 'tlog-sep');
    tLog(`→ Cambiando a ${playerTeam[index].name}`, 'tlog-entry');
}

// ─── MOVIMIENTOS EN TRAINING ─────────────────────────────────────────────────
function renderTrainingMoves() {
    const grid = document.getElementById('trainingMovesGrid');
    if (!grid) return;
    const pokemon = playerTeam[trainingPokeIndex];
    grid.innerHTML = pokemon.moves.map((moveName, idx) => {
        const move      = getMoveInfo(moveName);
        const typeClass = `mv-${move.type.replace(/[ÉÍÓÚ]/g, c => ({'É':'E','Í':'I','Ó':'O','Ú':'U'}[c]))}`;
        const cat       = move.category === 'physical' ? 'FÍS' : move.category === 'status' ? 'EST' : 'ESP';
        return `
            <button class="training-move-btn ${typeClass}" onclick="trainingAttack(${idx})">
                <div style="font-size:8px;font-weight:bold;margin-bottom:2px;">${moveName}</div>
                <div style="font-size:6px;opacity:0.7;">${move.type} • ${cat} • POW:${move.power||'─'}</div>
                ${move.description ? `<div style="font-size:5.5px;opacity:0.5;margin-top:2px;">${move.description}</div>` : ''}
            </button>
        `;
    }).join('');
}

// ─── ATAQUE AL SACO ───────────────────────────────────────────────────────────
function trainingAttack(moveIndex) {
    const attacker  = playerTeam[trainingPokeIndex];
    const moveName  = attacker.moves[moveIndex];
    const move      = getMoveInfo(moveName);

    // Construir un saco ficticio con los valores de los inputs
    const dummyTypes = [
        document.getElementById('dummyType1').value,
        document.getElementById('dummyType2').value,
    ].filter(t => t !== '');

    const dummyDefStat = parseInt(document.getElementById('dummyDef').value) || 80;
    const dummySpdStat = parseInt(document.getElementById('dummySpd').value) || 80;

    const dummy = {
        name:       'Saco',
        types:      dummyTypes,
        stats:      { hp: parseInt(document.getElementById('dummyMaxHp').value) || 1000, def: dummyDefStat, spd: dummySpdStat },
        currentHp:  dummyCurrentHp,
        item:       'Ninguno',
        itemUsed:   false,
        nature:     'Seria',
        ability:    null,
        status:     null,
        statBoosts: { atk:0, def:0, spa:0, spd:0, spe:0 },
        fainted:    false,
    };

    // Movimiento de estado: no hace daño
    if (move.category === 'status' || move.power === 0) {
        tLog(`━━━━━━━━━━━━━━`, 'tlog-sep');
        tLog(`${moveName} → Movimiento de estado (no causa daño)`, 'tlog-entry');
        punchDummy();
        return;
    }

    // Calcular efectividad
    const effectiveness = calculateEffectiveness(move.type, dummyTypes);

    // Calcular daño con la misma fórmula del combate
    const isPhysical = move.category === 'physical';
    const aStats     = getModifiedStats(attacker);
    const atk        = isPhysical ? aStats.atk : aStats.spa;
    const def        = isPhysical ? dummyDefStat : dummySpdStat;

    // Base damage
    let baseDmg = ((2 * 100 / 5 + 2) * move.power * (atk / def)) / 50 + 2;

    // STAB
    let stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const atkAb = AbilitiesDB[attacker.ability];
    if (atkAb?.effect === 'boost_same_type' && attacker.types.includes(move.type)) stab = atkAb.value;

    // Habilidad ofensiva
    let abilityMult = 1;
    if (atkAb?.trigger === 'on_attack') {
        if (atkAb.effect === 'boost_type_atk' && move.type === atkAb.boostedType) abilityMult = atkAb.value;
        if (atkAb.effect === 'crit_boost')      abilityMult = atkAb.value;
        if (atkAb.effect === 'boost_contact_moves' && isPhysical) abilityMult = atkAb.value;
        if (atkAb.effect === 'boost_type_low_hp' && move.type === atkAb.boostedType) {
            if ((attacker.currentHp / attacker.stats.hp) <= (atkAb.threshold||0.33)) abilityMult = atkAb.value;
        }
        if (atkAb.effect === 'brute_force') abilityMult = atkAb.value;
    }

    // Quemadura
    const burnMult = (attacker.status === 'burn' && isPhysical && atkAb?.effect !== 'counter_burn') ? 0.5 : 1;

    // Rango de daño (min 85%, max 100%)
    const minDmg = Math.max(1, Math.floor(baseDmg * stab * effectiveness * abilityMult * burnMult * getItemTypeBoost(attacker, move.type) * 0.85));
    const maxDmg = Math.max(1, Math.floor(baseDmg * stab * effectiveness * abilityMult * burnMult * getItemTypeBoost(attacker, move.type) * 1.00));
    // Daño real con factor aleatorio
    const realDmg = Math.max(1, Math.floor(baseDmg * stab * effectiveness * abilityMult * burnMult * getItemTypeBoost(attacker, move.type) * (0.85 + Math.random() * 0.15)));

    // Aplicar al saco
    if (!dummyInfiniteHp) {
        dummyCurrentHp = Math.max(0, dummyCurrentHp - realDmg);
        updateDummyHpBar();
    }

    trainingTotalDmg += realDmg;
    trainingHits++;

    // Animación saco
    punchDummy();

    // Popup de daño flotante
    showDamagePopup(realDmg, effectiveness);

    // Log detallado
    const dummyMaxHp = parseInt(document.getElementById('dummyMaxHp').value) || 1000;
    const hpPct = ((realDmg / dummyMaxHp) * 100).toFixed(1);
    const effStr = effectiveness > 1 ? '¡SÚPER EFICAZ! ×' + effectiveness : effectiveness < 1 && effectiveness > 0 ? 'poco eficaz ×' + effectiveness : effectiveness === 0 ? 'SIN EFECTO' : '';
    const effClass = effectiveness > 1 ? 'tlog-super' : effectiveness < 1 ? 'tlog-weak' : '';

    tLog('━━━━━━━━━━━━━━', 'tlog-sep');
    tLog(`⚔️ ${attacker.name} → ${moveName}`, 'tlog-entry');
    if (effStr) tLog(`   Efectividad: ${effStr}`, effClass);
    tLog(`   Daño real: ${realDmg} HP (${hpPct}% del saco)`, 'tlog-damage');
    tLog(`   Rango: ${minDmg}–${maxDmg} HP`, 'tlog-entry');
    tLog(`   [ATK:${atk} vs DEF:${def} · POW:${move.power} · STAB:${stab>1?'Sí':'No'} · AB:${abilityMult}x]`, 'tlog-entry');
    tLog(`   Acumulado: ${trainingTotalDmg} dmg en ${trainingHits} golpe${trainingHits!==1?'s':''}`, 'tlog-entry');

    if (dummyCurrentHp <= 0 && !dummyInfiniteHp) {
        tLog(`🏆 ¡SACO DESTRUIDO en ${trainingHits} golpes!`, 'tlog-super');
    }
}

// ─── HP BAR DEL SACO ─────────────────────────────────────────────────────────
function updateDummyHpBar() {
    const maxHp  = parseInt(document.getElementById('dummyMaxHp').value) || 1000;
    const pct    = Math.max(0, (dummyCurrentHp / maxHp) * 100);
    const fill   = document.getElementById('dummyHpFill');
    const label  = document.getElementById('dummyHpLabel');
    if (fill)  {
        fill.style.width = pct + '%';
        fill.className   = 'dummy-hp-fill' + (pct < 25 ? ' low' : '');
    }
    if (label) label.textContent = `${Math.max(0, Math.floor(dummyCurrentHp))} / ${maxHp} HP`;
}

function resetDummy() {
    const maxHp    = parseInt(document.getElementById('dummyMaxHp').value) || 1000;
    dummyCurrentHp = maxHp;
    trainingTotalDmg = 0;
    trainingHits     = 0;
    updateDummyHpBar();
}

function toggleInfiniteHp() {
    dummyInfiniteHp = !dummyInfiniteHp;
    const btn = document.getElementById('infiniteToggle');
    if (btn) {
        btn.textContent = `∞ HP infinito: ${dummyInfiniteHp ? 'ON' : 'OFF'}`;
        btn.className   = 'dummy-infinite-toggle' + (dummyInfiniteHp ? ' on' : '');
    }
    if (dummyInfiniteHp) resetDummy();
}

// ─── ANIMACIÓN DEL SACO ───────────────────────────────────────────────────────
function punchDummy() {
    const sprite = document.getElementById('dummySprite');
    if (!sprite) return;
    sprite.classList.add('punched');
    setTimeout(() => sprite.classList.remove('punched'), 350);
}

// ─── POPUP DE DAÑO ───────────────────────────────────────────────────────────
function showDamagePopup(dmg, effectiveness) {
    const el = document.createElement('div');
    el.className   = 'damage-popup';
    el.textContent = (effectiveness > 1 ? '💥 ' : '') + '-' + dmg;
    el.style.color = effectiveness > 1 ? '#86efac' : effectiveness < 1 ? '#94a3b8' : '#fbbf24';

    // Posición cerca del saco
    const dummyEl = document.getElementById('dummySprite');
    const rect    = dummyEl ? dummyEl.getBoundingClientRect() : { left: 200, top: 300 };
    el.style.left = (rect.left + 20 + Math.random() * 30) + 'px';
    el.style.top  = (rect.top  - 10) + 'px';

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
}

// ─── LOG DEL ENTRENAMIENTO ────────────────────────────────────────────────────
function tLog(msg, className = 'tlog-entry') {
    const log = document.getElementById('trainingLog');
    if (!log) return;
    const el = document.createElement('div');
    el.className   = className;
    el.textContent = msg;
    log.appendChild(el);
    log.scrollTop  = log.scrollHeight;
    const entries  = log.querySelectorAll('div');
    if (entries.length > 80) entries[0].remove();
}

function clearTrainingLog() {
    const log = document.getElementById('trainingLog');
    if (log) log.innerHTML = '';
    trainingTotalDmg = 0;
    trainingHits     = 0;
}
