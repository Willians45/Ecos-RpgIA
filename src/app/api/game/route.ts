import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { processTurn } from '@/lib/game-engine';
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

    const systemPrompt = `
      ERES EL NARRADOR DE UN JUEGO DE ROL.
      
      INPUT DEL MOTOR DE JUEGO (HECHOS INMUTABLES):
      ----------------------------------------------------
      ${engineNarrative}
      ----------------------------------------------------
      
      INSTRUCCIONES CLAVE:
      1. NARRATIVA HÍBRIDA: Usa los hechos de arriba. NO INVENTES DAÑO NI MUERTES que no estén en el input.
      2. ESTILO: Oscuro, cínico y BREVE. Evita la prosa excesivamente florida ("purple prose").
      3. LONGITUD: Máximo 2-3 oraciones concisas por acción. NO escribas parrafadas.
      4. SI NO PASA NADA NUEVO: Simplemente describe la atmósfera brevemente.
      
      SI EL INPUT DICE "FALLA": Describe un error torpe o un bloqueo fácil. NO describas "casi muertes".
      SI EL INPUT DICE "DAÑO 3": Si el jugador tiene 25 HP, es una herida seria. Si tiene 100, es un rasguño.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }],
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
