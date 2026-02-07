import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("ERROR: GROQ_API_KEY no configurada.");
      return NextResponse.json({ narrative: "El Master está mudo." }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const { gameState, actions } = await req.json();

    if (!gameState || !actions || !Array.isArray(actions)) {
      return NextResponse.json({ narrative: "Caos en la comunicación mística." }, { status: 400 });
    }

    const systemPrompt = `
      ERES EL MASTER DE UNA MAZMORRA SATÍRICA, LETAL Y ULTRA-REALISTA.
      
      MISIÓN:
      Recibes las acciones de un GRUPO de jugadores. Debes resolverlas SIMULTÁNEAMENTE en un solo relato crudo y oscuro.
      
      REGLAS DE RIGOR (DIFICULTAD LETAL++):
      1. REALISMO FÍSICO: Un empujón no mata. Un golpe de espada en el pecho sí. El entorno es peligroso.
      2. TIRADAS EXIGENTES: El éxito depende de los atributos. Ignora la suerte fácil. Si intentan algo tonto, CASTÍGALOS.
      3. DIALECTO FIEL: Los orcos deben hablar como orcos ("TU SER BASURA", "YO ROMPER HUESOS"). 
      4. NARRATIVA COLECTIVA: Enlaza las acciones de todos los jugadores. Si A empuja y B ataca, narra cómo esas dos cosas ocurren a la vez.

      LISTA DE JUGADORES Y SUS ATRIBUTOS:
      ${gameState.players?.map((p: any) => `- ID: ${p.id}, Nombre: ${p.name}, Atributos: ${JSON.stringify(p.attributes)}, HP: ${p.hp}/${p.maxHp}`).join('\n')}

      ENTORNO ACTUAL: ${gameState.currentRoom?.name}
      ${gameState.currentRoom?.description}
      ENTIDADES: ${gameState.currentRoom?.entities?.map((e: any) => `${e.name} (${e.race})`).join(', ')}

      ACCIONES DEL TURNO ACTUAL:
      ${actions.map(a => `- ${a.playerName} (ID: ${a.playerId}): "${a.content}"`).join('\n')}
      
      RESPONDE EN JSON ESTRICTO:
      {
        "narrative": "Relato que resuelve TODAS las acciones del grupo con rigor y consecuencias.",
        "targetPlayerId": "ID del jugador que sufre el mayor cambio (daño/item), puede ser null si no hay un blanco único",
        "hpDelta": 0,
        "itemGained": null,
        "nextRoomId": "ID de la siguiente sala si el grupo avanza (null si siguen aquí)",
        "inCombat": false,
        "gameStatus": "playing"
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.65, // Un poco más bajo para ser más consistente y riguroso
    });

    const responseContent = chatCompletion.choices[0].message.content;
    if (!responseContent) throw new Error("IA vacía.");

    return NextResponse.json(JSON.parse(responseContent));

  } catch (error: any) {
    console.error("ERROR API:", error);
    return NextResponse.json({ narrative: `El abismo parpadea... ${error.message}` }, { status: 500 });
  }
}
