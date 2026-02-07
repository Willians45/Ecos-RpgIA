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
    description: 'Te despiertas en una celda húmeda. El aire huele a moho y desesperación. Un orco gigante te observa tras los barrotes mientras juega con un candelabro de hierro.',
    entities: [
      {
        id: 'guardia_orco',
        name: 'Guardia Orco',
        description: 'Un orco corpulento con una armadura de cuero remendada. Parece aburrido pero peligroso.',
        race: 'Orco',
        hp: 30,
        maxHp: 30,
        damage: 8,
        isEnemy: true,
        missingFlag: 'guardia_muerto'
      }
    ],
    items: [
      {
        id: 'candelabro',
        name: 'Candelabro de Hierro',
        description: 'Pesado y contundente. El guardia lo usa para distraerse.',
        isTakeable: true,
        missingFlag: 'candelabro_tomado',
        requiredFlag: 'guardia_distraido' // Solo se puede tomar si está distraído o muerto
      }
    ],
    exits: [
      {
        direction: 'Norte',
        targetRoomId: 'hallway',
        condition: 'puerta_celda_abierta',
        lockedMessage: 'La puerta de hierro está cerrada con llave.'
      }
    ]
  },
  'hallway': {
    id: 'hallway',
    name: 'Pasillo de la Vigilancia',
    description: 'Un corredor estrecho iluminado por antorchas parpadeantes. Al fondo se ve la salida.',
    entities: [],
    items: [],
    exits: [
      { direction: 'Sur', targetRoomId: 'start' },
      {
        direction: 'Exterior',
        targetRoomId: 'victory_room',
        condition: 'llave_tomada',
        lockedMessage: 'Necesitas la llave del guardia para salir.'
      }
    ]
  },
  'victory_room': {
    id: 'victory_room',
    name: 'Libertad',
    description: 'El aire fresco de la libertad te golpea. Has escapado de los Ecos de la Mazmorra.',
    entities: [],
    items: [],
    exits: []
  }
};
