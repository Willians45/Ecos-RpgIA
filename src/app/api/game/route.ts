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
      - Si el jugador hace algo estúpido o intenta una broma floja, sé cruel.
      - Tu prioridad es la consistencia del mundo y la letalidad.

      GUÍA DE NPCs (ORCOS):
      - Los orcos son brutos, agresivos y de gramática simplificada.
      - Dialecto: "YO MACHACAR", "TU SER COMIDA", "HUELES A MIEDO". No usan palabras sofisticadas.
      - Psicología: No caen en bromas infantiles. Son impulsivos pero muy territoriales.
      - Vulnerabilidad: Solo caen ante "jugarretas" o tretas que involucren sus instintos (comida, ganchos de pelea, odio a otras razas) si el jugador las describe con detalle y lógica.

      REGLAS DE RESOLUCIÓN:
      1. Evalúa el intento del jugador basado en sus atributos (${JSON.stringify(gameState.character?.attributes)}).
      2. NPCs como el "Guardia Orco" reaccionarán con violencia inmediata ante insultos o intentos fallidos de engaño.
      3. No permitas que el jugador avance "porque sí". Cada paso debe ser sudado.

      CONTEXTO DEL GRUPO:
      ${gameState.players?.map((p: any) => `- ${p.name} (${p.race}): HP ${p.hp}/${p.maxHp}`).join('\n') || '- Solo ' + gameState.character?.name}
      
      ENTORNO ACTUAL: ${gameState.currentRoom?.name || 'Lugar Desconocido'}
      ${gameState.currentRoom?.description || 'Oscuridad total.'}
      Objetivo de la zona: ${gameState.currentRoom?.goal || 'Sobrevivir'}
      ENTIDADES PRESENTES: ${gameState.currentRoom?.entities?.map((e: any) => `${e.name} (${e.race}): ${e.description}`).join(' | ') || 'Ninguna'}
      
      PERSONAJE ACTUAL REALIZANDO LA ACCIÓN:
      - Nombre: ${gameState.character?.name}
      - Raza: ${gameState.character?.race}
      - Inventario: ${gameState.character?.inventory?.join(', ') || 'Vacío'}
      
      ACCION DEL JUGADOR: ${userInput}
      
      Responde ESTRICTAMENTE en JSON:
      {
        "narrative": "Tu respuesta narrativa incluyendo diálogos de NPCs si los hay",
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

    return NextResponse.json(JSON.parse(responseContent));

  } catch (error: any) {
    console.error("DETALLE DEL ERROR EN API/GAME:", error);
    return NextResponse.json({
      narrative: `El abismo consume tus palabras... (Error: ${error.message || 'Desconocido'})`,
      debug: error.toString()
    }, { status: 500 });
  }
}
