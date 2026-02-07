export type RaceType = 'Humano' | 'Elfo' | 'Enano' | 'Orco';

export interface Attributes {
  fuerza: number;
  agilidad: number;
  intelecto: number;
  presencia: number;
}

export interface Race {
  name: RaceType;
  description: string;
  traits: string[];
  baseAttributes: Attributes;
  prejudices: Record<string, string>;
}

export const RACES: Record<RaceType, Race> = {
  Humano: {
    name: 'Humano',
    description: 'Equilibrados y ambiciosos. Poseen una aptitud natural para la magia pero son vulnerables a la manipulación mental.',
    traits: ['Aptitud Mágica', 'Vulnerable Mentalmente'],
    baseAttributes: { fuerza: 5, agilidad: 5, intelecto: 5, presencia: 5 },
    prejudices: {
      Elfo: 'Fascinación por su nobleza',
      Enano: 'Tolerancia',
      Orco: 'Odio profundo',
      Goblin: 'Odio profundo'
    }
  },
  Elfo: {
    name: 'Elfo',
    description: 'Seres gráciles y casi inmortales. Valoran la sabiduría por encima de todo; la estupidez es su mayor tabú.',
    traits: ['Resistencia Mágica', 'Gracia Natural', 'Prestigio Frágil'],
    baseAttributes: { fuerza: 3, agilidad: 7, intelecto: 7, presencia: 3 },
    prejudices: {
      Humano: 'Tolerancia condescendiente',
      Enano: 'Insoportables',
      Orco: 'Aversión total',
      Demonio: 'Aborrecimiento'
    }
  },
  Enano: {
    name: 'Enano',
    description: 'Fuertes, astutos y amantes de la buena cerveza. Incapaces de usar magia, pero extremadamente resistentes a ella.',
    traits: ['Inmune al Control Mental', 'Resistencia Mágica Superior', 'Almas Libres'],
    baseAttributes: { fuerza: 8, agilidad: 3, intelecto: 2, presencia: 7 },
    prejudices: {
      Humano: 'Tolerancia comercial',
      Elfo: 'Prepotentes de orejas largas',
      Orco: 'Enemigos ancestrales'
    }
  },
  Orco: {
    name: 'Orco',
    description: 'Parias impulsivos buscadores de reconocimiento. Poseen gran potencial pero caen fácilmente ante sus instintos.',
    traits: ['Impulsividad Salvaje', 'Gran Potencial Mágico', 'Debilidad Mental'],
    baseAttributes: { fuerza: 9, agilidad: 4, intelecto: 1, presencia: 6 },
    prejudices: {
      Humano: 'Envidia',
      Elfo: 'Detestables',
      Enano: 'Tolerancia',
      Orco: 'Desprecio por los intelectuales'
    }
  }
};

export interface Player {
  id: string;
  name: string;
  race: RaceType;
  attributes: Attributes;
  hp: number;
  maxHp: number;
  inventory: string[];
}

export interface GameState {
  roomId: string | null; // ID de la sala de Supabase (lobby)
  players: Player[];
  character: Player | null; // El jugador local
  currentRoomId: string; // ID de la sala lógica del juego (start, hallway)
  worldState: Record<string, boolean>; // Flags globales: 'guardia_muerto', 'puerta_abierta'
  history: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    playerName?: string;
  }[];
  inCombat: boolean;
  isGameOver: boolean;
  gameStatus: 'playing' | 'victory' | 'death';
}

export interface RoomEntity {
  id: string;
  name: string;
  description: string;
  race?: string;
  hp?: number; // Si tiene HP, es combatible
  maxHp?: number;
  damage?: number; // Daño base que hace
  isEnemy?: boolean;
  requiredFlag?: string; // Solo aparece si esta flag es TRUE
  missingFlag?: string; // Solo aparece si esta flag es FALSE (ej. si guardia_muerto es true, el guardia vivo desaparece)
}

export interface RoomItem {
  id: string;
  name: string;
  description: string;
  isTakeable: boolean;
  requiredFlag?: string;
  missingFlag?: string; // Si 'candelabro_tomado' es true, el item desaparece
}

export interface RoomExit {
  direction: string;
  targetRoomId: string;
  condition?: string; // Flag requerida para usar la salida (ej: 'puerta_abierta')
  lockedMessage?: string; // Mensaje si está bloqueada
}

export interface Room {
  id: string;
  name: string;
  description: string;
  entities: RoomEntity[];
  items: RoomItem[];
  exits: RoomExit[];
}

export const INITIAL_ROOMS: Record<string, Room> = {
  'start': {
    id: 'start',
    name: 'La Celda de los Lamentos',
    description: 'Te despiertas en una celda húmeda. El olor a moho es insoportable. Un candelabro de hierro cuelga peligrosamente del techo.',
    entities: [
      {
        id: 'guardia_orco',
        name: 'Guardia Orco',
        description: 'Un orco corpulento con una armadura de cuero remendada. Parece aburrido pero peligroso.',
        race: 'Orco',
        hp: 20,
        maxHp: 20,
        damage: 6,
        isEnemy: true,
        missingFlag: 'guardia_muerto' // Desaparece si está muerto
      },
      {
        id: 'cadaver_guardia',
        name: 'Cuerpo del Guardia Orco',
        description: 'El cuerpo sin vida del orco yace en el suelo, soltando un charco de sangre oscura.',
        requiredFlag: 'guardia_muerto' // Aparece solo si el guardia murió
      }
    ],
    items: [
      {
        id: 'candelabro',
        name: 'Candelabro Oxidado',
        description: 'Viejo, pesado y con bordes afilados. Podría servir como arma.',
        isTakeable: true,
        missingFlag: 'candelabro_tomado'
      },
      {
        id: 'llave_celda',
        name: 'Llave de la Celda',
        description: 'Una llave tosca de hierro. Estaba en el cinto del guardia.',
        isTakeable: true,
        requiredFlag: 'guardia_muerto', // Solo accesible si matas al guardia (o se la robas con skill check, lógica futura)
        missingFlag: 'llave_tomada'
      }
    ],
    exits: [
      {
        direction: 'Norte',
        targetRoomId: 'hallway',
        condition: 'puerta_celda_abierta',
        lockedMessage: 'La puerta de la celda está cerrada. Necesitas abrirla o romperla.'
      }
    ]
  },
  'hallway': {
    id: 'hallway',
    name: 'Pasillo de la Vigilancia',
    description: 'Un pasillo angosto de piedra. Antorchas parpadean en las paredes.',
    entities: [],
    items: [],
    exits: [
      { direction: 'Sur', targetRoomId: 'start' },
      {
        direction: 'Exterior',
        targetRoomId: 'victory_room',
        condition: 'porton_principal_abierto',
        lockedMessage: 'El gran portón de hierro está cerrado a cal y canto.'
      }
    ]
  },
  'victory_room': {
    id: 'victory_room',
    name: 'Libertad',
    description: 'El aire fresco de la noche te golpea. Eres libre.',
    entities: [],
    items: [],
    exits: []
  }
};
