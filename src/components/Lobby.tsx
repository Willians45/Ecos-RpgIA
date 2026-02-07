'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, Plus, ArrowRight } from 'lucide-react';

interface LobbyProps {
    onJoin: (roomId: string) => void;
    onCreate: () => void;
}

export default function Lobby({ onJoin, onCreate }: LobbyProps) {
    const [code, setCode] = useState('');

    return (
        <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold tracking-[0.2em] text-purple-500 uppercase glitch-text">
                    Portal de Mazmorra
                </h2>
                <p className="text-gray-500 text-xs tracking-widest uppercase">
                    Selecciona tu destino o únete a una expedición
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* Crear Partida */}
                <button
                    onClick={onCreate}
                    className="group flex flex-col items-center p-8 border border-purple-900/30 bg-purple-950/10 hover:bg-purple-900/20 transition-all rounded-sm space-y-4"
                >
                    <div className="p-4 rounded-full bg-purple-900/20 group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8 text-purple-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Nueva Expedición</h3>
                        <p className="text-xs text-gray-500 mt-1 uppercase">Crea un lobby privado</p>
                    </div>
                </button>

                {/* Unirse a Partida */}
                <div className="flex flex-col items-center p-8 border border-gray-800 bg-gray-900/10 space-y-4 rounded-sm">
                    <div className="p-4 rounded-full bg-gray-800/50">
                        <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="text-center w-full space-y-4">
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Unirse con Código</h3>
                            <p className="text-xs text-gray-500 mt-1 uppercase">Entra a una partida activa</p>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="CÓDIGO"
                                maxLength={6}
                                className="flex-1 bg-black border border-gray-800 p-2 text-center text-purple-400 font-mono tracking-widest focus:border-purple-500 outline-none"
                            />
                            <button
                                onClick={() => onJoin(code)}
                                disabled={code.length < 3}
                                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 p-2 transition-colors"
                            >
                                <ArrowRight className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
