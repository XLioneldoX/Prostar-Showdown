// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  js/ui-battle.js  —  INTERFAZ DE BATALLA                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function updateUI() {
    const player = playerTeam[playerActive];
    const enemy  = enemyTeam[enemyActive];
    const pSp = document.getElementById('playerSprite');
    const eSp = document.getElementById('enemySprite');
    if (pSp) { pSp.src = getSpriteUrl(player.id, 'back');  pSp.onerror = () => onSpriteError(pSp, player.id); }
    if (eSp) { eSp.src = getSpriteUrl(enemy.id,  'front'); eSp.onerror = () => onSpriteError(eSp, enemy.id); }
    updatePokemonCard('player', player);
    updatePokemonCard('enemy',  enemy);
    updateTeamMinis();
}

// ─── TARJETA DE POKÉMON ───────────────────────────────────────────────────────
function updatePokemonCard(side, pokemon) {
    const isEnemy = side === 'enemy';

    const nameEl = document.getElementById(`${side}Name`);
    if (nameEl) nameEl.textContent = pokemon.name;

    // Estado
    const statusEl = document.getElementById(`${side}Status`);
    if (statusEl) {
        const sd = StatusDB[pokemon.status];
        if (pokemon.status && sd) {
            statusEl.style.display = 'inline-block';
            statusEl.className = `status-badge status-${pokemon.status}`;
            statusEl.style.background = sd.color || '#6b7280';
            statusEl.textContent = sd.label;
        } else statusEl.style.display = 'none';
    }

    // Tipos
    const typesEl = document.getElementById(`${side}Types`);
    if (typesEl) typesEl.innerHTML = pokemon.types.map(t =>
        `<span class="type-badge type-${t.replace(/[ÉÍÓ]/g, c => ({'É':'E','Í':'I','Ó':'O'}[c]))}">${t}</span>`
    ).join('');

    // Barra de HP
    const pct = Math.max(0, (pokemon.currentHp / pokemon.stats.hp) * 100);
    const bar  = document.getElementById(`${side}HpBar`);
    if (bar) { bar.style.width = pct + '%'; bar.style.background = pct > 50 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444'; }
    const hpT = document.getElementById(`${side}HpText`);
    if (hpT) hpT.textContent = `${Math.floor(pokemon.currentHp)} / ${pokemon.stats.hp} HP`;

    // Stats + boosts + info revelada/oculta
    const statsEl = document.getElementById(`${side}Stats`);
    if (!statsEl) return;

    const spe  = getEffectiveSpe(pokemon);
    const mods = getModifiedStats(pokemon);
    const ab   = AbilitiesDB[pokemon.ability];
    const nat  = NaturesDB[pokemon.nature] || {};
    const boosts = pokemon.statBoosts || {};

    // Para el rival: ocultar objeto y habilidad hasta que se revelen
    const revealed = isEnemy
        ? (typeof enemyRevealed !== 'undefined' ? enemyRevealed : { item:true, ability:true })
        : { item:true, ability:true };

    const abDisplay = isEnemy && !revealed.ability
        ? `<span style="color:#334155">HAB ???</span>`
        : `<span title="${ab ? ab.description : ''}" style="cursor:help;">${ab ? ab.icon + ' ' : ''}<span style="color:#a5b4fc;">${pokemon.ability || '─'}</span></span>`;

    const itemDisplay = (isEnemy && !revealed.item && pokemon.item !== 'Ninguno')
        ? `<span style="color:#334155;">OBJ ???</span>`
        : (pokemon.item !== 'Ninguno' ? `<span style="color:#fbbf24;">🎒 ${pokemon.item}</span>` : '');

    const lvlTag = pokemon.level ? `<span style="color:#475569;font-size:5px;"> Nvl${pokemon.level}</span>` : '';

    statsEl.innerHTML = `
        <div class="stat-mini">ATK <span style="color:#ef4444;">${mods.atk}${nat.up==='atk'?'↑':nat.down==='atk'?'↓':''}</span></div>
        <div class="stat-mini">DEF <span style="color:#3b82f6;">${mods.def}${nat.up==='def'?'↑':nat.down==='def'?'↓':''}</span></div>
        <div class="stat-mini">SPE <span style="color:#ec4899;">${spe}</span>${lvlTag}</div>
        <div class="stat-mini">SPA <span style="color:#a855f7;">${mods.spa}${nat.up==='spa'?'↑':nat.down==='spa'?'↓':''}</span></div>
        <div class="stat-mini">SPD <span style="color:#eab308;">${mods.spd}</span></div>
        <div class="stat-mini" style="grid-column:1/-1;">${abDisplay}</div>
        ${itemDisplay ? `<div class="stat-mini" style="grid-column:1/-1;">${itemDisplay}</div>` : ''}
        ${buildBoostRow(boosts)}
    `;
}

// ─── INDICADORES DE BOOST ACTIVOS ─────────────────────────────────────────────
function buildBoostRow(boosts) {
    const labels = { atk:'ATK', def:'DEF', spa:'SPA', spd:'SPD', spe:'SPE' };
    const multStr = b =>
        b===6?'×4':b===5?'×3.5':b===4?'×3':b===3?'×2.5':b===2?'×2':b===1?'×1.5':
        b===-1?'×0.67':b===-2?'×0.5':b===-3?'×0.4':b===-4?'×0.33':b===-5?'×0.28':b===-6?'×0.25':'';
    const active = [];
    for (const [stat, val] of Object.entries(boosts)) {
        if (val && labels[stat]) {
            const col = val > 0 ? '#22c55e' : '#ef4444';
            const arr = val > 0 ? '▲' : '▼';
            active.push(`<span style="color:${col};font-size:5px;">${arr}${multStr(val)}${labels[stat]}</span>`);
        }
    }
    if (!active.length) return '';
    return `<div class="stat-mini" style="grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">${active.join('')}</div>`;
}

// ─── MINI EQUIPO ──────────────────────────────────────────────────────────────
function updateTeamMinis() {
    ['player','enemy'].forEach(side => {
        const team   = side === 'player' ? playerTeam : enemyTeam;
        const active = side === 'player' ? playerActive : enemyActive;
        const cont   = document.getElementById(`${side}Mini`);
        if (!cont) return;
        cont.innerHTML = team.map((p, i) => {
            const hp  = (p.currentHp / p.stats.hp) * 100;
            const hpc = hp > 50 ? '#22c55e' : hp > 20 ? '#eab308' : '#ef4444';
            const sp  = getSpriteUrl(p.id, 'front');
            return `<div class="mini-slot ${i===active?'active':''} ${p.fainted?'fainted':''}">
                <img src="${sp}" onerror="onSpriteError(this, p.id)" title="${p.name}">
                <div class="mini-hp-bar"><div class="mini-hp-fill" style="width:${hp}%;background:${hpc};"></div></div>
            </div>`;
        }).join('');
    });
}

// ─── BOTONES DE MOVIMIENTO CON TOOLTIP ───────────────────────────────────────
function renderMoves() {
    if (battleOver) return;
    const pokemon = playerTeam[playerActive];
    const enemy   = enemyTeam[enemyActive];
    const grid    = document.getElementById('movesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    pokemon.moves.forEach((moveName, idx) => {
        const move = getMoveInfo(moveName);
        const eff  = move.power > 0 ? calculateEffectiveness(move.type, enemy.types) : 1;
        let effBadge = '';
        if (move.power > 0) {
            if (eff >= 4)                effBadge = `<span class="effect-badge effect-super">⚡ ×${eff}</span>`;
            else if (eff > 1)            effBadge = `<span class="effect-badge effect-super">💥 ×${eff}</span>`;
            else if (eff < 1 && eff > 0) effBadge = `<span class="effect-badge effect-weak">×${eff}</span>`;
            else if (eff === 0)          effBadge = `<span class="effect-badge effect-none">×0</span>`;
        }
        const prioTag = (move.priority || 0) > 0 ? `<span class="effect-badge">⚡P</span>` : '';
        const norm  = t => t.replace(/[ÉÍÓ]/g, c => ({'É':'E','Í':'I','Ó':'O'}[c]));
        const tc    = `mv-${norm(move.type)}`;
        const btn   = document.createElement('button');
        btn.className = `move-btn ${tc}`;
        const accLabel = move.accuracy ? `${move.accuracy}%` : '✓';
        btn.innerHTML = `<div class="move-name">${moveName}</div>
            <div class="move-meta">${move.type} • ${move.category==='physical'?'FÍS':move.category==='status'?'EST':'ESP'} • POW:${move.power||'─'} • PRE:${accLabel}</div>
            <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px;">${effBadge}${prioTag}</div>`;
        btn.onclick     = () => playerAttack(idx);
        btn.onmouseenter = (e) => showMoveTooltip(e, moveName, pokemon, enemy);
        btn.onmouseleave = ()  => hideMoveTooltip();
        grid.appendChild(btn);
    });
}

// ─── TOOLTIP DE MOVIMIENTO (solo descripción) ────────────────────────────────
function showMoveTooltip(event, moveName, attacker, defender) {
    const move = getMoveInfo(moveName);
    const tt   = document.getElementById('moveTooltip');
    if (!tt || !move.description) return hideMoveTooltip();

    tt.innerHTML = `<div class="tt-name">${moveName}</div>
        <div class="tt-desc">${move.description}</div>`;

    // Posicionar al lado del botón
    const margin = 8;
    const r    = event.target.getBoundingClientRect();
    let left   = r.right + margin;
    let top    = r.top;
    tt.style.display = 'block';
    const tw = tt.offsetWidth, th = tt.offsetHeight;
    if (left + tw > window.innerWidth  - margin) left = r.left - tw - margin;
    if (top  + th > window.innerHeight - margin) top  = window.innerHeight - th - margin;
    if (top < margin) top = margin;
    tt.style.left = left + 'px';
    tt.style.top  = top  + 'px';
}

function hideMoveTooltip() {
    const tt = document.getElementById('moveTooltip');
    if (tt) tt.style.display = 'none';
}

// calcDmgDet() es la función equivalente al final del archivo

function disableMoves() { document.querySelectorAll('#movesGrid .move-btn').forEach(b => b.disabled = true); }

// ─── LOG ─────────────────────────────────────────────────────────────────────
function addLog(msg, type = '') {
    const body = document.getElementById('logBody');
    if (!body) return;
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;
    el.innerHTML = msg;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    const entries = body.querySelectorAll('.log-entry');
    if (entries.length > 120) entries[0].remove();
}

// ─── ANIMACIONES ─────────────────────────────────────────────────────────────
function animHit(side) {
    const s = document.getElementById(`${side}Sprite`); if (!s) return;
    s.classList.add('anim-hit'); setTimeout(() => s.classList.remove('anim-hit'), 500);
}
function animFaint(side) {
    const s   = document.getElementById(`${side}Sprite`); if (!s) return;
    const cls = side === 'player' ? 'anim-faint-player' : 'anim-faint';
    s.classList.add(cls); setTimeout(() => s.classList.remove(cls), 900);
}

function animateStealthRock(side) {
    // Encontrar el contenedor correcto del sprite
    const spriteWrap = document.querySelector(side === 'enemy' ? '.pokemon-sprite-wrap.enemy-sprite-pos' : '.pokemon-sprite-wrap.player-sprite-pos');
    if (!spriteWrap) {
        console.warn(`No se encontró .pokemon-sprite-wrap.${side}-sprite-pos`);
        return;
    }
    
    // Asegurar posicionamiento relativo
    if (spriteWrap.style.position !== 'relative' && spriteWrap.style.position !== 'absolute' && spriteWrap.style.position !== 'fixed') {
        spriteWrap.style.position = 'relative';
    }
    
    // Crear contenedor para las rocas si no existe
    let rocksContainer = document.getElementById(`${side}StealthRocks`);
    if (!rocksContainer) {
        rocksContainer = document.createElement('div');
        rocksContainer.id = `${side}StealthRocks`;
        rocksContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
        `;
        spriteWrap.appendChild(rocksContainer);
    }
    
    // Animar pequeñas piedras cayendo
    const rockCount = 10;
    for (let i = 0; i < rockCount; i++) {
        const rock = document.createElement('div');
        const startX = Math.random() * 100;
        const delay = Math.random() * 300;
        
        rock.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: #5a5a5a;
            border-radius: 2px;
            left: ${startX}%;
            top: -10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.6);
            animation: fallRock 0.8s ease-in forwards;
            animation-delay: ${delay}ms;
            z-index: 5;
        `;
        rocksContainer.appendChild(rock);
        
        // Remover después de la animación
        setTimeout(() => rock.remove(), 800 + delay);
    }
    
    // Mostrar imagen semitransparente de stealth_rock después de que caigan las piedras
    setTimeout(() => {
        let stealthImg = document.getElementById(`${side}StealthRockImg`);
        if (!stealthImg) {
            stealthImg = document.createElement('img');
            stealthImg.id = `${side}StealthRockImg`;
            stealthImg.src = 'Move_effect/stealth_rocks.png';
            stealthImg.style.cssText = `
                position: absolute;
                width: 120%;
                height: 120%;
                opacity: 0.65;
                pointer-events: none;
                z-index: 20;
                left: 50%;
                top: 90%;
                transform: translate(-50%, -50%);
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
            `;
            
            // Crear fallback visual si falla la carga de imagen
            stealthImg.onerror = function() {
                console.warn(`No se pudo cargar sprites/stealth_rock.png, usando fallback visual`);
                createStealthRockFallback(rocksContainer, side);
                stealthImg.style.display = 'none';
            };
            
            rocksContainer.appendChild(stealthImg);
            
            // También iniciar carga de fallback como respaldo
            setTimeout(() => {
                if (!stealthImg.complete || stealthImg.naturalHeight === 0) {
                    createStealthRockFallback(rocksContainer, side);
                    stealthImg.style.display = 'none';
                }
            }, 500);
        }
    }, 300);
}

function createStealthRockFallback(container, side) {
    // Crear grupo de rocas con CSS si falla la imagen
    const rocksGroup = document.createElement('div');
    rocksGroup.id = `${side}StealthRockFallback`;
    rocksGroup.style.cssText = `
        position: absolute;
        width: 140px;
        height: 140px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 20;
        pointer-events: none;
    `;
    
    // Crear varias rocas en diferentes posiciones
    const rockPositions = [
        { x: 20, y: 10, size: 25 },
        { x: 60, y: 15, size: 28 },
        { x: 100, y: 20, size: 22 },
        { x: 10, y: 60, size: 26 },
        { x: 50, y: 50, size: 30 },
        { x: 90, y: 65, size: 24 },
        { x: 25, y: 100, size: 23 },
        { x: 70, y: 95, size: 27 },
        { x: 110, y: 90, size: 21 },
    ];
    
    rockPositions.forEach(pos => {
        const rock = document.createElement('div');
        rock.style.cssText = `
            position: absolute;
            width: ${pos.size}px;
            height: ${pos.size}px;
            left: ${pos.x}px;
            top: ${pos.y}px;
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
            border-radius: 4px;
            box-shadow: inset -1px -1px 2px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.6);
            opacity: 0.65;
            transform: rotate(${Math.random() * 45}deg);
        `;
        rocksGroup.appendChild(rock);
    });
    
    container.appendChild(rocksGroup);
}

function showFullTeam() {
    addLog('━━━━━━━━━━━━━━', 'separator');
    playerTeam.forEach((p, i) => {
        const pct = Math.floor((p.currentHp / p.stats.hp) * 100);
        const ico = p.fainted ? '😵' : i === playerActive ? '⚔️' : '✅';
        addLog(`${ico} ${p.name}: ${Math.floor(p.currentHp)}/${p.stats.hp} HP (${pct}%) SPE:${getEffectiveSpe(p)}`);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULADORA DE DAÑO — Modal dentro de battle.html
// ═══════════════════════════════════════════════════════════════════════════

let calcInited = false;

function openCalcModal() {
    document.getElementById('calcModal').classList.add('open');
    if (!calcInited) { initCalcModal(); calcInited = true; }
    else calcRecalc();
}
function closeCalcModal() {
    document.getElementById('calcModal').classList.remove('open');
}

function initCalcModal() {
    // Poblar naturalezas e ítems en ambos lados
    ['P','E'].forEach(side => {
        const natSel = document.getElementById(`calc${side}Nature`);
        const itmSel = document.getElementById(`calc${side}Item`);
        natSel.innerHTML = '';
        itmSel.innerHTML = '';
        Object.entries(NaturesDB).forEach(([k,n]) => {
            const o = document.createElement('option');
            o.value = k; o.textContent = n.label; natSel.appendChild(o);
        });
        Object.values(ItemsDB).forEach(it => {
            const o = document.createElement('option');
            o.value = it.name; o.textContent = it.name; itmSel.appendChild(o);
        });
    });
    calcRecalc();
}

function calcRecalc() {
    const player = playerTeam[playerActive];
    const enemy  = enemyTeam[enemyActive];
    if (!player || !enemy) return;

    // Leer overrides del modal
    const pNat  = document.getElementById('calcPNature')?.value || player.nature;
    const pItm  = document.getElementById('calcPItem')?.value   || player.item;
    const eNat  = document.getElementById('calcENature')?.value || enemy.nature;
    const eItm  = document.getElementById('calcEItem')?.value   || enemy.item;

    // Sync selects con el estado actual del combate
    const pNatEl = document.getElementById('calcPNature');
    const eNatEl = document.getElementById('calcENature');
    const pItmEl = document.getElementById('calcPItem');
    const eItmEl = document.getElementById('calcEItem');
    if (pNatEl && !calcInited) pNatEl.value = player.nature;
    if (eNatEl && !calcInited) eNatEl.value = enemy.nature;
    if (pItmEl && !calcInited) pItmEl.value = player.item;
    if (eItmEl && !calcInited) eItmEl.value = enemy.item;

    // Clonar Pokémon con overrides
    const pCalc = calcMakePoke(player, pNat, pItm);
    const eCalc = calcMakePoke(enemy,  eNat, eItm);

    calcRenderCard('Player', pCalc, 'back');
    calcRenderCard('Enemy',  eCalc, 'front');
    calcRenderMoves('Player', pCalc, eCalc);
    calcRenderMoves('Enemy',  eCalc, pCalc);
    calcRenderFooter(pCalc, eCalc);
}

function calcMakePoke(base, nature, item) {
    // Recalcular stats con la naturaleza del modal
    const nat   = getNatureMultipliers(nature);
    const evs   = base.evs || {};
    const level = base.level || 100;
    const stats = buildStats(
        // base.stats ya tiene EVs+naturaleza aplicados; necesitamos los stats base
        // Usamos PokemonDB para las stats base
        PokemonDB[base.id]?.stats || base.stats,
        evs, level, nature
    );
    return { ...base, stats, nature, item, currentHp: base.currentHp };
}

function calcRenderCard(side, pokemon, spriteDir) {
    const el = document.getElementById(`calc${side}Card`);
    if (!el) return;
    const sp = getSpriteUrl(pokemon.id, spriteDir);
    const stats = pokemon.stats;
    el.innerHTML = `
        <img class="cs-sprite" src="${sp}" onerror="onSpriteError(this,${pokemon.id})">
        <div style="flex:1;">
            <div class="cs-poke-name">${pokemon.name}</div>
            <div class="cs-poke-types">${pokemon.types.map(t =>
                `<span class="type-badge type-${t.replace(/[ÉÍÓ]/g,c=>({'É':'E','Í':'I','Ó':'O'}[c]))}">${t}</span>`
            ).join('')}</div>
            <div class="cs-stats">
                <span style="color:#22c55e;">HP ${stats.hp}</span>
                <span style="color:#ef4444;">ATK ${stats.atk}</span>
                <span style="color:#3b82f6;">DEF ${stats.def}</span>
                <span style="color:#a855f7;">SPA ${stats.spa}</span>
                <span style="color:#eab308;">SPD ${stats.spd}</span>
                <span style="color:#ec4899;">SPE ${stats.spe}</span>
            </div>
            <div class="cs-stats" style="margin-top:2px;">
                <span style="color:#a5b4fc;">HAB ${pokemon.ability}</span>
                ${pokemon.item !== 'Ninguno' ? `<span style="color:#fbbf24;">🎒 ${pokemon.item}</span>` : ''}
            </div>
        </div>`;
}

function calcRenderMoves(side, attacker, defender) {
    const cont = document.getElementById(`calc${side}Moves`);
    if (!cont) return;
    const base  = PokemonDB[attacker.id];
    const moves = base?.learnset || base?.moves || attacker.moves || [];

    const results = moves.map(moveName => {
        const move = getMoveInfo(moveName);
        if (!move.power || move.category === 'status') {
            return { moveName, move, min:0, max:0, eff:1, isStatus:true };
        }
        // Leer boosts del modal
        const isFisMove = (getMoveInfo(moveName).category === 'physical');
        const rawAtkB = isFisMove
            ? (document.getElementById(side==='Player'?'calcPAtkBoost':'calcEAtkBoost')?.value||0)
            : (document.getElementById(side==='Player'?'calcPSpaBoost':'calcESpaBoost')?.value||0);
        const rawDefB = isFisMove
            ? (document.getElementById(side==='Player'?'calcEDefBoost':'calcPDefBoost')?.value||0)
            : (document.getElementById(side==='Player'?'calcESpdBoost':'calcPSpdBoost')?.value||0);
        const min = calcDmgDet(attacker, defender, moveName, 0.85, rawAtkB, rawDefB);
        const max = calcDmgDet(attacker, defender, moveName, 1.0,  rawAtkB, rawDefB);
        const eff = calculateEffectiveness(move.type, defender.types);
        return { moveName, move, min, max, eff, isStatus:false };
    }).sort((a,b) => b.max - a.max);

    cont.innerHTML = results.map(({ moveName, move, min, max, eff, isStatus }) => {
        if (isStatus) {
            return `<div class="cm-row" style="opacity:.5;">
                <div class="cm-name">🌀 ${moveName}</div>
                <div class="cm-dmg" style="color:#475569;">—</div>
            </div>`;
        }
        const hpMax  = defender.stats.hp;
        const pctMax = Math.round((max / hpMax) * 100);
        const pctMin = Math.round((min / hpMax) * 100);
        const isOHKO = max >= hpMax;
        const is2HKO = min * 2 >= hpMax;
        const barCol = isOHKO ? '#ef4444' : is2HKO ? '#f59e0b' : '#3b82f6';
        const cls    = isOHKO ? 'cm-ohko' : is2HKO ? 'cm-2hko' : '';
        let effBadge = '';
        if      (eff >= 4)           effBadge = `<span class="cm-eff hyper">×${eff}</span>`;
        else if (eff > 1)            effBadge = `<span class="cm-eff super">×${eff}</span>`;
        else if (eff < 1 && eff > 0) effBadge = `<span class="cm-eff weak">×${eff}</span>`;
        else if (eff === 0)          effBadge = `<span class="cm-eff none">×0</span>`;
        return `<div class="cm-row ${cls}">
            <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
                    <span class="cm-name">${moveName}${isOHKO?' <span style="color:#ef4444;font-size:6px;">OHKO</span>':is2HKO?' <span style="color:#f59e0b;font-size:6px;">2HKO</span>':''}</span>
                    ${effBadge}
                </div>
                <div class="cm-bar-bg"><div class="cm-bar-fill" style="width:${Math.min(100,pctMax)}%;background:${barCol};"></div></div>
            </div>
            <div class="cm-dmg">
                <div class="cm-dmg-val" style="color:${barCol};">${min}–${max}</div>
                <div class="cm-dmg-pct">${pctMin}–${pctMax}%</div>
            </div>
        </div>`;
    }).join('');
}

function calcRenderFooter(poke, enemy) {
    const footer = document.getElementById('calcFooter');
    if (!footer) return;
    const base   = PokemonDB[poke.id];
    const baseE  = PokemonDB[enemy.id];
    const movesP = base?.learnset || base?.moves || poke.moves || [];
    const movesE = baseE?.learnset || baseE?.moves || enemy.moves || [];
    const bestP  = movesP.reduce((b,mv) => { const d=calcDmgDet(poke, enemy, mv, 1.0); return d>b?d:b; }, 0);
    const bestE  = movesE.reduce((b,mv) => { const d=calcDmgDet(enemy, poke,  mv, 1.0); return d>b?d:b; }, 0);
    const pctP   = Math.round((bestP / enemy.stats.hp) * 100);
    const pctE   = Math.round((bestE / poke.stats.hp)  * 100);

    let verdict;
    if      (pctP >= 100 && pctE < 100)  verdict = `<span class="calc-verdict cv-player">✅ ${poke.name} GANA</span>`;
    else if (pctE >= 100 && pctP < 100)  verdict = `<span class="calc-verdict cv-enemy">❌ ${enemy.name} GANA</span>`;
    else if (pctP >= 100 && pctE >= 100) verdict = `<span class="calc-verdict cv-tie">⚡ AMBOS PUEDEN OHKO</span>`;
    else                                  verdict = `<span class="calc-verdict cv-tie">🤔 Ninguno OHKO</span>`;

    footer.innerHTML = `${verdict}
        <span style="color:#64748b;">🟢 ${poke.name} daño máx: <b style="color:#fbbf24;">${pctP}%</b></span>
        <span style="color:#64748b;">🔴 ${enemy.name} daño máx: <b style="color:#fbbf24;">${pctE}%</b></span>`;
}

// Multiplicador de boost por nivel (+1=×1.5, +2=×2 ... -1=×0.67 ...)
function boostMult(lvl) {
    lvl = parseInt(lvl) || 0;
    if (lvl === 0) return 1;
    if (lvl > 0) return (2 + lvl) / 2;
    return 2 / (2 - lvl);
}

// Cálculo determinista de daño (sin factor aleatorio)
// atkBoost/defBoost: nivel de boost (-6 a +6) leídos del modal si existen
function calcDmgDet(attacker, defender, moveName, factor, atkBoost, defBoost) {
    const move = getMoveInfo(moveName);
    if (!move.power || move.category === 'status') return 0;
    const isFis  = move.category === 'physical';
    const aStats = getModifiedStats(attacker);
    const dStats = getModifiedStats(defender);
    // Aplicar boost manual del modal
    const aBoostLvl = atkBoost !== undefined ? atkBoost : 0;
    const dBoostLvl = defBoost !== undefined ? defBoost : 0;
    const atk    = (isFis ? aStats.atk : aStats.spa) * boostMult(aBoostLvl);
    const def    = (isFis ? dStats.def : dStats.spd) * boostMult(dBoostLvl);
    const lvl    = attacker.level || 100;
    let dmg = Math.floor(Math.floor(Math.floor(2*lvl/5+2)*move.power*atk/def)/50)+2;
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const eff  = calculateEffectiveness(move.type, defender.types);
    const atkAb = AbilitiesDB[attacker.ability];
    if (atkAb?.trigger === 'on_attack') {
        if (atkAb.effect === 'boost_type_atk' && move.type === atkAb.boostedType) dmg *= atkAb.value;
        if (atkAb.effect === 'crit_boost' || atkAb.effect === 'brute_force')      dmg *= atkAb.value;
    }
    dmg *= stab * eff;
    dmg *= getItemTypeBoost(attacker, move.type);
    dmg *= (getItemStatBoost(attacker).damage || 1);
    const defAb = AbilitiesDB[defender.ability];
    if (defAb?.trigger === 'on_hit') {
        if (defAb.effect === 'reduce_physical_dmg' && isFis)  dmg *= defAb.value;
        if (defAb.effect === 'reduce_special_dmg'  && !isFis) dmg *= defAb.value;
    }
    if (attacker.status === 'burn' && isFis) dmg *= 0.5;
    return Math.max(1, Math.floor(dmg * factor));
}
