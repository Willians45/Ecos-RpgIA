import { GameState, INITIAL_ROOMS, Player, Room, RoomEntity } from './game-data';

export interface Action {
    playerId: string;
    playerName: string;
    content: string;
}

export interface ActionResult {
    narrative: string;
    newState: GameState;
    events: GameEvent[];
    diceRolls: { label: string; value: number; dc: number; success: boolean }[];
}

export interface GameEvent {
    type: 'damage' | 'heal' | 'item_gain' | 'item_loss' | 'room_change' | 'flag_set' | 'info' | 'absurd';
    targetId?: string;
    value?: any;
    description: string;
}

const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

export function processTurn(currentState: GameState, actions: Action[]): ActionResult {
    let newState = JSON.parse(JSON.stringify(currentState));
    const events: GameEvent[] = [];
    const narrativeSeeds: string[] = [];
    const diceRolls: ActionResult['diceRolls'] = [];
    const currentRoom = INITIAL_ROOMS[newState.currentRoomId];

    for (const action of actions) {
        const player = newState.players.find((p: Player) => p.id === action.playerId);
        if (!player || player.hp <= 0) continue;

        const input = action.content.toLowerCase();

        // 1. DETECCIÓN DE ACCIONES ABSURDAS (Muros de contención para la IA)
        const isAbsurd = /volar|teletransportar|destruir el mundo|saltar 10 pisos|matar a todos|superpoder|invencible|crear/.test(input);

        if (isAbsurd) {
            events.push({ type: 'absurd', description: 'Acción físicamente imposible' });
            narrativeSeeds.push(`${player.name} intenta algo ridículo: "${input}". REGLA: Fracaso absoluto. Búrlate del jugador de forma cínica.`);
            continue;
        }

        // 2. MODO COMBATE (DETERMINISTA)
        if (input.includes('atacar') || input.includes('golpear') || input.includes('matar') || input.includes('pelear')) {
            const enemies = currentRoom.entities.filter(e => e.isEnemy && !newState.worldState[`${e.id}_muerto`]);
            if (enemies.length > 0) {
                const target = enemies[0];
                const roll = rollDice(20);
                const total = roll + player.attributes.fuerza;
                const dc = 12; // Clase de Armadura base
                const success = total >= dc;

                diceRolls.push({ label: `Ataque de ${player.name}`, value: total, dc, success });

                if (success) {
                    const dmg = Math.max(2, Math.floor(player.attributes.fuerza / 2) + rollDice(6));
                    target.hp = (target.hp || 30) - dmg;
                    newState.inCombat = true;
                    narrativeSeeds.push(`${player.name} ataca a ${target.name} y ACIERTA (${total} vs DC ${dc}). Daño: ${dmg}. HP: ${target.hp}.`);

                    if (target.hp <= 0) {
                        newState.worldState[`${target.id}_muerto`] = true;
                        newState.worldState['llave_tomada'] = true; // El guardia suelta la llave al morir
                        narrativeSeeds.push(`${target.name} ha muerto y soltado la Llave de la Celda.`);
                    }
                } else {
                    newState.inCombat = true;
                    narrativeSeeds.push(`${player.name} intenta atacar a ${target.name} pero FALLA estrepitosamente (${total} vs DC ${dc}).`);
                }
            } else {
                narrativeSeeds.push(`${player.name} lanza golpes al aire, no hay enemigos.`);
            }
        }

        // 3. MODO ELOCUENCIA (PERSUASIÓN / INTIMIDACIÓN / ENGAÑO)
        else if (input.includes('hablar') || input.includes('convencer') || input.includes('engañar') || input.includes('intimidar') || input.includes('decir')) {
            const guard = currentRoom.entities.find(e => e.id === 'guardia_orco' && !newState.worldState['guardia_muerto']);

            if (guard) {
                const roll = rollDice(20);
                const total = roll + player.attributes.presencia;
                let dc = 15; // DC base para elocuencia

                if (input.includes('intimidar')) dc = 12; // Orco respeta la fuerza
                if (input.includes('convencer')) dc = 18; // El orco es testarudo

                const success = total >= dc;
                diceRolls.push({ label: `Elocuencia de ${player.name}`, value: total, dc, success });

                if (success) {
                    if (input.includes('intimidar')) {
                        newState.worldState['guardia_distraido'] = true;
                        narrativeSeeds.push(`${player.name} intimida al guardia. El orco retrocede asustado y deja caer el candelabro.`);
                    } else {
                        newState.worldState['puerta_celda_abierta'] = true;
                        narrativeSeeds.push(`${player.name} convence al guardia de que hay un error. ¡El orco abre la celda!`);
                    }
                } else {
                    newState.inCombat = true; // El fracaso en elocuencia inicia combate freq.
                    narrativeSeeds.push(`${player.name} intenta hablar, pero el orco se ríe de su debilidad (${total} vs DC ${dc}). El guardia se pone agresivo.`);
                }
            } else {
                narrativeSeeds.push(`${player.name} habla solo, no hay nadie que escuche.`);
            }
        }

        // 4. MOVIMIENTO Y EXPLORACIÓN
        else if (input.includes('ir') || input.includes('moverse') || input.includes('entrar') || input.includes('salir') || input.includes('norte') || input.includes('sur')) {
            const exit = currentRoom.exits.find(e => input.includes(e.direction.toLowerCase()) || input.includes('salir'));
            if (exit) {
                if (!exit.condition || newState.worldState[exit.condition]) {
                    newState.currentRoomId = exit.targetRoomId;
                    events.push({ type: 'room_change', value: exit.targetRoomId, description: `Moviendo a ${exit.targetRoomId}` });
                    narrativeSeeds.push(`${player.name} se mueve hacia ${exit.direction}.`);
                } else {
                    narrativeSeeds.push(`${player.name} intenta salir, pero: ${exit.lockedMessage}`);
                }
            } else {
                narrativeSeeds.push(`${player.name} busca una salida pero no sabe a dónde ir.`);
            }
        }

        // 5. RECOGER OBJETOS
        else if (input.includes('coger') || input.includes('tomar') || input.includes('agarrar')) {
            const item = currentRoom.items.find(i =>
                (input.includes(i.name.toLowerCase()) || input.includes(i.id)) &&
                (!i.requiredFlag || newState.worldState[i.requiredFlag]) &&
                (!i.missingFlag || !newState.worldState[i.missingFlag])
            );

            if (item) {
                player.inventory.push(item.name);
                newState.worldState[`${item.id}_tomado`] = true;
                events.push({ type: 'item_gain', targetId: player.id, value: item.name, description: `Obtuvo ${item.name}` });
                narrativeSeeds.push(`${player.name} recoge el ${item.name}.`);
            } else {
                narrativeSeeds.push(`${player.name} intenta agarrar algo que no está o es inalcanzable.`);
            }
        }

        // 6. ACCIONES DE OBSERVACIÓN (No mecánicas)
        else {
            narrativeSeeds.push(`${player.name} observa: "${input}". Sin impacto mecánico. Describe la atmósfera de ${currentRoom.name} de forma cínica.`);
        }
    }

    // TURNO ENEMIGO (Si hay combate)
    if (newState.inCombat) {
        const enemies = currentRoom.entities.filter(e => e.isEnemy && !newState.worldState[`${e.id}_muerto`]);
        for (const enemy of enemies) {
            const livingPlayers = newState.players.filter((p: Player) => p.hp > 0);
            if (livingPlayers.length > 0) {
                const target = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
                const roll = rollDice(20);
                if (roll >= 10) {
                    const dmg = rollDice(enemy.damage || 6);
                    target.hp = Math.max(0, target.hp - dmg);
                    narrativeSeeds.push(`${enemy.name} ataca a ${target.name} y DAÑA (${dmg} de daño). HP: ${target.hp}.`);
                    if (target.hp <= 0) {
                        narrativeSeeds.push(`¡${target.name} ha caído ante la fuerza del orco!`);
                        if (newState.players.every((p: Player) => p.hp <= 0)) {
                            newState.isGameOver = true;
                            newState.gameStatus = 'death';
                        }
                    }
                } else {
                    narrativeSeeds.push(`${enemy.name} lanza un golpe torpe que ${target.name} esquiva.`);
                }
            }
        }
    }

    // VERIFICAR VICTORIA
    if (newState.currentRoomId === 'victory_room') {
        newState.isGameOver = true;
        newState.gameStatus = 'victory';
    }

    return {
        narrative: narrativeSeeds.join('\n'),
        newState,
        events,
        diceRolls
    };
}
