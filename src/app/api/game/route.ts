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

    const { narrative: engineNarrative, newState, events } = processTurn(gameState, actions);

    // 2. NARRATIVA INTELLIGENTE (IA)
    // La IA ahora actúa como "renderizador de texto". No decide qué pasa, solo lo cuenta bonito.
    const groq = new Groq({ apiKey });

    // Información de la sala actual (CONTEXTO CRÍTICO)
    const currentRoom = INITIAL_ROOMS[newState.currentRoomId];

    const systemPrompt = `
      ERES EL NARRADOR DE UN JUEGO DE ROL. Tu trabajo es describir lo que pasa SIN inventar nada.
      
      ═══════════════════════════════════════════════════════════════
      LOCALIZACIÓN ACTUAL (NO PUEDES CAMBIAR ESTO):
      ═══════════════════════════════════════════════════════════════
      SALA: ${currentRoom.name}
      DESCRIPCIÓN BASE: ${currentRoom.description}
      
      ═══════════════════════════════════════════════════════════════
      LO QUE ACABA DE PASAR (MOTOR DE JUEGO):
      ═══════════════════════════════════════════════════════════════
      ${engineNarrative}
      
      ═══════════════════════════════════════════════════════════════
      INSTRUCCIONES ESTRICTAS:
      ═══════════════════════════════════════════════════════════════
      
      1. **LOCALIZACIÓN FIJA**: Estás en "${currentRoom.name}". NO inventes callejones, bosques ni otras salas.
      2. **SOLO DESCRIBE LOS HECHOS**: El motor te dice qué pasó. Tú solo narras cómo se sintió o se vio.
      3. **BREVEDAD OBLIGATORIA**: Máximo 2-3 oraciones. Nada de párrafos épicos.
      4. **SI NO PASÓ NADA**: Describe solo lo que el jugador ve EN ESTA SALA (usa la descripción base de arriba).
      
      RESPONDE SOLO CON LA NARRATIVA. SIN METADATOS NI NOTAS.
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
