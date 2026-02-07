'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GameState, INITIAL_ROOMS, Room, Player } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { Send, Heart, Backpack, Users, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GameTerminalProps {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

export default function GameTerminal({ state, setState }: GameTerminalProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [state.history, isTyping]);

    // Supabase Realtime: Broadcast y Presence
    useEffect(() => {
        if (!state.roomId || !state.character) return;

        const channel = supabase.channel(`room-${state.roomId}`, {
            config: {
                broadcast: { self: true },
                presence: { key: state.character.id },
            },
        });

        channel
            .on('broadcast', { event: 'new_message' }, ({ payload }) => {
                setState(prev => {
                    if (!prev) return null;
                    const alreadyExists = prev.history.some(m =>
                        m.content === payload.content &&
                        m.role === payload.role &&
                        m.playerName === payload.playerName
                    );
                    if (alreadyExists) return prev;
                    return { ...prev, history: [...prev.history, payload] };
                });
            })
            .on('broadcast', { event: 'sync_world' }, ({ payload }) => {
                // Sincronización global del mundo disparada por el Master
                setState(prev => {
                    if (!prev || !prev.character) return prev;

                    // 1. Texto de la narrativa para todos
                    const newHistory = [...prev.history];
                    if (!newHistory.some(m => m.content === payload.narrative)) {
                        newHistory.push({ role: 'assistant', content: payload.narrative });
                    }

                    // 2. Cambio de sala para todos
                    let nextRoom = prev.currentRoom;
                    if (payload.nextRoomId) {
                        const room = INITIAL_ROOMS.find((r: Room) => r.id === payload.nextRoomId);
                        if (room) nextRoom = room;
                    }

                    // 3. Efectos individuales (Daño u Objetos)
                    const isTarget = prev.character.id === payload.targetPlayerId;
                    const updatedCharacter = { ...prev.character };

                    if (isTarget) {
                        if (payload.hpDelta) {
                            updatedCharacter.hp = Math.max(0, updatedCharacter.hp + payload.hpDelta);
                        }
                        if (payload.itemGained && !updatedCharacter.inventory.includes(payload.itemGained)) {
                            updatedCharacter.inventory = [...updatedCharacter.inventory, payload.itemGained];
                        }
                    }

                    return {
                        ...prev,
                        history: newHistory,
                        currentRoom: nextRoom,
                        character: updatedCharacter,
                        inCombat: payload.inCombat !== undefined ? payload.inCombat : prev.inCombat,
                        gameStatus: payload.gameStatus || prev.gameStatus,
                        isGameOver: payload.gameStatus === 'victory' || payload.gameStatus === 'death'
                    };
                });
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const players: Player[] = [];
                Object.values(newState).forEach((presence: any) => {
                    if (presence[0]?.player) players.push(presence[0].player);
                });
                setOnlinePlayers(players);
                setState(prev => prev ? ({ ...prev, players }) : null);
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                const p = newPresences[0]?.player as Player;
                if (p && p.id !== state.character?.id) {
                    setState(prev => prev ? ({
                        ...prev,
                        history: [...prev.history, { role: 'system', content: `${p.name} se ha unido a la expedición.` }]
                    }) : null);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ player: state.character, online_at: new Date().toISOString() });
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [state.roomId, state.character?.id, setState]);

    // Tracking de estadísticas para Presence
    useEffect(() => {
        if (!state.roomId || !state.character) return;
        const channel = supabase.channel(`room-${state.roomId}`);
        channel.track({ player: state.character, online_at: new Date().toISOString() });
    }, [state.character?.hp, state.character?.inventory, state.roomId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage = input;
        const playerName = state.character?.name;

        // Actualizar localmente mis mensajes
        setState(prev => prev ? ({
            ...prev,
            history: [...prev.history, { role: 'user', content: userMessage, playerName }]
        }) : null);

        // Broadcast de mi mensaje
        if (state.roomId) {
            await supabase.channel(`room-${state.roomId}`).send({
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
                body: JSON.stringify({ gameState: state, userInput: userMessage })
            });

            const data = await response.json();

            if (data.narrative && state.roomId) {
                // Broadcast de la respuesta del Master para SINCRONIZAR EL MUNDO
                await supabase.channel(`room-${state.roomId}`).send({
                    type: 'broadcast',
                    event: 'sync_world',
                    payload: data
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[85vh] animate-in slide-in-from-bottom-8 duration-1000">
            {/* Stats Locales */}
            <div className="lg:col-span-1 hidden lg:block">
                <div className="terminal-border bg-black/60 p-4 space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-purple-400 uppercase tracking-tighter glow-text">{state.character.name}</h2>
                        <div className="text-[9px] text-gray-500 font-black">{state.character.race}</div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                            <span>Vida</span>
                            <span>{state.character.hp}/{state.character.maxHp}</span>
                        </div>
                        <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-600 transition-all duration-500" style={{ width: `${(state.character.hp / state.character.maxHp) * 100}%` }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        <StatBox label="FUE" value={state.character.attributes.fuerza} />
                        <StatBox label="AGI" value={state.character.attributes.agilidad} />
                        <StatBox label="INT" value={state.character.attributes.intelecto} />
                        <StatBox label="PRE" value={state.character.attributes.presencia} />
                    </div>
                </div>
            </div>

            {/* Terminal Central */}
            <div className={cn("lg:col-span-3 flex flex-col border overflow-hidden relative rounded-sm shadow-2xl",
                state.inCombat ? "border-rose-600 bg-rose-950/10" : "terminal-border bg-black/40")}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {state.history.map((msg, i) => (
                        <div key={i} className={cn("max-w-[90%] text-sm animate-in fade-in slide-in-from-bottom-2 duration-500",
                            msg.role === 'user' ? "ml-auto" : "mr-auto",
                            msg.role === 'system' && "w-full text-center text-[10px] text-gray-600 uppercase tracking-widest py-4")}>
                            {msg.role !== 'system' && (
                                <div className={cn("p-4 rounded-sm", msg.role === 'user' ? "bg-purple-900/10 border-r-2 border-purple-500" : "bg-gray-900/40 border-l-2 border-gray-600 text-gray-300")}>
                                    <div className="text-[9px] uppercase tracking-widest mb-1 font-black text-gray-500">
                                        {msg.role === 'assistant' ? 'EL MASTER' : (msg.playerName || 'HÉROE')}
                                    </div>
                                    <p className="font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                </div>
                            )}
                            {msg.role === 'system' && msg.content}
                        </div>
                    ))}
                </div>
                {!state.isGameOver ? (
                    <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-black/60 flex items-center gap-4">
                        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} autoFocus placeholder="¿Qué hacéis?" className="flex-1 bg-transparent focus:outline-none text-purple-300 uppercase text-xs tracking-widest font-bold" />
                    </form>
                ) : (
                    <div className="p-6 text-center bg-black/90 border-t border-red-900 text-red-500 font-black uppercase text-xs tracking-widest cursor-pointer" onClick={() => window.location.reload()}>
                        TUS ECOS SE HAN APAGADO. CLICK PARA REINTENTAR.
                    </div>
                )}
            </div>

            {/* Lista de Héroes */}
            <div className="lg:col-span-1 space-y-4">
                <div className="terminal-border bg-black/60 p-4 h-full">
                    <h3 className="text-[10px] text-purple-500 uppercase font-black border-b border-purple-900/30 pb-2 mb-4">Héroes ({onlinePlayers.length})</h3>
                    <div className="space-y-3 overflow-y-auto max-h-[70vh]">
                        {onlinePlayers.map(p => (
                            <div key={p.id} className="p-2 bg-black/40 border border-white/5 rounded-sm">
                                <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                    <span>{p.name} {p.id === state.character?.id ? '(Tú)' : ''}</span>
                                    <span>{p.race}</span>
                                </div>
                                <div className="w-full bg-gray-900 h-0.5 mt-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-600 transition-all duration-1000" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 text-[10px] font-mono text-center text-gray-500">{state.roomId}</div>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-purple-950/20 border border-purple-900/30 p-2 text-center rounded-sm">
            <div className="text-[7px] text-gray-600 font-black uppercase">{label}</div>
            <div className="text-[10px] font-mono text-purple-400 font-bold">{value}</div>
        </div>
    );
}
