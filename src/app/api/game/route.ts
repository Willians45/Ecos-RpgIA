import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { processTurn, Action } from '@/lib/game-engine';
import { INITIAL_ROOMS } from '@/lib/game-data';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ narrative: "Error de servidor: API Key faltante." }, { status: 500 });
    }

    const { gameState, actions } = await req.json();

    if (!gameState || !actions) {
      return NextResponse.json({ narrative: "Datos corrompidos." }, { status: 400 });
    }

    // 1. PROCESAMIENTO DETERMINISTA (CÓDIGO)
    // Inicializar estado de mundo si no existe
    if (!gameState.worldState) gameState.worldState = {};
    if (!gameState.currentRoomId) gameState.currentRoomId = 'start'; // Fallback compatibilidad

    const { narrative: engineNarrative, newState, events, diceRolls } = processTurn(gameState, actions);

    // 2. NARRATIVA INTELLIGENTE (IA)
    // La IA ahora actúa como "renderizador de texto". No decide qué pasa, solo lo cuenta bonito.
    const groq = new Groq({ apiKey });

    // Información de la sala actual (CONTEXTO CRÍTICO)
    const currentRoom = INITIAL_ROOMS[newState.currentRoomId];

    // Snapshot del estado del mundo para evitar alucinaciones
    const worldSnapshot = `
      SALA ACTUAL: ${currentRoom.name}
      ESTADO MUNDIAL:
      - Guardia Orco: ${newState.worldState['guardia_muerto'] ? 'MUERTO (Yace como un cadáver)' : 'VIVO y Vigilando'}
      - Puerta Celda: ${newState.worldState['puerta_celda_abierta'] ? 'ABIERTA' : 'CERRADA'}
      - Inventario Jugador: ${newState.character?.inventory.join(', ') || 'Vacío'}
      - Combate Activo: ${newState.inCombat ? 'SÍ' : 'NO'}
    `;

    const systemPrompt = `
      ERES EL NARRADOR DE UNA DEMO DE RPG. Tu única función es embellecer los resultados mecánicos.
      
      ═══════════════════════════════════════════════════════════════
      ESTADO REAL DEL MUNDO (PROHIBIDO CONTRADECIR):
      ═══════════════════════════════════════════════════════════════
      ${worldSnapshot}
      
      ═══════════════════════════════════════════════════════════════
      RESULTADOS DEL MOTOR (HECHOS INMUTABLES):
      ═══════════════════════════════════════════════════════════════
      ${engineNarrative}
      ${diceRolls.map(r => `[DADO: ${r.label} | Resultado: ${r.value} | DC: ${r.dc} | ${r.success ? 'ÉXITO' : 'FALLO'}]`).join('\n')}
      
      ═══════════════════════════════════════════════════════════════
      INSTRUCCIONES NARRATIVAS:
      ═══════════════════════════════════════════════════════════════
      1. NO INVENTES: Si el motor dice que el orco está muerto, NO lo describas respirando.
      2. ABSURDO: Si el jugador intenta algo físicamente imposible (volar, teleport), búrlate de él de forma sarcástica.
      3. TONO: Dark Fantasy, cínico, breve.
      4. TIRADAS: Menciona sutilmente el resultado del dado si fue un éxito o fallo crítico/ajustado.
      
      Máximo 2-3 oraciones. NO escribas párrafos largos.
    `;


    // Construir mensajes con historial + instrucción actual
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...newState.history.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: `Acciones del turno actual:\n${actions.map((a: Action) => `- ${a.playerName}: ${a.content}`).join('\n')}\n\nDescribe lo que pasa según el motor: ${engineNarrative}`
      }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
    });

    const aiNarrative = chatCompletion.choices[0].message.content || engineNarrative;

    // 3. RESPUESTA AL CLIENTE
    // Mapeamos los eventos del motor a un formato que el frontend entienda
    // NOTA: El frontend actual espera un solo 'targetPlayerId' para efectos simples.
    // Para soportar múltiples daños/items en un turno, deberíamos refactorizar el frontend,
    // pero por ahora, enviaremos el 'newState' completo y dejaremos que se sincronice.

    // Extracción de datos clave para compatibilidad con frontend existente
    const primaryEvent = events.find(e => e.type === 'damage' || e.type === 'item_gain');

    return NextResponse.json({
      narrative: aiNarrative,
      // Datos 'legacy' para animaciones simples en frontend
      targetPlayerId: primaryEvent?.targetId || null,
      hpDelta: primaryEvent?.type === 'damage' ? -primaryEvent.value : 0,
      itemGained: primaryEvent?.type === 'item_gain' ? primaryEvent.value : null,

      // DATOS HÍBRIDOS REALES (Source of Truth)
      // Enviamos el estado completo calculado por el motor
      newState: newState
    });

  } catch (error: any) {
    console.error("ERROR API:", error);
    return NextResponse.json({ narrative: `Error crítico: ${error.message}` }, { status: 500 });
  }
}
