'use client';

import React, { useState } from 'react';
import { RACES, RaceType, Attributes, Player } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { Shield, Zap, Brain, Users, Swords, ChevronRight, AlertCircle } from 'lucide-react';

interface CharacterCreationProps {
    onComplete: (character: Player) => void;
}

export default function CharacterCreation({ onComplete }: CharacterCreationProps) {
    const [selectedRace, setSelectedRace] = useState<RaceType>('Humano');
    const [name, setName] = useState('');
    const [attributes, setAttributes] = useState<Attributes>(RACES['Humano'].baseAttributes);
    const [points, setPoints] = useState(5);

    const handleRaceSelect = (race: RaceType) => {
        setSelectedRace(race);
        setAttributes(RACES[race].baseAttributes);
        setPoints(5);
    };

    const handleComplete = () => {
        if (!name || points > 0) return;
        onComplete({
            id: Math.random().toString(36).substring(7),
            name,
            race: selectedRace,
            attributes,
            inventory: [],
            hp: 100,
            maxHp: 100
        });
    };

    const updateAttribute = (attr: keyof Attributes, delta: number) => {
        if (delta > 0 && points <= 0) return;
        if (delta < 0 && attributes[attr] <= RACES[selectedRace].baseAttributes[attr]) return;

        setAttributes(prev => ({
            ...prev,
            [attr]: prev[attr] + delta
        }));
        setPoints(prev => prev - delta);
    };

    const currentRace = RACES[selectedRace];

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-1000">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold tracking-tighter glow-text text-purple-400 uppercase">
                    FORJA TU DESTINO
                </h1>
                <p className="text-gray-500 uppercase text-xs tracking-[0.3em]">
                    Bienvenido a los Ecos de la Mazmorra
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Selección de Raza */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold border-b border-purple-900/50 pb-2 flex items-center gap-2 uppercase tracking-tighter">
                        <Users className="w-5 h-5 text-purple-500" /> SELECCIONA TU ESTIRPE
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {(Object.keys(RACES) as RaceType[]).map((raceKey) => (
                            <button
                                key={raceKey}
                                onClick={() => handleRaceSelect(raceKey)}
                                className={cn(
                                    "p-4 text-left transition-all border rounded-sm",
                                    selectedRace === raceKey
                                        ? "bg-purple-900/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                        : "bg-black/40 border-gray-800 text-gray-500 hover:border-gray-600"
                                )}
                            >
                                <div className="font-bold uppercase tracking-wider">{raceKey}</div>
                                <div className="text-[10px] mt-1 opacity-60 uppercase tracking-tighter">
                                    {RACES[raceKey].traits[0]}
                                    Encabezado
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="p-4 bg-black/60 border border-purple-900/30 rounded-sm space-y-3 min-h-[180px]">
                        <h3 className="text-purple-300 font-bold uppercase text-sm tracking-widest">
                            {currentRace.name}
                        </h3>
                        <p className="text-sm text-gray-400 leading-relaxed italic">
                            &quot;{currentRace.description}&quot;
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {currentRace.traits.map(trait => (
                                <span key={trait} className="px-2 py-0.5 bg-purple-900/40 border border-purple-500/30 text-[10px] uppercase text-purple-200 tracking-tighter font-bold">
                                    {trait}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Atributos y Nombre */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold border-b border-purple-900/50 pb-2 flex items-center gap-2 uppercase tracking-tighter">
                            <Swords className="w-5 h-5 text-purple-500" /> ATRIBUTOS Y NOMBRE
                        </h2>

                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="NOMBRE DEL AVENTURERO..."
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black border border-gray-800 p-3 text-purple-400 focus:outline-none focus:border-purple-500 uppercase tracking-widest text-sm font-bold"
                                />
                            </div>

                            <div className="p-4 bg-black/40 border border-purple-900/20 rounded-sm space-y-5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Puntos restantes:</span>
                                    <span className={cn("text-lg font-mono font-bold", points > 0 ? "text-purple-500 animate-pulse" : "text-gray-600")}>
                                        {points}
                                    </span>
                                </div>

                                <AttributeRow
                                    label="Fuerza"
                                    value={attributes.fuerza}
                                    icon={<Swords className="w-4 h-4" />}
                                    onAdd={() => updateAttribute('fuerza', 1)}
                                    onSub={() => updateAttribute('fuerza', -1)}
                                    min={currentRace.baseAttributes.fuerza}
                                    canAdd={points > 0}
                                />
                                <AttributeRow
                                    label="Agilidad"
                                    value={attributes.agilidad}
                                    icon={<Zap className="w-4 h-4" />}
                                    onAdd={() => updateAttribute('agilidad', 1)}
                                    onSub={() => updateAttribute('agilidad', -1)}
                                    min={currentRace.baseAttributes.agilidad}
                                    canAdd={points > 0}
                                />
                                <AttributeRow
                                    label="Intelecto"
                                    value={attributes.intelecto}
                                    icon={<Brain className="w-4 h-4" />}
                                    onAdd={() => updateAttribute('intelecto', 1)}
                                    onSub={() => updateAttribute('intelecto', -1)}
                                    min={currentRace.baseAttributes.intelecto}
                                    canAdd={points > 0}
                                />
                                <AttributeRow
                                    label="Presencia"
                                    value={attributes.presencia}
                                    icon={<Shield className="w-4 h-4" />}
                                    onAdd={() => updateAttribute('presencia', 1)}
                                    onSub={() => updateAttribute('presencia', -1)}
                                    min={currentRace.baseAttributes.presencia}
                                    canAdd={points > 0}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        disabled={!name || points > 0}
                        onClick={handleComplete}
                        className={cn(
                            "w-full py-4 flex items-center justify-center gap-2 border transition-all uppercase tracking-[0.2em] font-black group",
                            (!name || points > 0)
                                ? "border-gray-800 text-gray-700 cursor-not-allowed"
                                : "border-purple-500 bg-purple-900/20 text-white hover:bg-purple-500 hover:text-black shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                        )}
                    >
                        COMENZAR VIAJE <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {points > 0 && (
                        <div className="flex items-center gap-2 text-rose-500 text-[10px] uppercase tracking-wider justify-center font-bold">
                            <AlertCircle className="w-3 h-3" /> Distribuye todos los puntos para continuar
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AttributeRow({
    label,
    value,
    icon,
    onAdd,
    onSub,
    min,
    canAdd
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    onAdd: () => void;
    onSub: () => void;
    min: number;
    canAdd: boolean;
}) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3 text-gray-500 group-hover:text-purple-400 transition-colors uppercase font-bold text-[10px] tracking-widest">
                {icon}
                <span>{label}</span>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={onSub}
                    disabled={value <= min}
                    className="w-6 h-6 border border-gray-800 flex items-center justify-center hover:border-purple-500 disabled:opacity-30 transition-colors"
                >
                    -
                </button>
                <span className="w-4 text-center font-mono font-bold text-sm text-purple-300">{value}</span>
                <button
                    onClick={onAdd}
                    disabled={!canAdd}
                    className="w-6 h-6 border border-gray-800 flex items-center justify-center hover:border-purple-500 disabled:opacity-30 transition-colors"
                >
                    +
                </button>
            </div>
        </div>
    );
}
