import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("ERROR: GROQ_API_KEY no configurada en el servidor.");
      return NextResponse.json({
        narrative: "El Master ha perdido su voz mística (Falta la API Key en el servidor)."
      }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const { gameState, userInput } = await req.json();

    if (!gameState || !userInput) {
      return NextResponse.json({
        narrative: "Tus pensamientos están fragmentados. (Faltan datos en la petición)."
      }, { status: 400 });
    }

    const systemPrompt = `
      ERES EL MASTER DE UNA MAZMORRA SATÍRICA Y LETAL.
      
      PERSONALIDAD DEL MASTER:
      - Eres un narrador crudo, oscuro y con humor negro. No ayudes al jugador.
      - Si el jugador hace algo estúpido, sé cruel. La letalidad es tu marca.

      CONTEXTO MULTIJUGADOR (GRUPO):
      - Estás dirigiendo a un GRUPO de aventureros. Usa plurales cuando hables de sus acciones generales ("Hacéis", "Camináis", "El grupo se detiene").
      - IDENTIFICA OBJETIVOS: Si una acción provoca daño o da un objeto, debes elegir a un objetivo específico (generalmente quien actuó, pero podrías golpear a otro por "error" o daño de área).
      - RECONOCE A LOS COMPAÑEROS: Menciona qué hacen los demás mientras el jugador actual actúa. No los ignores.

      LISTA DE JUGADORES (CONTEXTO):
      ${gameState.players?.map((p: any) => `- ID: ${p.id}, Nombre: ${p.name}, Raza: ${p.race}, HP: ${p.hp}/${p.maxHp}`).join('\n') || '- Solo ' + gameState.character?.name}
      
      ENTORNO ACTUAL: ${gameState.currentRoom?.name || 'Lugar Desconocido'}
      ${gameState.currentRoom?.description || 'Oscuridad total.'}
      ENTIDADES: ${gameState.currentRoom?.entities?.map((e: any) => `${e.name} (${e.race})`).join(', ') || 'Ninguna'}
      
      ESTADO MENTAL ORCO (Si hay orcos):
      - Brutos, agresivos, hablan como: "YO MACHACAR", "TU TENER COSA BRILLANTE". No caen en bromas infantiles.

      ACCION REALIZADA POR (${gameState.character?.name}, ID: ${gameState.character?.id}): ${userInput}
      
      Responde ESTRICTAMENTE en JSON:
      {
        "narrative": "Respuesta grupal mencionando a los presentes y los diálogos NPCs",
        "targetPlayerId": "ID del jugador afectado específicamente (null si afecta a todos o a ninguno)",
        "hpDelta": 0,
        "itemGained": null,
        "nextRoomId": null,
        "gameStatus": "playing",
        "inCombat": false
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const responseContent = chatCompletion.choices[0].message.content;

    if (!responseContent) {
      throw new Error("La IA devolvió una respuesta vacía.");
    }

    const parsedResponse = JSON.parse(responseContent);

    // Si la IA no envía targetPlayerId, por defecto es quien realizó la acción
    if (parsedResponse.hpDelta !== 0 || parsedResponse.itemGained) {
      if (!parsedResponse.targetPlayerId) {
        parsedResponse.targetPlayerId = gameState.character?.id;
      }
    }

    return NextResponse.json(parsedResponse);

  } catch (error: any) {
    console.error("DETALLE DEL ERROR EN API/GAME:", error);
    return NextResponse.json({
      narrative: `El abismo consume tus palabras... (Error: ${error.message || 'Desconocido'})`,
      debug: error.toString()
    }, { status: 500 });
  }
}
