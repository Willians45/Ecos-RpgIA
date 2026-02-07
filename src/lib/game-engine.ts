import { GameState, INITIAL_ROOMS, Player, Room, RoomEntity } from './game-data';

export interface Action {
    playerId: string;
    playerName: string;
    content: string;
}

export interface ActionResult {
    narrative: string; // La "semilla" narrativa para la IA (ej: "Ataque exitoso, 5 daño")
    newState: GameState;
    events: GameEvent[];
}

export interface GameEvent {
    type: 'damage' | 'heal' | 'item_gain' | 'item_loss' | 'room_change' | 'flag_set' | 'info';
    targetId?: string;
    value?: any;
    description: string;
}

// Helper para tiradas de dados
const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

export function processTurn(currentState: GameState, actions: Action[]): ActionResult {
    let newState = JSON.parse(JSON.stringify(currentState)); // Copia profunda
    const events: GameEvent[] = [];
    const narrativeSeeds: string[] = [];
    const currentRoom = INITIAL_ROOMS[newState.currentRoomId];

    // Procesar acciones secuencialmente (por ahora, luego se podría hacer por iniciativa)
    for (const action of actions) {
        const player = newState.players.find((p: Player) => p.id === action.playerId);
        if (!player || player.hp <= 0) continue; // Muertos no actúan

        const input = action.content.toLowerCase();
        const currentRoom = INITIAL_ROOMS[newState.currentRoomId]; // This one is kept as it correctly reflects the room for the current action

        // --- LÓGICA DE COMBATE BÁSICA ---
        if (input.includes('atacar') || input.includes('golpear') || input.includes('matar')) {
            // Identificar objetivo (muy simple por ahora: buscar primer enemigo vivo)
            const visibleEnemies = currentRoom.entities.filter((e: any) =>
                e.isEnemy && (!e.missingFlag || !newState.worldState[e.missingFlag])
            );

            if (visibleEnemies.length > 0) {
                const target = visibleEnemies[0]; // Ataca al primero por defecto

                // Tirada de ataque: d20 + Fuerza vs AC arbitraria (12)
                const roll = rollDice(20);
                const hitChance = roll + player.attributes.fuerza;

                if (hitChance >= 12) {
                    // Acierto
                    const damage = Math.max(1, Math.floor(player.attributes.fuerza / 2) + rollDice(4));
                    target.hp = (target.hp || 0) - damage;

                    newState.inCombat = true; // Entrar en combate al atacar
                    narrativeSeeds.push(`${player.name} ataca a ${target.name} y ACIERTA (Roll ${roll}+${player.attributes.fuerza}). Daño: ${damage}. HP Restante: ${target.hp}.`);

                    if (target.hp <= 0) {
                        narrativeSeeds.push(`${target.name} ha MUERTO.`);
                        // Actualizar flag de muerte
                        if (target.id === 'guardia_orco') newState.worldState['guardia_muerto'] = true;
                    }
                } else {
                    // Fallo
                    newState.inCombat = true; // Entrar en combate aunque falles
                    narrativeSeeds.push(`${player.name} ataca a ${target.name} pero FALLA (Roll ${roll}+${player.attributes.fuerza}).`);
                }
            } else {
                narrativeSeeds.push(`${player.name} intenta atacar, pero no hay enemigos vivos.`);
            }
        }

        // --- LÓGICA DE INVENTARIO ---
        else if (input.includes('coger') || input.includes('tomar') || input.includes('agarrar')) {
            // Buscar item mencionado
            const visibleItems = currentRoom.items.filter((i: any) =>
                (!i.requiredFlag || newState.worldState[i.requiredFlag]) &&
                (!i.missingFlag || !newState.worldState[i.missingFlag])
            );

            let itemTaken = null;
            for (const item of visibleItems) {
                if (input.includes(item.name.toLowerCase()) || input.includes(item.id)) {
                    itemTaken = item;
                    break;
                }
                // Fallback simple: si dice "candelabro"
                if (input.includes('candelabro') && item.id === 'candelabro') itemTaken = item;
                if (input.includes('llave') && item.id === 'llave_celda') itemTaken = item;
            }

            if (itemTaken) {
                player.inventory.push(itemTaken.name);
                events.push({ type: 'item_gain', targetId: player.id, value: itemTaken.name, description: `Cogió ${itemTaken.name}` });

                // Marcar como tomado globalmente
                if (itemTaken.id === 'candelabro') newState.worldState['candelabro_tomado'] = true;
                if (itemTaken.id === 'llave_celda') newState.worldState['llave_tomada'] = true;

                narrativeSeeds.push(`${player.name} recoge ${itemTaken.name}.`);
            } else {
                narrativeSeeds.push(`${player.name} intenta coger algo pero no lo encuentra o ya no está.`);
            }
        }

        // --- LÓGICA DE MOVIMIENTO ---
        else if (input.includes('abrir') || input.includes('entrar') || input.includes('ir') || input.includes('norte') || input.includes('sur')) {
            // Lógica simplificada de puertas
            if (input.includes('puerta') && newState.currentRoomId === 'start') {
                if (newState.worldState['guardia_muerto'] || player.inventory.includes('Llave de la Celda')) {
                    newState.worldState['puerta_celda_abierta'] = true;
                    narrativeSeeds.push(`${player.name} abre la puerta de la celda.`);
                } else {
                    narrativeSeeds.push(`${player.name} intenta abrir la puerta pero está cerrada con llave.`);
                }
            }

            // Check salidas
            const exit = currentRoom.exits.find((e: any) => input.includes(e.direction.toLowerCase()) || input.includes('salir'));
            if (exit) {
                if (!exit.condition || newState.worldState[exit.condition]) {
                    newState.currentRoomId = exit.targetRoomId;
                    events.push({ type: 'room_change', value: exit.targetRoomId, description: `Grupo mueve a ${exit.targetRoomId}` });
                    narrativeSeeds.push(`${player.name} lidera al grupo hacia ${exit.direction}.`);
                } else {
                    narrativeSeeds.push(`${player.name} intenta ir hacia ${exit.direction} pero el camino está bloqueado (${exit.lockedMessage}).`);
                }
            }
        }

        // --- ACCIONES GENÉRICAS ---
        else {
            narrativeSeeds.push(`${player.name} realiza: "${input}". (Sin efecto mecánico directo, el Master interpretará).`);
        }
    }

    // --- TURNO DE LOS ENEMIGOS (IA PRIMITIVA) ---
    // Solo atacan si hay combate activo
    if (newState.inCombat) {
        const currentRoom = INITIAL_ROOMS[newState.currentRoomId]; // This declaration is now the correct one for enemy turn
        const enemies = currentRoom.entities.filter((e: any) =>
            e.isEnemy && (!e.missingFlag || !newState.worldState[e.missingFlag]) && (e.hp || 0) > 0
        );

        for (const enemy of enemies) {
            if (!enemy.damage) continue;

            // Elegir objetivo aleatorio vivo
            const livingPlayers = newState.players.filter((p: Player) => p.hp > 0);

            if (livingPlayers.length > 0) {
                const targetPlayer = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];

                // Tirada de ataque enemigo (Simplificada: 50% chance base + daño masivo)
                // Ojo: Si el orco tiene +4 al hit, y player AC es 12. 
                // Roll 1d20. Si (roll + 4) >= 12 -> Hit. (Roll >= 8). 65% hit rate.
                const roll = rollDice(20);
                if (roll >= 8) {
                    const dmg = rollDice(enemy.damage); // Daño 1d6 (letalidad moderada)
                    targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg);
                    events.push({ type: 'damage', targetId: targetPlayer.id, value: dmg, description: `${enemy.name} golpea a ${targetPlayer.name}` });
                    narrativeSeeds.push(`EL ENEMIGO ${enemy.name} ATACA a ${targetPlayer.name} y ACIERTA haciendo ${dmg} de daño.`);

                    if (targetPlayer.hp <= 0) {
                        narrativeSeeds.push(`${targetPlayer.name} ha caído INCONSCIENTE.`);
                        // Check game over
                        if (newState.players.every((p: Player) => p.hp <= 0)) {
                            newState.isGameOver = true;
                            newState.gameStatus = 'death';
                        }
                    }
                } else {
                    narrativeSeeds.push(`EL ENEMIGO ${enemy.name} lanza un golpe a ${targetPlayer.name} pero FALLA.`);
                }
            }
        }
    }

    // --- VERIFICACIÓN DE FIN DE COMBATE ---
    // Si estábamos en combate, verificar si quedan enemigos vivos en la sala
    if (newState.inCombat) {
        const remainingEnemies = currentRoom.entities.some((e: any) =>
            e.isEnemy && (!e.missingFlag || !newState.worldState[e.missingFlag]) && (e.hp || 0) > 0
        );

        if (!remainingEnemies) {
            newState.inCombat = false;
            events.push({ type: 'info', description: 'Combate finalizado' });
            narrativeSeeds.push(`El silencio vuelve a la sala. La amenaza ha sido neutralizada.`);
        }
    }

    // Construir el string final para la IA
    return {
        narrative: narrativeSeeds.join('\n'),
        newState,
        events
    };
}
