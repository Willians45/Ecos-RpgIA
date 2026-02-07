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
  roomId: string | null;
  players: Player[];
  character: Player | null; // El jugador local
  currentRoom: Room;
  history: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    playerName?: string;
  }[];
  inCombat: boolean;
  isGameOver: boolean;
  gameStatus: 'playing' | 'victory' | 'death';
}

export interface Room {
  id: string;
  name: string;
  description: string;
  variables: Record<string, any>;
  entities: { name: string; description: string; race: string }[];
  exits: { direction: string; targetRoomId: string; condition?: string }[];
  goal?: string; // Objetivo para que la IA sepa cuándo cerrar la escena
}

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'start',
    name: 'La Celda de los Lamentos',
    description: 'Te despiertas en una celda húmeda. El olor a moho es insoportable. Un candelabro de hierro cuelga peligrosamente del techo. A través de los barrotes, ves a un guardia que parece estar quedándose dormido.',
    goal: 'Escapar de la celda (abrir la puerta o doblar los barrotes).',
    variables: {
      candelabro_estado: 'flojo',
      guardia_estado: 'dormitando',
      puerta_cerrada: true
    },
    entities: [
      { name: 'Guardia Orco', description: 'Un orco corpulento con una armadura de cuero remendada y una espada corta en el cinto. Apesta a grog barato.', race: 'Orco' }
    ],
    exits: [
      { direction: 'Norte', targetRoomId: 'hallway', condition: 'puerta_abierta' }
    ]
  },
  {
    id: 'hallway',
    name: 'Pasillo de la Vigilancia',
    description: 'Un pasillo angosto custodiado por un pesado portón de hierro al final. Este es el portón principal de la cárcel.',
    goal: 'Cruzar el portón principal para salir al exterior.',
    variables: {
      porton_cerrado: true
    },
    entities: [],
    exits: [
      { direction: 'Sur', targetRoomId: 'start' },
      { direction: 'Exterior', targetRoomId: 'victory_room', condition: 'porton_abierto' }
    ]
  },
  {
    id: 'victory_room',
    name: 'La Salida de la Libertad',
    description: 'El aire del exterior golpea tu rostro. Has escapado de la cárcel. Los Ecos de la Mazmorra se pierden a tus espaldas.',
    variables: {},
    entities: [],
    exits: []
  }
];
