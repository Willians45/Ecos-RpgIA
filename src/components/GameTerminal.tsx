'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, INITIAL_ROOMS, Room, Player } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { Send, Heart, Backpack, Users, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface GameTerminalProps {
    state: GameState;
    setState: React.Dispatch<React.SetStateAction<GameState | null>>;
}

interface PendingAction {
    playerId: string;
    playerName: string;
    content: string;
}

export default function GameTerminal({ state, setState }: GameTerminalProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [hasSentAction, setHasSentAction] = useState(false);
    const [lastDiceRolls, setLastDiceRolls] = useState<any[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Función unificada para aplicar el resultado de un turno
    const applyTurnResult = useCallback((payload: any) => {
        if (!payload.newState) return;

        setState(prev => {
            if (!prev || !prev.character) return prev;
            const serverState = payload.newState as GameState;

            // Fusionar historial sin duplicados
            const newHistory = [...prev.history];
            serverState.history.forEach(msg => {
                if (!newHistory.some(m => m.content === msg.content && m.role === msg.role)) {
                    newHistory.push(msg);
                }
            });

            if (payload.narrative && !newHistory.some(m => m.content === payload.narrative)) {
                newHistory.push({ role: 'assistant', content: payload.narrative });
            }

            const myUpdatedChar = serverState.players.find(p => p.id === prev.character!.id);

            return {
                ...prev,
                currentRoomId: serverState.currentRoomId,
                worldState: serverState.worldState,
                history: newHistory,
                players: serverState.players,
                character: myUpdatedChar || prev.character,
                inCombat: serverState.inCombat,
                gameStatus: serverState.gameStatus,
                isGameOver: serverState.isGameOver
            };
        });

        setPendingActions([]);
        setHasSentAction(false);
        setIsTyping(false);
        if (payload.diceRolls) setLastDiceRolls(payload.diceRolls);
    }, [setState]);

    // Derivar la sala actual del ID
    const currentRoom = INITIAL_ROOMS[state.currentRoomId] || INITIAL_ROOMS['start'];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [state.history, isTyping, pendingActions]);

    // Supabase Realtime: Broadcast y Presence
    useEffect(() => {
        if (!state.roomId || !state.character) return;

        const channel = supabase.channel(`room-${state.roomId}`, {
            config: {
                broadcast: { self: false }, // El líder ya se actualiza localmente
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
            .on('broadcast', { event: 'player_action' }, ({ payload }) => {
                setPendingActions(prev => {
                    const alreadyIn = prev.some(a => a.playerId === payload.playerId);
                    if (alreadyIn) return prev;
                    return [...prev, payload];
                });
            })
            .on('broadcast', { event: 'turn_complete' }, ({ payload }) => {
                applyTurnResult(payload);
            })
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const players: Player[] = [];
                Object.values(newState).forEach((presence: any) => {
                    if (presence[0]?.player) players.push(presence[0].player);
                });
                setOnlinePlayers(players);
                // No actualizamos state.players aquí para no sobreescribir datos de combate del motor
                // Solo usamos presence para la lista visual de "quién está online"
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ player: state.character, online_at: new Date().toISOString() });
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [state.roomId, state.character?.id, setState, applyTurnResult]);

    const isProcessing = useRef(false);

    // Lógica para procesar el turno
    useEffect(() => {
        const runTurn = async () => {
            // Condición: Tenemos todas las acciones y no estamos ya procesando
            const allReady = onlinePlayers.length > 0 && pendingActions.length >= onlinePlayers.length;

            if (allReady && !isProcessing.current && !isTyping) {
                const sortedPlayers = [...onlinePlayers].sort((a, b) => a.id.localeCompare(b.id));
                const isLeader = sortedPlayers[0].id === state.character?.id;

                if (isLeader) {
                    isProcessing.current = true;
                    setIsTyping(true);

                    try {
                        console.log("--- PROCESANDO TURNO (LÍDER) ---");
                        const response = await fetch('/api/game', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                gameState: state,
                                actions: pendingActions
                            })
                        });

                        const data = await response.json();

                        if (data.narrative && state.roomId) {
                            // Primero emitimos para los demás
                            await supabase.channel(`room-${state.roomId}`).send({
                                type: 'broadcast',
                                event: 'turn_complete',
                                payload: data
                            });
                            // Luego aplicamos localmente
                            applyTurnResult(data);
                        } else {
                            setIsTyping(false);
                        }
                    } catch (error) {
                        console.error("Error en turno:", error);
                        setIsTyping(false);
                    } finally {
                        isProcessing.current = false;
                    }
                } else {
                    // Seguidores: solo marcan visualmente que se está procesando
                    setIsTyping(true);
                }
            }
        };

        runTurn();
    }, [pendingActions.length, onlinePlayers.length, isTyping, state.roomId, applyTurnResult]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || hasSentAction || isTyping) return;

        const userAction: PendingAction = {
            playerId: state.character!.id,
            playerName: state.character!.name,
            content: input.trim()
        };

        if (state.roomId) {
            await supabase.channel(`room-${state.roomId}`).send({
                type: 'broadcast',
                event: 'player_action',
                payload: userAction
            });
        }

        // Optimista: me añado a mi lista local de pendientes
        setPendingActions(prev => [...prev, userAction]);
        setHasSentAction(true);
        setInput('');
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

                    {/* Vida */}
                    <div className="space-y-4">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500" /> HP</span>
                            <span className="font-mono text-white">{state.character.hp}/{state.character.maxHp}</span>
                        </div>
                        <div className="w-full bg-gray-900/50 h-1.5 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-gradient-to-r from-rose-700 to-rose-500 transition-all duration-500" style={{ width: `${(state.character.hp / state.character.maxHp) * 100}%` }} />
                        </div>
                    </div>

                    {/* Atributos */}
                    <div className="grid grid-cols-2 gap-2">
                        <StatBox label="FUE" value={state.character.attributes.fuerza} />
                        <StatBox label="AGI" value={state.character.attributes.agilidad} />
                        <StatBox label="INT" value={state.character.attributes.intelecto} />
                        <StatBox label="PRE" value={state.character.attributes.presencia} />
                    </div>

                    {/* Inventario Híbrido */}
                    <div className="space-y-2">
                        <h3 className="text-[9px] text-gray-500 uppercase tracking-widest flex items-center gap-2 font-black">
                            <Backpack className="w-3 h-3" /> Equipo
                        </h3>
                        <div className="text-[10px] space-y-1 bg-black/30 p-2 rounded-sm max-h-32 overflow-y-auto border border-white/5">
                            {state.character.inventory.length > 0 ? (
                                state.character.inventory.map((item, i) => (
                                    <div key={i} className="text-purple-300 flex items-center gap-1">• {item}</div>
                                ))
                            ) : (
                                <div className="text-gray-700 italic text-[9px]">Bolsillos vacíos...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Terminal Central */}
            <div className={cn("lg:col-span-3 flex flex-col border overflow-hidden relative rounded-sm shadow-2xl transition-all duration-700",
                state.inCombat ? "border-rose-600 bg-rose-950/5" : "terminal-border bg-black/40")}>

                {/* Header Turnos */}
                <div className="bg-black/80 border-b border-white/5 p-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {onlinePlayers.map(p => (
                                <div key={p.id} className={cn("w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-[8px] font-black uppercase transition-all",
                                    pendingActions.some(a => a.playerId === p.id) ? "bg-green-500 text-black scale-110" : "bg-gray-800 text-gray-500")}>
                                    {p.name[0]}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold">
                                {pendingActions.length >= onlinePlayers.length && onlinePlayers.length > 0
                                    ? "PROCESANDO RELATO..."
                                    : `ESPERANDO TURNOS (${pendingActions.length}/${onlinePlayers.length})`}
                            </span>
                            <span className="text-[8px] text-purple-500 font-mono tracking-widest">{currentRoom.name.toUpperCase()}</span>
                        </div>
                    </div>
                    {isTyping && <Clock className="w-3 h-3 text-purple-500 animate-spin" />}
                </div>

                {/* Visualización de Dados */}
                {lastDiceRolls.length > 0 && (
                    <div className="bg-purple-950/20 border-b border-purple-500/20 p-2 flex gap-2 overflow-x-auto">
                        {lastDiceRolls.map((roll, i) => (
                            <div key={i} className={cn("text-[9px] px-2 py-1 rounded-sm border flex items-center gap-2 whitespace-nowrap",
                                roll.success ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-rose-500/50 bg-rose-500/10 text-rose-400")}>
                                <div className="font-black">1d20</div>
                                <div className="font-bold text-xs">{roll.value}</div>
                                <div className="opacity-50">vs DC {roll.dc}</div>
                                <div className="font-black italic uppercase">{roll.success ? 'ÉXITO' : 'FALLO'}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Historial */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                    {state.history.map((msg, i) => (
                        <div key={i} className={cn("max-w-[85%] text-sm animate-in fade-in slide-in-from-bottom-2 duration-500",
                            msg.role === 'user' ? "ml-auto" : "mr-auto",
                            msg.role === 'system' && "w-full text-center text-[9px] text-gray-600 uppercase tracking-[0.3em] py-4 border-y border-white/5 my-4")}>
                            {msg.role !== 'system' && (
                                <div className={cn("p-4 rounded-sm transition-all hover:bg-opacity-80", msg.role === 'user' ? "bg-purple-900/10 border-r-2 border-purple-500" : "bg-gray-900/60 border-l-2 border-gray-400 text-gray-300 shadow-xl")}>
                                    <div className="text-[8px] uppercase tracking-[0.2em] mb-2 font-black text-gray-500 flex justify-between">
                                        <span>{msg.role === 'assistant' ? 'EL NARRADOR' : (msg.playerName || 'HÉROE')}</span>
                                        {msg.role === 'user' && <CheckCircle2 className="w-3 h-3 text-purple-500" />}
                                    </div>
                                    <p className="font-medium whitespace-pre-wrap leading-relaxed italic">{msg.content}</p>
                                </div>
                            )}
                            {msg.role === 'system' && msg.content}
                        </div>
                    ))}

                    {/* Pendientes */}
                    <div className="space-y-2 opacity-50 px-6">
                        {pendingActions.map((action, idx) => (
                            <div key={idx} className="text-[10px] text-gray-500 italic flex items-center gap-2 animate-pulse">
                                <span className="font-black uppercase">{action.playerName}:</span> &ldquo;{action.content}&rdquo;
                            </div>
                        ))}
                    </div>
                </div>

                {/* Input */}
                {!state.isGameOver ? (
                    <div className="p-4 border-t border-white/5 bg-black/80">
                        <form onSubmit={handleSubmit} className="flex items-center gap-4 relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={hasSentAction || isTyping}
                                autoFocus
                                placeholder={hasSentAction ? "El destino está siendo escrito..." : `¿Qué harás en ${currentRoom.name}?`}
                                className="flex-1 bg-transparent focus:outline-none text-purple-300 uppercase text-xs tracking-widest font-bold placeholder:text-gray-800"
                            />
                            <button type="submit" disabled={hasSentAction || isTyping || !input.trim()} className="text-purple-500 hover:text-purple-400 disabled:text-gray-900 transition-all">
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-black/95 border-t border-red-900 text-red-500 font-black uppercase text-[10px] tracking-[0.5em] cursor-pointer hover:bg-black transition-all" onClick={() => window.location.reload()}>
                        FIN DEL RELATO. CLICK PARA REENCARNAR.
                    </div>
                )}
            </div>

            {/* Panel Derecho */}
            <div className="lg:col-span-1 space-y-4">
                <div className="terminal-border bg-black/60 p-4 h-full flex flex-col">
                    <h3 className="text-[9px] text-purple-500 uppercase font-black border-b border-purple-900/30 pb-2 mb-4 flex items-center gap-2">
                        <Users className="w-3 h-3" /> Grupo ({onlinePlayers.length})
                    </h3>
                    <div className="space-y-4 overflow-y-auto flex-1">
                        {onlinePlayers.map(p => (
                            <div key={p.id} className={cn("p-2 border rounded-sm transition-all duration-500",
                                p.id === state.character?.id ? "border-purple-500/30 bg-purple-950/10" : "border-white/5 bg-black/40",
                                pendingActions.some(a => a.playerId === p.id) && "border-green-500/40 shadow-[0_0_10px_rgba(34,197,94,0.1)]")}>
                                <div className="flex justify-between text-[9px] font-bold">
                                    <span className={p.id === state.character?.id ? "text-purple-400" : "text-gray-400"}>{p.name}</span>
                                    {pendingActions.some(a => a.playerId === p.id) && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                </div>
                                <div className="w-full bg-gray-950 h-0.5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-700 transition-all duration-1000" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
                                </div>
                                <div className="mt-2 flex justify-between text-[7px] text-gray-600 font-mono">
                                    <span>HP: {p.hp}/{p.maxHp}</span>
                                    <span>{p.race}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="bg-purple-950/20 p-2 rounded-sm border border-purple-900/30">
                            <div className="text-[7px] text-purple-600 uppercase font-black tracking-widest mb-1">Código de Invitación</div>
                            <div className="text-[12px] font-mono text-white select-all text-center tracking-widest">{state.roomId}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-purple-950/20 border border-purple-900/30 p-2 text-center rounded-sm">
            <div className="text-[7px] text-gray-600 font-black uppercase tracking-tighter">{label}</div>
            <div className="text-[10px] font-mono text-purple-400 font-bold">{value}</div>
        </div>
    );
}
