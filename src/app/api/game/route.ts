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
      
      REGLAS DE ORO:
      1. Eres un narrador crudo, oscuro y con humor negro. No ayudes al jugador.
      2. Mueren si fallan o intentan tonterías. Basado en lógica y atributos.
      3. Usa el contexto del grupo para narrar las consecuencias.
      
      CONTEXTO DEL GRUPO:
      ${gameState.players?.map((p: any) => `- ${p.name} (${p.race}): HP ${p.hp}/${p.maxHp}`).join('\n') || '- Solo ' + gameState.character?.name}
      
      ENTORNO ACTUAL: ${gameState.currentRoom?.name || 'Lugar Desconocido'}
      ${gameState.currentRoom?.description || 'Oscuridad total.'}
      
      PERSONAJE ACTUAL REALIZANDO LA ACCIÓN:
      - Nombre: ${gameState.character?.name}
      - Raza: ${gameState.character?.race}
      - Inventario: ${gameState.character?.inventory?.join(', ') || 'Vacío'}
      
      ACCION DEL JUGADOR: ${userInput}
      
      FILOSOFÍA DEL MASTER (MODO LETAL):
      - Si hay hostilidad o peligro inminente, activa "inCombat": true.
      - Si el jugador hace algo estúpido, resta HP (hpDelta negativo).
      
      Responde ESTRICTAMENTE en JSON:
      {
        "narrative": "Tu respuesta narrativa aquí",
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
      temperature: 0.7,
    });

    const responseContent = chatCompletion.choices[0].message.content;

    if (!responseContent) {
      throw new Error("La IA devolvió una respuesta vacía.");
    }

    return NextResponse.json(JSON.parse(responseContent));

  } catch (error: any) {
    console.error("DETALLE DEL ERROR EN API/GAME:", error);

    // Devolvemos más info al usuario para depurar (solo en desarrollo o temporalmente)
    return NextResponse.json({
      narrative: `El abismo consume tus palabras... (Error: ${error.message || 'Desconocido'})`,
      debug: error.toString()
    }, { status: 500 });
  }
}
