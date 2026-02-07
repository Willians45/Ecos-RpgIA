'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameState, RACES, INITIAL_ROOMS, Room } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { Send, Heart, Shield, Backpack, History as HistoryIcon, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GameTerminalProps {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function GameTerminal({ state, setState }: GameTerminalProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [state.history, isTyping]);

    useEffect(() => {
        if (!state.roomId) return;

        const channel = supabase.channel(`room-${state.roomId}`, {
            config: {
                broadcast: { self: true },
            },
        })
            .on('broadcast', { event: 'new_message' }, ({ payload }) => {
                setState(prev => {
                    if (!prev) return null;
                    // Evitar mensajes duplicados
                    const alreadyExists = prev.history.some(m =>
                        m.content === payload.content &&
                        m.role === payload.role &&
                        m.playerName === payload.playerName
                    );
                    if (alreadyExists) return prev;

                    return {
                        ...prev,
                        history: [...prev.history, payload]
                    };
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [state.roomId, setState]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage = input;
        const playerName = state.character?.name;

        // Actualizar localmente e informar al resto
        setState(prev => prev ? ({
            ...prev,
            history: [...prev.history, { role: 'user', content: userMessage, playerName }]
        }) : null);

        if (state.roomId) {
            await supabase.channel(`room-\${state.roomId}`).send({
                type: 'broadcast',
                event: 'new_message',
                payload: { role: 'user', content: userMessage, playerName }
            });
        }

        setInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameState: state,
                    userInput: userMessage
                })
            });

            const data = await response.json();

            if (data.narrative) {
                // Broadcast de la respuesta del Master
                if (state.roomId) {
                    await supabase.channel(`room-\${state.roomId}`).send({
                        type: 'broadcast',
                        event: 'new_message',
                        payload: { role: 'assistant', content: data.narrative }
                    });
                }

                let nextRoom = state.currentRoom;
                if (data.nextRoomId) {
                    const room = INITIAL_ROOMS.find((r: Room) => r.id === data.nextRoomId);
                    if (room) nextRoom = room;
                }

                setState(prev => {
                    if (!prev || !prev.character) return prev;

                    const newInventory = data.itemGained && !prev.character.inventory.includes(data.itemGained)
                        ? [...prev.character.inventory, data.itemGained]
                        : prev.character.inventory;

                    return {
                        ...prev,
                        history: [...prev.history, { role: 'assistant', content: data.narrative }],
                        character: {
                            ...prev.character,
                            hp: Math.max(0, prev.character.hp + (data.hpDelta || 0)),
                            inventory: newInventory
                        },
                        currentRoom: nextRoom,
                        inCombat: data.inCombat !== undefined ? data.inCombat : prev.inCombat,
                        gameStatus: data.gameStatus || prev.gameStatus,
                        isGameOver: data.gameStatus === 'victory' || data.gameStatus === 'death'
                    };
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsTyping(false);
        }
    };

    if (!state.character) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[80vh] animate-in slide-in-from-bottom-8 duration-1000">
            {/* Panel Lateral: Estadísticas */}
            <div className="lg:col-span-1 space-y-4">
                <div className="terminal-border bg-black/60 p-4 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-purple-400 uppercase tracking-tighter glow-text">
                            {state.character.name}
                        </h2>
                        <div className="bg-purple-900/40 px-2 py-0.5 border border-purple-500/50">
                            <span className="text-[8px] font-bold text-purple-300">ID: {state.roomId}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs uppercase">
                            <span className="flex items-center gap-2 tracking-widest text-gray-400 font-bold"><Heart className="w-3 h-3 text-rose-500" /> HP</span>
                            <span className="font-mono text-white">{state.character.hp}/{state.character.maxHp}</span>
                        </div>
                        <div className="w-full bg-gray-900 h-1.5 rounded-sm overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-rose-700 to-rose-500 transition-all duration-500"
                                style={{ width: `${(state.character.hp / state.character.maxHp) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <StatBox label="FUE" value={state.character.attributes.fuerza} />
                        <StatBox label="AGI" value={state.character.attributes.agilidad} />
                        <StatBox label="INT" value={state.character.attributes.intelecto} />
                        <StatBox label="PRE" value={state.character.attributes.presencia} />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2 font-bold mb-2">
                            <Backpack className="w-3 h-3" /> Equipo
                        </h3>
                        <div className="text-[11px] space-y-1 bg-black/30 p-2 rounded-sm max-h-32 overflow-y-auto border border-white/5">
                            {state.character.inventory.length > 0 ? (
                                state.character.inventory.map((item, i) => (
                                    <div key={i} className="text-purple-300 flex items-center gap-2 uppercase tracking-tighter">• {item}</div>
                                ))
                            ) : (
                                <div className="text-gray-700 italic text-[10px]">Nada en las manos...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel Principal: Terminal */}
            <div className={cn(
                "lg:col-span-3 flex flex-col border transition-all duration-500 overflow-hidden relative rounded-sm shadow-2xl",
                state.inCombat
                    ? "border-rose-600 bg-rose-950/10 shadow-[0_0_50px_rgba(225,29,72,0.2)]"
                    : "terminal-border bg-black/40"
            )}>
                {state.inCombat && (
                    <div className="absolute top-0 left-0 right-0 bg-rose-600 text-black text-[10px] font-black text-center py-1 tracking-[0.5em] animate-pulse z-20 uppercase">
                        -- MODO COMBATE : RESOLUCIÓN POR TURNOS --
                    </div>
                )}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
                >
                    {state.history.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "max-w-[85%] text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500",
                                msg.role === 'user'
                                    ? "ml-auto"
                                    : "mr-auto"
                            )}
                        >
                            <div className={cn(
                                "p-4 rounded-sm",
                                msg.role === 'user'
                                    ? "bg-purple-900/20 border-r-4 border-purple-500 text-purple-100"
                                    : "bg-gray-900/20 border-l-4 border-gray-600 text-gray-300"
                            )}>
                                {msg.role === 'assistant' ? (
                                    <div className="text-[10px] text-purple-500 uppercase tracking-[0.3em] mb-2 font-black italic">
                                        MASTER
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mb-2 font-black text-right">
                                        {msg.playerName || 'HÉROE'}
                                    </div>
                                )}
                                <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="text-gray-600 italic text-xs animate-pulse flex items-center gap-2 ml-4">
                            <HistoryIcon className="w-3 h-3 animate-spin" /> Ecos de la mazmorra se agitan...
                        </div>
                    )}
                </div>

                {/* Input Area */}
                {state.isGameOver ? (
                    <div className={cn(
                        "p-10 text-center border-t font-black uppercase tracking-[0.3em] space-y-4",
                        state.gameStatus === 'victory' ? "bg-green-950/30 text-green-400 border-green-500" : "bg-red-950/30 text-red-500 border-red-500 shadow-inner"
                    )}>
                        <h2 className="text-2xl italic scale-110">{state.gameStatus === 'victory' ? "EPIC VICTORIA" : "TUS ECOS SE APAGAN"}</h2>
                        <p className="text-[10px] opacity-70">
                            {state.gameStatus === 'victory' ? "HUIDA COMPLETADA" : "EL ABISMO TE HA RECLAMADO"}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 border border-current text-[10px] hover:bg-current hover:text-black transition-all font-black"
                        >
                            INICIAR NUEVO RELATO
                        </button>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="p-6 border-t border-purple-900/30 bg-black/60 flex items-center gap-4 group"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isTyping}
                            autoFocus
                            placeholder="Escribe tu destino..."
                            className="flex-1 bg-transparent border-none focus:outline-none text-purple-400 placeholder:text-gray-800 uppercase text-xs tracking-[0.2em] font-bold"
                        />
                        <button
                            type="submit"
                            disabled={isTyping || !input.trim()}
                            className="p-3 text-purple-500 hover:text-purple-400 hover:scale-110 disabled:text-gray-900 disabled:scale-100 transition-all"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function StatBox({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-purple-950/20 border border-purple-900/40 p-2 text-center rounded-sm">
            <div className="text-[8px] text-gray-500 font-black tracking-tighter uppercase">{label}</div>
            <div className="text-sm font-mono text-purple-400 font-bold">{value}</div>
        </div>
    );
}
