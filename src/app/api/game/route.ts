import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { gameState, userInput } = await responseToJson(req);

        const systemPrompt = \`
      ERES EL MASTER DE UNA MAZMORRA SATÍRICA Y LETAL.
      
      REGLAS DE ORO:
      1. Eres un narrador crudo, oscuro y con humor negro. No ayudes al jugador.
      2. Mueren si fallan o intentan tonterías.
      3. Usa el contexto del grupo para narrar las consecuencias.
      
      CONTEXTO DEL GRUPO:
      \${gameState.players?.map((p: any) => \`- \${p.name} (\${p.race}): HP \${p.hp}/\${p.maxHp}\`).join('\\n') || '- Solo ' + gameState.character?.name}
      
      ENTORNO ACTUAL: \${gameState.currentRoom.name}
      \${gameState.currentRoom.description}
      
      ACCION DEL JUGADOR (\${gameState.character?.name}): \${userInput}
      
      FILOSOFÍA DEL MASTER (MODO LETAL):
      - Si hay hostilidad, activa "inCombat": true.
      - Decide éxito basado en lógica y atributos.
      
      Responde SOLO en JSON:
      {
        "narrative": "...",
        "hpDelta": 0,
        "itemGained": null,
        "nextRoomId": null,
        "gameStatus": "playing",
        "inCombat": false
      }
    \`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      model: 'llama3-70b-8192',
      response_format: { type: 'json_object' },
    });

    const responseText = chatCompletion.choices[0].message.content || '{}';
    return NextResponse.json(JSON.parse(responseText));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ narrative: "El abismo consume tus palabras... (Error de la IA)" }, { status: 500 });
  }
}

async function responseToJson(req: Request) {
    const body = await req.json();
    return body;
}
