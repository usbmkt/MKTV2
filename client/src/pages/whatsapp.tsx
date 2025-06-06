// client/src/pages/whatsapp.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    MessageSquare, ListChecks, Trash2 as IconTrash, Image as ImageIcon, Clock, Variable, Waypoints, HelpCircle, Settings, Plus, RefreshCw, Send, RadioTower, UserCheck, LogOut, Save, Play, Square, Filter as FilterIcon, Layers, Activity, Workflow, Target, Mic, FileText as FileIcon, MapPin, Repeat, Webhook, Sparkles, X, AlertTriangle, Bot, FileTerminal, Clock10, Tag, Shuffle,
    MessageCircle as MsgIcon, Phone, Search, MoreVertical, Check, CheckCheck, Paperclip, Smile, Users, TrendingUp,
    Loader2
} from 'lucide-react';

import {
    ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Node, Edge, OnConnect, BackgroundVariant, MarkerType, Position, Handle, NodeProps, useReactFlow, ReactFlowProvider, NodeOrigin, Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    FlowData, CampaignSelectItem, NodeContextMenuProps as FlowNodeContextMenuProps, ButtonOption, ListItem, ListSection,
    GPTQueryNodeData, TextMessageNodeData, ButtonMessageNodeData, ImageNodeData, AudioNodeData, FileNodeData, LocationNodeData, ListMessageNodeData, DelayNodeData, WaitInputNodeData, SetVariableNodeData, ConditionNodeData, TimeConditionNodeData, LoopNodeData, ApiCallNodeData, WebhookCallNodeData, AIAgentNodeData, AssignAgentNodeData, EndFlowNodeData, GoToFlowNodeData, TagContactNodeData,
    AllNodeDataTypes, Campaign as CampaignType
} from '@/types/zapTypes';
import NodeContextMenuComponent from '@/components/flow/NodeContextMenu';
import { IconWithGlow, NEON_COLOR, NEON_GREEN, NEON_RED, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle, customScrollbarStyle } from '@/components/flow/utils';
import WhatsAppConnection from '@/components/whatsapp-connection';


// --- MOCKS E TIPOS LOCAIS (Para a aba de conversas) ---
interface WhatsAppMessage { id: number; contactNumber: string; contactName?: string; message: string; direction: 'incoming' | 'outgoing'; timestamp: string; isRead: boolean; messageType: 'text' | 'image' | 'document' | 'audio' | 'template'; status?: 'sent' | 'delivered' | 'read' | 'failed'; }
interface Contact { contactNumber: string; contactName: string; lastMessage: string; timestamp: Date; unreadCount?: number; tags?: string[]; isBot?: boolean; }

// --- COMPONENTES DE NÓ (Completos) ---
const NodeInput = (props: React.ComponentProps<typeof Input>) => <Input {...props} className={cn(baseInputInsetStyle, "text-[11px] h-7 px-1.5 py-1 rounded", props.className)} />;
const NodeLabel = (props: React.ComponentProps<typeof Label>) => <Label {...props} className={cn("text-[10px] text-gray-400 mb-0.5 block font-normal", props.className)} style={{ textShadow: `0 0 3px ${NEON_COLOR}30` }}/>;
const NodeButton = (props: React.ComponentProps<typeof Button>) => <Button variant="outline" {...props} className={cn(baseButtonSelectStyle, `text-[10px] h-6 w-full rounded-sm px-2`, props.className)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }} />;
const NodeSelect = ({ children, placeholder, ...props }: React.ComponentProps<typeof Select> & { placeholder?: string }) => ( <Select {...props}> <SelectTrigger className={cn(baseButtonSelectStyle, "h-7 text-[11px] rounded px-1.5")}> <SelectValue placeholder={placeholder || 'Selecione...'} /> </SelectTrigger> <SelectContent className={cn(popoverContentStyle, "text-xs")}> {children} </SelectContent> </Select> );
const NodeTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, value, ...props }, ref) => { const internalRef = useRef<HTMLTextAreaElement>(null); const currentRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>; const autoResize = useCallback(() => { if (currentRef.current) { currentRef.current.style.height = 'auto'; currentRef.current.style.height = `${currentRef.current.scrollHeight}px`; } }, [currentRef]); useEffect(() => { autoResize(); }, [value, autoResize]); const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { autoResize(); if (props.onChange) props.onChange(e); }; return ( <Textarea ref={currentRef} className={cn(baseInputInsetStyle, "text-[11px] resize-none overflow-hidden min-h-[32px] p-1.5 rounded", className)} rows={1} value={value} {...props} onChange={handleChange} onFocus={autoResize} /> ); });
NodeTextarea.displayName = "NodeTextarea";
const NODE_CARD_BASE_CLASSES = "node-card w-60 shadow-lg";
const NODE_HEADER_CLASSES = "node-header !p-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing";
const NODE_CONTENT_CLASSES = "p-2 space-y-1.5";
const NODE_HANDLE_BASE_CLASSES = "!bg-gray-700 !border-none !h-2.5 !w-2.5";
const NODE_HANDLE_GLOW_CLASSES = "node-handle-glow";

function TextMessageNode({ id, data }: NodeProps<TextMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const updateNodeData = (newText: string) => { setText(newText); setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text: newText } } : n)); }; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES} /> <CardHeader className={NODE_HEADER_CLASSES}> <div className="flex items-center text-xs"><IconWithGlow icon={MessageSquare} className="mr-1.5 h-3.5 w-3.5"/> Mensagem de Texto</div> </CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeTextarea value={text} onChange={(e) => updateNodeData(e.target.value)} placeholder="Digite sua mensagem aqui..." /> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
function ButtonMessageNode({ id, data }: NodeProps<ButtonMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const [footer, setFooter] = useState(data?.footer || ''); const [buttons, setButtons] = useState<ButtonOption[]>(data?.buttons || [{ id: `btn_${id.slice(-4)}_${Date.now()%10000}`, text: 'Opção 1' }]); const updateNodeData = (field: string, value: any) => { setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); }; const handleButtonTextChange = (buttonId: string, newText: string) => { const newButtons = buttons.map(b => b.id === buttonId ? { ...b, text: newText } : b); setButtons(newButtons); updateNodeData('buttons', newButtons); }; const addButton = () => { if (buttons.length >= 3) return; const newButtonId = `btn_${id.slice(-4)}_${Date.now()%10000}_${buttons.length}`; const newButtons = [...buttons, { id: newButtonId, text: `Nova Opção ${buttons.length + 1}` }]; setButtons(newButtons); updateNodeData('buttons', newButtons); }; const removeButton = (buttonId: string) => { const newButtons = buttons.filter(b => b.id !== buttonId); setButtons(newButtons); updateNodeData('buttons', newButtons); }; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}> <Handle type="target" position={Position.Top} id="target-top" isConnectable={true} className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5"/> Mensagem com Botões</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Texto Principal</NodeLabel> <NodeTextarea value={text} onChange={(e) => {setText(e.target.value); updateNodeData('text', e.target.value)}} placeholder="Mensagem principal..."/> <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel> <NodeInput value={footer} onChange={(e) => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}} placeholder="Texto do rodapé..."/> <NodeLabel className="mt-1">Botões ({buttons.length}/3 max)</NodeLabel> <div className={cn('space-y-1 max-h-28 overflow-y-auto pr-1', customScrollbarStyle)}> {buttons.map((button, index) => ( <div key={button.id} className='relative group flex items-center gap-1'> <NodeInput value={button.text} onChange={(e) => handleButtonTextChange(button.id, e.target.value)} placeholder={`Texto Botão ${index+1}`} className='flex-grow'/> <Handle type="source" position={Position.Right} id={button.id} style={{ top: `${20 + index * 28}px`, right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-teal-600')} title={button.text || `Saída ${index+1}`} isConnectable={true}/> <Button onClick={() => removeButton(button.id)} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}><X className='w-3 h-3'/></Button> </div> ))} </div> {buttons.length < 3 && <NodeButton onClick={addButton} className="mt-1.5"><Plus className="mr-1 h-3 w-3"/> Adicionar Botão</NodeButton>} </CardContent> </Card> ); }
function ImageNode({ id, data }: NodeProps<ImageNodeData>) { const { setNodes } = useReactFlow(); const [url, setUrl] = useState(data?.url || ''); const [caption, setCaption] = useState(data?.caption || ''); const updateNodeData = (field: string, value: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={ImageIcon} className="mr-1.5 h-3.5 w-3.5"/> Imagem</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>URL da Imagem</NodeLabel> <NodeInput value={url} onChange={(e) => {setUrl(e.target.value); updateNodeData('url', e.target.value)}} placeholder="https://exemplo.com/imagem.png"/> <NodeLabel className="mt-1">Legenda (Opcional)</NodeLabel> <NodeTextarea value={caption} onChange={(e) => {setCaption(e.target.value); updateNodeData('caption', e.target.value)}} placeholder="Legenda da imagem..."/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
function AudioMessageNode({ id, data }: NodeProps<AudioNodeData>) { const { setNodes } = useReactFlow(); const [url, setUrl] = useState(data?.url || ''); const updateNodeData = (field: string, value: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Mic} className="mr-1.5 h-3.5 w-3.5"/> Áudio</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>URL do Áudio (.ogg preferencial)</NodeLabel> <NodeInput value={url} onChange={(e) => {setUrl(e.target.value); updateNodeData('url', e.target.value)}} placeholder="https://exemplo.com/audio.ogg"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
function FileMessageNode({ id, data }: NodeProps<FileNodeData>) { const { setNodes } = useReactFlow(); const [url, setUrl] = useState(data?.url || ''); const [filename, setFilename] = useState(data?.filename || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={FileIcon} className="mr-1.5 h-3.5 w-3.5"/> Arquivo</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>URL do Arquivo</NodeLabel> <NodeInput value={url} onChange={e => {setUrl(e.target.value); update('url', e.target.value)}} placeholder="https://exemplo.com/doc.pdf"/> <NodeLabel className="mt-1">Nome do Arquivo (Opcional)</NodeLabel> <NodeInput value={filename} onChange={e => {setFilename(e.target.value); update('filename', e.target.value)}} placeholder="documento.pdf"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> );}
function LocationMessageNode({ id, data }: NodeProps<LocationNodeData>) { const { setNodes } = useReactFlow(); const [latitude, setLatitude] = useState(data?.latitude || ''); const [longitude, setLongitude] = useState(data?.longitude || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={MapPin} className="mr-1.5 h-3.5 w-3.5"/> Localização</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Latitude</NodeLabel> <NodeInput value={latitude} onChange={e => {setLatitude(e.target.value); update('latitude', e.target.value)}} placeholder="-23.55052"/> <NodeLabel className="mt-1">Longitude</NodeLabel> <NodeInput value={longitude} onChange={e => {setLongitude(e.target.value); update('longitude', e.target.value)}} placeholder="-46.633308"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> );}
function ListMessageNode({ id, data }: NodeProps<ListMessageNodeData>) { const { setNodes } = useReactFlow(); const [text, setText] = useState(data?.text || ''); const [title, setTitle] = useState(data?.title || 'Título da Lista'); const [buttonText, setButtonText] = useState(data?.buttonText || 'Ver Opções'); const [footer, setFooter] = useState(data?.footer || ''); const [sections, setSections] = useState<ListSection[]>(data?.sections || [{ id: `sec_${id.slice(-4)}_0`, title: 'Seção 1', rows: [{ id: `row_${id.slice(-4)}_0_0`, title: 'Item 1', description: '' }] }]); const updateNodeData = (field: string, value: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); const handleSectionTitleChange = (sectionId: string, newTitle: string) => { const newSections = sections.map(s => s.id === sectionId ? { ...s, title: newTitle } : s); setSections(newSections); updateNodeData('sections', newSections); }; const handleRowChange = (sectionId: string, rowId: string, field: 'title' | 'description', newValue: string) => { const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: s.rows.map(r => r.id === rowId ? { ...r, [field]: newValue } : r) } : s); setSections(newSections); updateNodeData('sections', newSections);}; const addSection = () => { if (sections.length >= 5) return; const newSectionId = `sec_${id.slice(-4)}_${sections.length}`; const newSections = [...sections, { id: newSectionId, title: `Nova Seção ${sections.length + 1}`, rows: [{id: `row_${newSectionId}_0`, title: "Novo Item 1", description: ""}] }]; setSections(newSections); updateNodeData('sections', newSections); }; const removeSection = (sectionId: string) => { const newSections = sections.filter(s => s.id !== sectionId); setSections(newSections); updateNodeData('sections', newSections); }; const addRowToSection = (sectionId: string) => { const section = sections.find(s => s.id === sectionId); if (section && section.rows.length >= 10) return; const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: [...s.rows, {id: `row_${sectionId}_${s.rows.length}`, title: `Novo Item ${s.rows.length+1}`, description: ""}] } : s); setSections(newSections); updateNodeData('sections', newSections);}; const removeRowFromSection = (sectionId: string, rowId: string) => { const newSections = sections.map(s => s.id === sectionId ? { ...s, rows: s.rows.filter(r => r.id !== rowId) } : s); setSections(newSections); updateNodeData('sections', newSections);}; return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-72")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={ListChecks} className="mr-1.5 h-3.5 w-3.5 text-sky-400"/> Mensagem de Lista</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Texto do Corpo (Opcional)</NodeLabel> <NodeTextarea value={text} onChange={e => {setText(e.target.value); updateNodeData('text', e.target.value)}} placeholder="Instrução ou descrição..."/> <NodeLabel className="mt-1">Título da Lista (Obrigatório)</NodeLabel> <NodeInput value={title} onChange={e => {setTitle(e.target.value); updateNodeData('title', e.target.value)}} placeholder="Ex: Nossos Serviços"/> <NodeLabel className="mt-1">Texto do Botão da Lista (Obrigatório)</NodeLabel> <NodeInput value={buttonText} onChange={e => {setButtonText(e.target.value); updateNodeData('buttonText', e.target.value)}} placeholder="Ex: Escolha uma opção"/> <NodeLabel className="mt-1">Rodapé (Opcional)</NodeLabel> <NodeInput value={footer} onChange={e => {setFooter(e.target.value); updateNodeData('footer', e.target.value)}} placeholder="Texto rodapé..."/> <div className={cn("mt-2 space-y-2 max-h-48 overflow-y-auto pr-1", customScrollbarStyle)}> {sections.map((section, sIdx) => ( <div key={section.id} className={cn(baseInputInsetStyle, "p-1.5 rounded-sm space-y-1")}> <div className="flex items-center justify-between"> <NodeInput value={section.title} onChange={e => handleSectionTitleChange(section.id, e.target.value)} placeholder={`Título Seção ${sIdx+1}`} className="text-xs flex-grow !h-6"/> <Button onClick={() => removeSection(section.id)} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-5 h-5 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}><X className='w-3 h-3'/></Button> </div> {section.rows.map((row, rIdx) => ( <div key={row.id} className="ml-2 space-y-0.5"> <div className="flex items-center gap-1"> <NodeInput value={row.title} onChange={e => handleRowChange(section.id, row.id, 'title', e.target.value)} placeholder={`Item ${rIdx+1}`} className="text-[10px] flex-grow !h-5"/> <Button onClick={() => removeRowFromSection(section.id, row.id)} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, 'flex-shrink-0 w-4 h-4 p-0 !text-red-400 hover:!bg-red-500/20 rounded-sm')}><X className='w-2.5 h-2.5'/></Button> </div> <NodeInput value={row.description || ''} onChange={e => handleRowChange(section.id, row.id, 'description', e.target.value)} placeholder="Descrição (opcional)" className="text-[10px] !h-5"/> <Handle type="source" position={Position.Right} id={row.id} style={{ top: `${10 + sIdx * 80 + rIdx * 30}px`, right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-sky-500')} title={row.title || `Item ${rIdx + 1}`} isConnectable={true} /> </div> ))} <NodeButton onClick={() => addRowToSection(section.id)} disabled={section.rows.length >=10} className="text-[9px] !h-5 mt-1"><Plus className="mr-0.5 h-2.5 w-2.5"/> Item</NodeButton> </div> ))} </div> {sections.length < 5 && <NodeButton onClick={addSection} className="mt-1.5"><Plus className="mr-1 h-3 w-3"/> Adicionar Seção</NodeButton>} </CardContent> <Handle type="source" position={Position.Bottom} id="source-fallback" style={{left: '50%' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-orange-500')} title="Fallback (Sem seleção/Erro)" isConnectable={true}/> </Card> );}
function DelayNode({ id, data }: NodeProps<DelayNodeData>) { const { setNodes } = useReactFlow(); const [duration, setDuration] = useState(data?.duration || 1); const [unit, setUnit] = useState<'seconds' | 'minutes'>(data?.unit || 'seconds'); const updateNodeData = (field: string, value: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Clock} className="mr-1.5 h-3.5 w-3.5"/> Atraso (Delay)</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES + " flex items-center space-x-1.5"}> <NodeInput type="number" value={duration} onChange={(e) => {const val = parseInt(e.target.value) || 1; setDuration(val); updateNodeData('duration', val)}} className="w-16" min={1}/> <NodeSelect value={unit} onValueChange={(val: 'seconds' | 'minutes') => {setUnit(val); updateNodeData('unit', val)}}> <SelectItem value="seconds" className='text-xs'>Segundos</SelectItem> <SelectItem value="minutes" className='text-xs'>Minutos</SelectItem> </NodeSelect> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> ); }
function WaitInputNode({ id, data }: NodeProps<WaitInputNodeData>) { const { setNodes } = useReactFlow(); const [variableName, setVariableName] = useState(data?.variableName || 'userInput'); const [message, setMessage] = useState(data?.message || ''); const [timeoutSeconds, setTimeoutSeconds] = useState<number | undefined>(data?.timeoutSeconds); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={HelpCircle} className="mr-1.5 h-3.5 w-3.5"/> Esperar Input</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Salvar resposta em Variável</NodeLabel> <NodeInput value={variableName} onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}} placeholder="nome_da_variavel"/> <NodeLabel className="mt-1">Mensagem de Solicitação (Opcional)</NodeLabel> <NodeTextarea value={message} onChange={e => {setMessage(e.target.value); update('message', e.target.value)}} placeholder="Ex: Digite seu nome completo"/> <NodeLabel className="mt-1">Timeout (Segundos, Opcional)</NodeLabel> <NodeInput type="number" value={timeoutSeconds ?? ''} onChange={e => {const val = e.target.value ? parseInt(e.target.value, 10) : undefined; setTimeoutSeconds(val); update('timeoutSeconds', val)}} placeholder="Ex: 60" min={1}/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-received" title="Input Recebido" className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}/> <Handle type="source" position={Position.Right} id="source-timeout" style={{ top: '65%', right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-orange-500', !timeoutSeconds ? '!hidden' : '')} title="Timeout Atingido" isConnectable={!!timeoutSeconds}/> </Card> );}
function SetVariableNode({ id, data }: NodeProps<SetVariableNodeData>) { const { setNodes } = useReactFlow(); const [variableName, setVariableName] = useState(data?.variableName || 'minhaVariavel'); const [value, setValue] = useState(data?.value || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Variable} className="mr-1.5 h-3.5 w-3.5"/> Definir Variável</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Nome da Variável</NodeLabel> <NodeInput value={variableName} onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}} placeholder="nome_variavel"/> <NodeLabel className="mt-1">Valor (Use {'{{outra_var}}'} para interpolar)</NodeLabel> <NodeInput value={value} onChange={e => {setValue(e.target.value); update('value', e.target.value)}} placeholder="Texto, número ou {{variavel}}"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> );}
function ConditionNode({ id, data }: NodeProps<ConditionNodeData>) { const { setNodes } = useReactFlow(); const [variableName, setVariableName] = useState(data?.variableName || ''); const [comparison, setComparison] = useState(data?.comparison || 'equals'); const [value, setValue] = useState(data?.value || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); const showValueInput = !['isSet', 'isNotSet'].includes(comparison); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES)}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Waypoints} className="mr-1.5 h-3.5 w-3.5"/> Condição (Se/Então)</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Variável (Ex: {'{{userInput}}'})</NodeLabel> <NodeInput value={variableName} onChange={e => {setVariableName(e.target.value); update('variableName', e.target.value)}} placeholder="nome_variavel"/> <NodeLabel className="mt-1">Comparação</NodeLabel> <NodeSelect value={comparison} onValueChange={(val: any) => {setComparison(val); update('comparison', val); if (['isSet', 'isNotSet'].includes(val)) {setValue(''); update('value', '');}}}> <SelectItem value="equals" className='text-xs'>Igual a</SelectItem><SelectItem value="contains" className='text-xs'>Contém</SelectItem><SelectItem value="startsWith" className='text-xs'>Começa com</SelectItem><SelectItem value="endsWith" className='text-xs'>Termina com</SelectItem><SelectItem value="isSet" className='text-xs'>Está Definida</SelectItem><SelectItem value="isNotSet" className='text-xs'>Não Está Definida</SelectItem><SelectItem value="greaterThan" className='text-xs'>Maior que (Numérico)</SelectItem><SelectItem value="lessThan" className='text-xs'>Menor que (Numérico)</SelectItem><SelectItem value="greaterOrEquals" className='text-xs'>Maior ou Igual (Numérico)</SelectItem><SelectItem value="lessOrEquals" className='text-xs'>Menor ou Igual (Numérico)</SelectItem><SelectItem value="regex" className='text-xs'>Corresponde ao Regex</SelectItem> </NodeSelect> {showValueInput && <> <NodeLabel className="mt-1">Valor (Use {'{{var}}'} ou Regex)</NodeLabel> <NodeInput value={value} onChange={e => {setValue(e.target.value); update('value', e.target.value)}} placeholder="Valor ou /pattern/flags"/> </> } </CardContent> <Handle type="source" position={Position.Right} id="source-true" style={{top: '35%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')} title="Verdadeiro"/> <Handle type="source" position={Position.Right} id="source-false" style={{top: '65%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')} title="Falso"/> </Card> );}
function TimeConditionNode({ id, data }: NodeProps<TimeConditionNodeData>) { const { setNodes } = useReactFlow(); const [startTime, setStartTime] = useState(data?.startTime || '09:00'); const [endTime, setEndTime] = useState(data?.endTime || '18:00'); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Clock10} className="mr-1.5 h-3.5 w-3.5"/> Condição de Horário</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Horário Início (HH:MM)</NodeLabel> <NodeInput type="time" value={startTime} onChange={e => {setStartTime(e.target.value); update('startTime', e.target.value)}}/> <NodeLabel className="mt-1">Horário Fim (HH:MM)</NodeLabel> <NodeInput type="time" value={endTime} onChange={e => {setEndTime(e.target.value); update('endTime', e.target.value)}}/> </CardContent> <Handle type="source" position={Position.Right} id="source-inside" style={{top: '35%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')} title="Dentro do Horário"/> <Handle type="source" position={Position.Right} id="source-outside" style={{top: '65%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')} title="Fora do Horário"/> </Card> );}
function LoopNode({ id, data }: NodeProps<LoopNodeData>) { const { setNodes } = useReactFlow(); const [repetitions, setRepetitions] = useState(data?.repetitions || 3); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Repeat} className="mr-1.5 h-3.5 w-3.5"/> Loop (Repetir)</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Número de Repetições</NodeLabel> <NodeInput type="number" value={repetitions} onChange={e => {const val = parseInt(e.target.value) || 1; setRepetitions(val); update('repetitions', val)}} min={1}/> </CardContent> <Handle type="source" position={Position.Right} id="source-loop-body" style={{top: '35%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-blue-500')} title="Executar Corpo do Loop"/> <Handle type="source" position={Position.Right} id="source-finished" style={{top: '65%', right: '-12px'}} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-gray-500')} title="Loop Finalizado"/> </Card> );}
function ApiCallNode({ id, data }: NodeProps<ApiCallNodeData>) { const { setNodes } = useReactFlow(); const [apiUrl, setApiUrl] = useState(data?.apiUrl || ''); const [method, setMethod] = useState(data?.method || 'GET'); const [headers, setHeaders] = useState(data?.headers || ''); const [body, setBody] = useState(data?.body || ''); const [saveResponseTo, setSaveResponseTo] = useState(data?.saveResponseTo || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-64")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={RadioTower} className="mr-1.5 h-3.5 w-3.5"/> Chamada API Externa</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>URL (Use {'{{var}}'})</NodeLabel> <NodeInput value={apiUrl} onChange={e => {setApiUrl(e.target.value); update('apiUrl', e.target.value)}} placeholder="https://api.exemplo.com/dados"/> <NodeLabel className="mt-1">Método</NodeLabel> <NodeSelect value={method} onValueChange={(val: any) => {setMethod(val); update('method', val)}}> <SelectItem value="GET" className='text-xs'>GET</SelectItem><SelectItem value="POST" className='text-xs'>POST</SelectItem><SelectItem value="PUT" className='text-xs'>PUT</SelectItem><SelectItem value="DELETE" className='text-xs'>DELETE</SelectItem><SelectItem value="PATCH" className='text-xs'>PATCH</SelectItem> </NodeSelect> <NodeLabel className="mt-1">Headers (JSON, Opcional, Use {'{{var}}'})</NodeLabel> <NodeTextarea value={headers} onChange={e => {setHeaders(e.target.value); update('headers', e.target.value)}} placeholder={'{"Content-Type": "application/json",\n "Authorization": "Bearer {{token}}"}'}/> <NodeLabel className="mt-1">Corpo (JSON/Texto, Opcional, Use {'{{var}}'})</NodeLabel> <NodeTextarea value={body} onChange={e => {setBody(e.target.value); update('body', e.target.value)}} placeholder={'{"chave": "{{valor_variavel}}"}'}/> <NodeLabel className="mt-1">Salvar Resposta em Variável (Opcional)</NodeLabel> <NodeInput value={saveResponseTo} onChange={e => {setSaveResponseTo(e.target.value); update('saveResponseTo', e.target.value)}} placeholder="nome_variavel_resposta"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-success" title="Sucesso" className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}/> <Handle type="source" position={Position.Right} id="source-error" style={{ top: '50%', right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')} title="Erro na Chamada"/> </Card> );}
function WebhookCallNode({ id, data }: NodeProps<WebhookCallNodeData>) { const { setNodes } = useReactFlow(); const [url, setUrl] = useState(data?.url || ''); const [method, setMethod] = useState(data?.method || 'POST'); const [headers, setHeaders] = useState(data?.headers || ''); const [body, setBody] = useState(data?.body || ''); const [saveResponseTo, setSaveResponseTo] = useState(data?.saveResponseTo || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-64")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Webhook} className="mr-1.5 h-3.5 w-3.5"/> Chamar Webhook</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>URL do Webhook (Use {'{{var}}'})</NodeLabel> <NodeInput value={url} onChange={e => {setUrl(e.target.value); update('url', e.target.value)}} placeholder="https://seu.webhook/endpoint"/> <NodeLabel className="mt-1">Método</NodeLabel> <NodeSelect value={method} onValueChange={(val: any) => {setMethod(val); update('method', val)}}> <SelectItem value="POST" className='text-xs'>POST</SelectItem><SelectItem value="GET" className='text-xs'>GET</SelectItem> </NodeSelect> <NodeLabel className="mt-1">Headers (JSON, Opcional, Use {'{{var}}'})</NodeLabel> <NodeTextarea value={headers} onChange={e => {setHeaders(e.target.value); update('headers', e.target.value)}} placeholder={'{"X-API-Key": "{{chave_webhook}}"}'}/> <NodeLabel className="mt-1">Corpo (JSON/Texto, Opcional, Use {'{{var}}'})</NodeLabel> <NodeTextarea value={body} onChange={e => {setBody(e.target.value); update('body', e.target.value)}} placeholder={'{"evento": "novo_lead", "dados": "{{lead_info}}"}'}/> <NodeLabel className="mt-1">Salvar Resposta em Variável (Opcional)</NodeLabel> <NodeInput value={saveResponseTo} onChange={e => {setSaveResponseTo(e.target.value); update('saveResponseTo', e.target.value)}} placeholder="resposta_webhook"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-success" title="Sucesso" className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}/> <Handle type="source" position={Position.Right} id="source-error" style={{ top: '50%', right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')} title="Erro no Webhook"/> </Card> );}
function GPTQueryNode({ id, data }: NodeProps<GPTQueryNodeData>) { const { setNodes } = useReactFlow(); const [prompt, setPrompt] = useState(data?.prompt || ''); const [apiKeyVariable, setApiKeyVariable] = useState(data?.apiKeyVariable || 'GEMINI_API_KEY'); const [saveResponseTo, setSaveResponseTo] = useState(data?.saveResponseTo || 'gptResposta'); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-64")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Bot} className="mr-1.5 h-3.5 w-3.5"/> Consulta IA (Gemini/GPT)</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Prompt (Use {'{{var}}'})</NodeLabel> <NodeTextarea value={prompt} onChange={e => {setPrompt(e.target.value); update('prompt', e.target.value)}} placeholder="Ex: Crie uma saudação para {{nomeCliente}}."/> <NodeLabel className="mt-1">Variável da API Key (Ex: GEMINI_API_KEY)</NodeLabel> <NodeInput value={apiKeyVariable} onChange={e => {setApiKeyVariable(e.target.value); update('apiKeyVariable', e.target.value)}} placeholder="Ex: MINHA_CHAVE_API_GEMINI"/> <NodeLabel className="mt-1">Salvar Resposta em Variável</NodeLabel> <NodeInput value={saveResponseTo} onChange={e => {setSaveResponseTo(e.target.value); update('saveResponseTo', e.target.value)}} placeholder="variavel_resposta_gpt"/> </CardContent> <Handle type="source" position={Position.Bottom} id="source-success" title="Sucesso" className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-green-500')}/> <Handle type="source" position={Position.Right} id="source-error" style={{ top: '50%', right: '-12px' }} className={cn(NODE_HANDLE_BASE_CLASSES, NODE_HANDLE_GLOW_CLASSES, '!bg-red-500')} title="Erro na Consulta"/> </Card> );}
function TagContactNode({ id, data }: NodeProps<TagContactNodeData>) { const { setNodes } = useReactFlow(); const [tagName, setTagName] = useState(data?.tagName || ''); const [action, setAction] = useState<'add' | 'remove'>(data?.action || 'add'); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Tag} className="mr-1.5 h-3.5 w-3.5"/> Adicionar/Remover Tag</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Nome da Tag</NodeLabel> <NodeInput value={tagName} onChange={e => {setTagName(e.target.value); update('tagName', e.target.value)}} placeholder="Ex: Lead Qualificado"/> <NodeLabel className="mt-1">Ação</NodeLabel> <NodeSelect value={action} onValueChange={(val: 'add' | 'remove') => {setAction(val); update('action', val)}}> <SelectItem value="add" className='text-xs'>Adicionar Tag</SelectItem> <SelectItem value="remove" className='text-xs'>Remover Tag</SelectItem> </NodeSelect> </CardContent> <Handle type="source" position={Position.Bottom} id="source-bottom" className={NODE_HANDLE_BASE_CLASSES}/> </Card> );}
function GoToFlowNode({ id, data }: NodeProps<GoToFlowNodeData>) { const { setNodes } = useReactFlow(); const [targetFlowId, setTargetFlowId] = useState(data?.targetFlowId || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={Shuffle} className="mr-1.5 h-3.5 w-3.5"/> Ir para outro Fluxo</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>ID do Fluxo de Destino</NodeLabel> <NodeInput value={targetFlowId} onChange={e => {setTargetFlowId(e.target.value); update('targetFlowId', e.target.value)}} placeholder="ID numérico do fluxo"/> </CardContent> </Card> );}
function AssignAgentNode({ id, data }: NodeProps<AssignAgentNodeData>) { const { setNodes } = useReactFlow(); const [department, setDepartment] = useState(data?.department || ''); const [message, setMessage] = useState(data?.message || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-56")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={NODE_HEADER_CLASSES}><div className="flex items-center text-xs"><IconWithGlow icon={UserCheck} className="mr-1.5 h-3.5 w-3.5"/> Atribuir a Agente</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Departamento (Opcional)</NodeLabel> <NodeInput value={department} onChange={e => {setDepartment(e.target.value); update('department', e.target.value)}} placeholder="Ex: Vendas, Suporte"/> <NodeLabel className="mt-1">Mensagem para Agente (Opcional)</NodeLabel> <NodeTextarea value={message} onChange={e => {setMessage(e.target.value); update('message', e.target.value)}} placeholder="Contexto para o agente..."/> </CardContent> </Card> );}
function EndFlowNode({ id, data }: NodeProps<EndFlowNodeData>) { const { setNodes } = useReactFlow(); const [reason, setReason] = useState(data?.reason || ''); const update = (field: string, val: any) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n)); return ( <Card className={cn(baseCardStyle, NODE_CARD_BASE_CLASSES, "w-48 !border-red-500/50")}> <Handle type="target" position={Position.Top} id="target-top" className={NODE_HANDLE_BASE_CLASSES}/> <CardHeader className={cn(NODE_HEADER_CLASSES, "!text-red-400")}><div className="flex items-center text-xs"><IconWithGlow icon={LogOut} className="mr-1.5 h-3.5 w-3.5" color={NEON_RED}/> Encerrar Fluxo</div></CardHeader> <CardContent className={NODE_CONTENT_CLASSES}> <NodeLabel>Motivo do Encerramento (Opcional)</NodeLabel> <NodeInput value={reason} onChange={e => {setReason(e.target.value); update('reason', e.target.value)}} placeholder="Ex: Cliente satisfeito"/> </CardContent> </Card> );}
const globalNodeOrigin: NodeOrigin = [0.5, 0.5];
// --- FIM DOS COMPONENTES DE NÓ ---


// --- COMPONENTE INTERNO DO EDITOR DE FLUXO ---
interface FlowEditorInnerProps {
  activeFlow?: FlowData | null;
  campaignList: CampaignSelectItem[];
  onSave: (flowData: { name: string; status: 'active' | 'inactive' | 'draft'; campaignId: number | null; elements: { nodes: Node<AllNodeDataTypes>[]; edges: Edge[] } }) => Promise<any>;
  onToggleStatus: (newStatus: 'active' | 'inactive') => void;
  isLoading: boolean;
}

function FlowEditorInner({ activeFlow, campaignList, onSave, onToggleStatus, isLoading }: FlowEditorInnerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<AllNodeDataTypes>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const reactFlowInstance = useReactFlow();
    const { toast } = useToast();
    
    const [flowNameInput, setFlowNameInput] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('none');
    
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<FlowNodeContextMenuProps | null>(null);

    const nodeTypes = useMemo(() => ({
        textMessage: TextMessageNode, buttonMessage: ButtonMessageNode, imageMessage: ImageNode,
        audioMessage: AudioMessageNode, fileMessage: FileMessageNode, locationMessage: LocationMessageNode,
        listMessage: ListMessageNode, delay: DelayNode, waitInput: WaitInputNode,
        setVariable: SetVariableNode, condition: ConditionNode, timeCondition: TimeConditionNode,
        loopNode: LoopNode, apiCall: ApiCallNode, webhookCall: WebhookCallNode,
        gptQuery: GPTQueryNode, tagContact: TagContactNode, goToFlow: GoToFlowNode,
        assignAgent: AssignAgentNode, endFlow: EndFlowNode,
    }), []);

    useEffect(() => {
        if (activeFlow) {
            console.log(`[FlowEditorInner] Fluxo ativo mudou para ID: ${activeFlow.id}. Carregando dados...`, activeFlow);
            setFlowNameInput(activeFlow.name);
            setSelectedCampaignId(String(activeFlow.campaignId || 'none'));
            const flowElements = activeFlow.elements || { nodes: [], edges: [] };
            setNodes(flowElements.nodes.map(n => ({ ...n, dragHandle: '.node-header' })));
            setEdges(flowElements.edges);
            setTimeout(() => reactFlowInstance.fitView({ duration: 200, padding: 0.2 }), 100);
        } else {
            console.log("[FlowEditorInner] Nenhum fluxo ativo. Limpando editor.");
            setNodes([]); setEdges([]); setFlowNameInput(''); setSelectedCampaignId('none');
        }
    }, [activeFlow, setNodes, setEdges, reactFlowInstance]);

    const handleSave = () => {
        if (!flowNameInput.trim()) { toast({ title: 'Nome Obrigatório', description: 'Por favor, dê um nome ao seu fluxo.', variant: 'destructive' }); return; }
        const currentNodesToSave = nodes.map(({ dragHandle, selected, ...node }) => node);
        const currentEdgesToSave = edges.map(({ selected, ...edge }) => edge);
        onSave({
            name: flowNameInput.trim(),
            status: activeFlow?.status || 'draft',
            campaignId: selectedCampaignId === 'none' ? null : Number(selectedCampaignId),
            elements: { nodes: currentNodesToSave, edges: currentEdgesToSave }
        });
    };

    const handleToggleStatus = () => {
      if (!activeFlow) return;
      const newStatus = activeFlow.status === 'active' ? 'inactive' : 'active';
      onToggleStatus(newStatus);
    };

    const onConnect: OnConnect = useCallback((connection) => { const sourceNode = reactFlowInstance.getNode(connection.source!); const sourceHandleId = connection.sourceHandle || 'source-bottom'; const isSingleOutputHandle = !['buttonMessage', 'listMessage', 'condition', 'loopNode', 'timeCondition', 'waitInput', 'apiCall', 'webhookCall', 'gptQuery'].includes(sourceNode?.type || ''); setEdges((eds) => { let newEdges = eds; if (isSingleOutputHandle && sourceNode?.type !== 'condition' && sourceHandleId !== 'source-error' && sourceHandleId !== 'source-timeout' && sourceHandleId !== 'source-false' && sourceHandleId !== 'source-outside' && sourceHandleId !== 'source-finished' ) { newEdges = eds.filter(edge => !(edge.source === connection.source && edge.sourceHandle === sourceHandleId)); } return addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed, color: NEON_COLOR }, style: { stroke: NEON_COLOR, strokeWidth: 1.5, opacity: 0.8 } }, newEdges); }); }, [setEdges, reactFlowInstance]);
    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => { event.preventDefault(); setContextMenu({ id: node.id, top: event.clientY, left: event.clientX, nodeType: node.type }); }, []);
    const handlePaneClick = useCallback(() => setContextMenu(null), []);
    const handleDeleteNode = useCallback((nodeId: string) => { setNodes((nds) => nds.filter((node) => node.id !== nodeId)); setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)); setContextMenu(null); }, [setNodes, setEdges]);
    const handleDuplicateNode = useCallback((nodeId: string) => { const nodeToDuplicate = reactFlowInstance.getNode(nodeId); if (!nodeToDuplicate) return; const newNodeId = `${nodeToDuplicate.type}_${Date.now()}_${Math.random().toString(16).slice(2,6)}`; const position = { x: nodeToDuplicate.position.x + 40, y: nodeToDuplicate.position.y + 40 }; let newData = JSON.parse(JSON.stringify(nodeToDuplicate.data)); if (nodeToDuplicate.type === 'buttonMessage' && newData.buttons) { newData.buttons = newData.buttons.map((btn: ButtonOption, i: number) => ({ ...btn, id: `btn_${newNodeId}_${i}` })); } if (nodeToDuplicate.type === 'listMessage' && newData.sections) { newData.sections = newData.sections.map((sec: ListSection, sIdx: number) => ({ ...sec, id: `sec_${newNodeId}_${sIdx}`, rows: sec.rows.map((row: ListItem, rIdx: number) => ({ ...row, id: `row_${newNodeId}_${sIdx}_${rIdx}` })) })); } const newNode: Node = { ...nodeToDuplicate, id: newNodeId, position, data: newData, dragHandle: '.node-header' }; reactFlowInstance.addNodes(newNode); setContextMenu(null); }, [reactFlowInstance]);
    
    const addNodeToFlow = useCallback((type: keyof typeof nodeTypes) => {
        if (!reactFlowInstance || !activeFlow) { toast({ title: "Ação Indisponível", description: "Selecione um fluxo para adicionar nós.", variant: "default" }); return; }
        const { x: viewX, y: viewY, zoom } = reactFlowInstance.getViewport(); const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane') as HTMLElement; const paneRect = pane?.getBoundingClientRect() || {width: window.innerWidth, height: window.innerHeight, top:0, left:0}; const centerX = (paneRect.width / 2 - viewX) / zoom; const centerY = (paneRect.height / 2 - viewY) / zoom; const position = { x: centerX, y: centerY }; const newNodeId = `${type}_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;
        let newNodeData: AllNodeDataTypes | {} = {}; 
        switch (type) {
            case 'textMessage': newNodeData = { text: 'Nova mensagem...' } as TextMessageNodeData; break;
            case 'buttonMessage': newNodeData = { text: 'Mensagem com botões', buttons: [{ id: `btn_${newNodeId}_0`, text: 'Opção 1' }] } as ButtonMessageNodeData; break;
            case 'imageMessage': newNodeData = { url: '', caption: '' } as ImageNodeData; break;
            case 'audioMessage': newNodeData = { url: '', ptt: false } as AudioNodeData; break;
            case 'fileMessage': newNodeData = { url: '', filename: '', mimetype: 'application/pdf' } as FileNodeData; break;
            case 'locationMessage': newNodeData = { latitude: '', longitude: '' } as LocationNodeData; break;
            case 'listMessage': newNodeData = { text: 'Corpo da lista', title: 'Título', buttonText: 'Opções', sections: [{ id: `sec_${newNodeId}_0`, title: 'Seção 1', rows: [{ id: `row_${newNodeId}_0_0`, title: 'Item 1'}] }] } as ListMessageNodeData; break;
            case 'delay': newNodeData = { duration: 5, unit: 'seconds' } as DelayNodeData; break;
            case 'waitInput': newNodeData = { variableName: 'userInput' } as WaitInputNodeData; break;
            case 'setVariable': newNodeData = { variableName: 'novaVariavel', value: '' } as SetVariableNodeData; break;
            case 'condition': newNodeData = { variableName: '', comparison: 'equals', value: '' } as ConditionNodeData; break;
            case 'timeCondition': newNodeData = { startTime: '09:00', endTime: '18:00' } as TimeConditionNodeData; break;
            case 'loopNode': newNodeData = { repetitions: 3 } as LoopNodeData; break;
            case 'apiCall': newNodeData = { apiUrl: '', method: 'GET' } as ApiCallNodeData; break;
            case 'webhookCall': newNodeData = { url: '', method: 'POST' } as WebhookCallNodeData; break;
            case 'gptQuery': newNodeData = { prompt: '', apiKeyVariable: 'GEMINI_API_KEY', saveResponseTo: 'gptResultado' } as GPTQueryNodeData; break;
            case 'tagContact': newNodeData = { tagName: '', action: 'add' } as TagContactNodeData; break;
            case 'goToFlow': newNodeData = { targetFlowId: '' } as GoToFlowNodeData; break;
            case 'assignAgent': newNodeData = { department: '' } as AssignAgentNodeData; break;
            case 'endFlow': newNodeData = {} as EndFlowNodeData; break;
            default: newNodeData = {}; break;
        }
        const nodeToAdd: Node<AllNodeDataTypes> = { id: newNodeId, type, position, data: newNodeData as AllNodeDataTypes, dragHandle: '.node-header' }; 
        setNodes((nds) => nds.concat(nodeToAdd)); 
        setTimeout(() => { reactFlowInstance.setCenter(position.x, position.y, { zoom: reactFlowInstance.getZoom(), duration: 200 }); }, 50);
    }, [reactFlowInstance, activeFlow, toast, nodeTypes, setNodes]);

    return (
        <div className="flex flex-row h-full min-h-0">
            <div className={cn("w-52 p-2.5 flex-shrink-0 flex flex-col space-y-1.5 border-r overflow-y-auto", baseCardStyle, 'rounded-none border-r-[rgba(30,144,255,0.2)] relative z-10', customScrollbarStyle)}>
                <h3 className="text-sm font-semibold text-center text-white border-b border-[rgba(30,144,255,0.2)] pb-1.5 mb-1.5 sticky top-0 z-10" style={{ textShadow: `0 0 5px ${NEON_COLOR}`, background: 'hsl(var(--card))' }}> Adicionar Etapa </h3>
                {Object.entries(nodeTypes).map(([type, NodeComponent]) => {
                    let icon = HelpCircle; let name = type;
                    if (type === 'textMessage') { icon = MsgIcon; name = 'Texto'; }
                    else if (type === 'buttonMessage') { icon = ListChecks; name = 'Botões'; }
                    else if (type === 'imageMessage') { icon = ImageIcon; name = 'Imagem'; }
                    else if (type === 'audioMessage') { icon = Mic; name = 'Áudio'; }
                    else if (type === 'fileMessage') { icon = FileIcon; name = 'Arquivo'; }
                    else if (type === 'locationMessage') { icon = MapPin; name = 'Localização'; }
                    else if (type === 'listMessage') { icon = ListChecks; name = 'Lista Interativa'; }
                    else if (type === 'delay') { icon = Clock; name = 'Atraso (Delay)'; }
                    else if (type === 'waitInput') { icon = HelpCircle; name = 'Esperar Input'; }
                    else if (type === 'setVariable') { icon = Variable; name = 'Definir Variável'; }
                    else if (type === 'condition') { icon = Waypoints; name = 'Condição Se/Então'; }
                    else if (type === 'timeCondition') { icon = Clock10; name = 'Condição Horário'; }
                    else if (type === 'loopNode') { icon = Repeat; name = 'Loop (Repetir)'; }
                    else if (type === 'apiCall') { icon = RadioTower; name = 'Chamada API'; }
                    else if (type === 'webhookCall') { icon = Webhook; name = 'Chamar Webhook'; }
                    else if (type === 'gptQuery') { icon = Bot; name = 'Consulta IA'; }
                    else if (type === 'tagContact') { icon = Tag; name = 'Adicionar/Remover Tag'; }
                    else if (type === 'goToFlow') { icon = Shuffle; name = 'Ir para outro Fluxo'; }
                    else if (type === 'assignAgent') { icon = UserCheck; name = 'Atribuir a Agente'; }
                    else if (type === 'endFlow') { icon = LogOut; name = 'Encerrar Fluxo'; }
                    return ( <Button key={type} className={cn(baseButtonSelectStyle, "node-add-button justify-start text-xs h-7 px-2 rounded")} onClick={() => addNodeToFlow(type as keyof typeof nodeTypes)} disabled={isLoading || !activeFlow}> <IconWithGlow icon={icon} className="mr-1.5 h-3.5 w-3.5" color={type === 'endFlow' ? NEON_RED : NEON_COLOR}/> {name} </Button> );
                })}
            </div>
            <div className="flex-grow flex flex-col bg-background/70 dark:bg-background/90 min-w-0">
                <div className={cn("flex items-center justify-between p-2 border-b flex-shrink-0 gap-2", baseCardStyle, 'rounded-none border-b-[rgba(30,144,255,0.2)] relative z-10')}>
                    <div className="flex items-center gap-1.5 flex-grow">
                        {activeFlow && (
                            <>
                                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={isLoading}>
                                    <SelectTrigger className={cn(baseButtonSelectStyle, "w-[160px] h-8 px-2 text-xs rounded")}>
                                        <Layers className='h-3 w-3 mr-1.5 text-gray-400' style={{ filter: `drop-shadow(0 0 3px ${NEON_COLOR}50)` }}/>
                                        <SelectValue placeholder="Vincular Campanha..." />
                                    </SelectTrigger>
                                    <SelectContent className={cn(popoverContentStyle)}>
                                        <SelectItem value="none" className="text-xs text-muted-foreground">Sem Campanha</SelectItem>
                                        {campaignList.map(c => (<SelectItem key={c.id} value={c.id.toString()} className="text-xs">{c.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <Input value={flowNameInput} onChange={(e) => setFlowNameInput(e.target.value)} placeholder="Nome do Fluxo" className={cn(baseInputInsetStyle, "h-8 text-xs w-[180px] rounded px-2")} disabled={isLoading} />
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                        {activeFlow && (
                            <>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button onClick={handleToggleStatus} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-8 h-8 rounded")} disabled={isLoading}>{activeFlow.status === 'active' ? <Square className="h-4 w-4 text-red-400" style={{ filter: `drop-shadow(0 0 3px ${NEON_RED})` }}/> : <Play className="h-4 w-4 text-green-400" style={{ filter: `drop-shadow(0 0 3px ${NEON_GREEN})` }}/>}</Button></TooltipTrigger><TooltipContent className={cn(popoverContentStyle, 'text-xs')}>{activeFlow.status === 'active' ? 'Desativar Fluxo' : 'Ativar Fluxo'}</TooltipContent></Tooltip></TooltipProvider>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button onClick={handleSave} variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-8 h-8 rounded")} disabled={isLoading || !flowNameInput.trim()}>{isLoading ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent className={cn(popoverContentStyle, 'text-xs')}>Salvar Fluxo</TooltipContent></Tooltip></TooltipProvider>
                            </>
                        )}
                        {!activeFlow && !isLoading && <span className='text-xs text-muted-foreground mr-2'>Selecione ou crie um fluxo.</span>}
                        {isLoading && <Activity className="h-4 w-4 animate-spin text-muted-foreground mr-2"/>}
                    </div>
                </div>
                <div className="flex-grow relative h-full" ref={reactFlowWrapper}>
                    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView={nodes.length === 0} fitViewOptions={{ padding: 0.3 }} className="bg-transparent" proOptions={{ hideAttribution: true }} deleteKeyCode={['Backspace', 'Delete']} onNodeContextMenu={handleNodeContextMenu} onPaneClick={handlePaneClick} nodesDraggable={!isLoading && !!activeFlow} nodesConnectable={!isLoading && !!activeFlow} elementsSelectable={!isLoading && !!activeFlow} nodeOrigin={globalNodeOrigin}>
                        <Controls className={cn(baseButtonSelectStyle, '!border-none !shadow-none')} />
                        <MiniMap className={cn(baseCardStyle, '!border-[rgba(30,144,255,0.2)]')} />
                        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
                        {contextMenu && <NodeContextMenuComponent {...contextMenu} onClose={handlePaneClick} onDelete={handleDeleteNode} onDuplicate={handleDuplicateNode} />}
                        <Panel position="top-right" className={cn(baseButtonSelectStyle, "p-1.5 rounded text-xs")}>Zoom: {reactFlowInstance.getViewport().zoom.toFixed(2)}</Panel>
                    </ReactFlow>
                    {!activeFlow && !isLoading && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white z-20 backdrop-blur-sm">
                        <Workflow className="h-12 w-12 mb-3 text-primary/70"/>
                        Nenhum fluxo selecionado.
                      </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
const WhatsApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState('flows');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const auth = useAuthStore();
    
    const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

    const { data: campaignList = [] } = useQuery<CampaignSelectItem[]>({ queryKey: ['campaigns'], queryFn: async () => apiRequest('GET', '/api/campaigns').then(res => res.json()), enabled: !!auth.isAuthenticated, staleTime: Infinity });
    const { data: flowsList = [], isLoading: isLoadingFlows } = useQuery<FlowData[]>({
        queryKey: ['flows'],
        queryFn: async () => apiRequest('GET', '/api/flows').then(res => res.json()),
        enabled: !!auth.isAuthenticated,
        onSuccess: (data) => {
            if (data && data.length > 0 && !data.some(f => String(f.id) === activeFlowId)) {
                setActiveFlowId(String(data[0].id));
            } else if (data.length === 0) {
                setActiveFlowId(null);
            }
        },
    });

    const activeFlow = useMemo(() => flowsList.find(f => String(f.id) === activeFlowId), [flowsList, activeFlowId]);

    const mutationOptions = {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
        onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
    };
    
    const updateFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('PUT', `/api/flows?id=${activeFlowId}`, data), ...mutationOptions, onSuccess: () => { mutationOptions.onSuccess(); toast({ title: "Fluxo Salvo!" }); } });
    const createFlowMutation = useMutation({ mutationFn: (data: any) => apiRequest('POST', '/api/flows', data), ...mutationOptions, onSuccess: (newFlow: FlowData) => { mutationOptions.onSuccess(); setActiveFlowId(String(newFlow.id)); setActiveTab('flow-builder'); toast({ title: "Fluxo Criado!" }); } });
    const deleteFlowMutation = useMutation({ mutationFn: (id: string) => apiRequest('DELETE', `/api/flows?id=${id}`), ...mutationOptions, onSuccess: () => { mutationOptions.onSuccess(); setActiveFlowId(null); toast({ title: "Fluxo Excluído!" }); } });
    
    const handleCreateFlow = () => { const name = prompt("Nome do novo fluxo:", "Novo Fluxo"); if (name) createFlowMutation.mutate({ name, status: 'draft', elements: {nodes:[], edges:[]} }); };
    const handleDeleteFlow = (id: string) => { if (window.confirm("Tem certeza?")) deleteFlowMutation.mutate(id); };

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-3xl font-bold tracking-tight">WhatsApp Business</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="connection">Conectar</TabsTrigger>
                    <TabsTrigger value="flows">Fluxos Salvos</TabsTrigger>
                    <TabsTrigger value="flow-builder">Editor Visual</TabsTrigger>
                </TabsList>
                <TabsContent value="connection"><WhatsAppConnection /></TabsContent>
                <TabsContent value="flows">
                    <Card><CardHeader><Button onClick={handleCreateFlow}><Plus className="mr-2 h-4 w-4"/>Novo Fluxo</Button></CardHeader>
                        <CardContent>
                            {isLoadingFlows ? <Loader2 className="animate-spin" /> : 
                            <div className="space-y-2">{flowsList.map(flow => (
                                <div key={flow.id} onClick={() => {setActiveFlowId(String(flow.id)); setActiveTab('flow-builder');}} className={cn("p-3 rounded-md cursor-pointer border", activeFlowId === String(flow.id) ? "border-primary bg-muted" : "hover:bg-muted/50")}>
                                    <div className="flex justify-between items-center"><p className="font-semibold">{flow.name}</p><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>{e.stopPropagation(); handleDeleteFlow(String(flow.id))}}><IconTrash className="w-4 h-4 text-destructive"/></Button></div>
                                    <Badge variant={flow.status === 'active' ? 'default' : 'secondary'}>{flow.status}</Badge>
                                </div>
                            ))}</div>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="flow-builder" className="h-[calc(100vh-250px)]">
                    <ReactFlowProvider> 
                        <FlowEditorInner 
                          activeFlow={activeFlow} 
                          campaignList={campaignList} 
                          onSave={(data) => updateFlowMutation.mutate(data)} 
                          onToggleStatus={(status) => updateFlowMutation.mutate({ status })}
                          isLoading={updateFlowMutation.isPending} 
                        />
                    </ReactFlowProvider>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default WhatsApp;
