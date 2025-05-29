import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  MessageSquare, 
  HelpCircle, 
  GitBranch, 
  Clock, 
  Zap,
  Plus,
  Edit,
  Trash2,
  Play,
  Save,
  Eye,
  ArrowRight,
  Move
} from 'lucide-react';

interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action' | 'delay' | 'start';
  position: { x: number; y: number };
  data: {
    title: string;
    content: string;
    options?: string[];
    delay?: number;
    condition?: string;
    action?: string;
  };
  connections: string[];
}

interface FlowBuilderProps {
  initialNodes?: FlowNode[];
  onSave?: (nodes: FlowNode[]) => void;
}

export default function FlowBuilder({ initialNodes = [], onSave }: FlowBuilderProps) {
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes.length > 0 ? initialNodes : [
    {
      id: 'start',
      type: 'start',
      position: { x: 100, y: 100 },
      data: { title: 'Início', content: 'Gatilho do fluxo' },
      connections: []
    }
  ]);
  
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const nodeTypes = [
    { type: 'message', icon: MessageSquare, label: 'Mensagem', color: 'bg-blue-500' },
    { type: 'question', icon: HelpCircle, label: 'Pergunta', color: 'bg-green-500' },
    { type: 'condition', icon: GitBranch, label: 'Condição', color: 'bg-yellow-500' },
    { type: 'delay', icon: Clock, label: 'Aguardar', color: 'bg-purple-500' },
    { type: 'action', icon: Zap, label: 'Ação', color: 'bg-red-500' }
  ];

  const addNode = (type: string) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: type as any,
      position: { x: 200 + nodes.length * 50, y: 200 + nodes.length * 50 },
      data: {
        title: `Novo ${type}`,
        content: '',
        options: type === 'question' ? ['Opção 1', 'Opção 2'] : undefined,
        delay: type === 'delay' ? 5 : undefined
      },
      connections: []
    };
    
    setNodes([...nodes, newNode]);
  };

  const updateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    setNodes(nodes.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId === 'start') return; // Can't delete start node
    
    setNodes(nodes.filter(node => node.id !== nodeId));
    // Remove connections to deleted node
    setNodes(prevNodes => 
      prevNodes.map(node => ({
        ...node,
        connections: node.connections.filter(conn => conn !== nodeId)
      }))
    );
  };

  const connectNodes = (fromId: string, toId: string) => {
    setNodes(nodes.map(node => 
      node.id === fromId 
        ? { ...node, connections: [...node.connections, toId] }
        : node
    ));
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDraggedNode(nodeId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedNode || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;

    updateNode(draggedNode, {
      position: { x: Math.max(0, newX), y: Math.max(0, newY) }
    });
  }, [draggedNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
  }, []);

  // Add event listeners for mouse move and up
  React.useEffect(() => {
    if (draggedNode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedNode, handleMouseMove, handleMouseUp]);

  const getNodeIcon = (type: string) => {
    const nodeType = nodeTypes.find(nt => nt.type === type);
    return nodeType ? nodeType.icon : MessageSquare;
  };

  const getNodeColor = (type: string) => {
    const nodeType = nodeTypes.find(nt => nt.type === type);
    return nodeType ? nodeType.color : 'bg-gray-500';
  };

  const renderNode = (node: FlowNode) => {
    const Icon = getNodeIcon(node.type);
    const isSelected = selectedNode?.id === node.id;

    return (
      <div
        key={node.id}
        className={`absolute cursor-move transition-all duration-200 ${
          isSelected ? 'scale-105 z-10' : 'z-0'
        }`}
        style={{ 
          left: node.position.x, 
          top: node.position.y,
          transform: draggedNode === node.id ? 'scale(1.05)' : 'scale(1)'
        }}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
        onClick={() => setSelectedNode(node)}
      >
        <Card className={`w-48 neu-card ${isSelected ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full ${getNodeColor(node.type)} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{node.data.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {nodeTypes.find(nt => nt.type === node.type)?.label || node.type}
                  </Badge>
                </div>
              </div>
              {node.type !== 'start' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(node.id);
                  }}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground truncate">
              {node.data.content || 'Configure este nó...'}
            </p>
            {node.data.options && (
              <div className="mt-2 space-y-1">
                {node.data.options.slice(0, 2).map((option, idx) => (
                  <div key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                    {option}
                  </div>
                ))}
                {node.data.options.length > 2 && (
                  <div className="text-xs text-muted-foreground">
                    +{node.data.options.length - 2} mais...
                  </div>
                )}
              </div>
            )}
            {node.data.delay && (
              <div className="mt-2 text-xs text-muted-foreground">
                Aguardar: {node.data.delay}s
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection points */}
        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 transition-transform" />
        </div>
        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 bg-secondary rounded-full border-2 border-white shadow-md" />
        </div>
      </div>
    );
  };

  const renderConnections = () => {
    return nodes.map(node => 
      node.connections.map(connectionId => {
        const targetNode = nodes.find(n => n.id === connectionId);
        if (!targetNode) return null;

        const startX = node.position.x + 192; // Node width
        const startY = node.position.y + 80; // Node height / 2
        const endX = targetNode.position.x;
        const endY = targetNode.position.y + 80;

        return (
          <svg
            key={`${node.id}-${connectionId}`}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: -1 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="hsl(var(--primary))"
                />
              </marker>
            </defs>
            <path
              d={`M ${startX} ${startY} Q ${startX + 50} ${startY} ${endX - 50} ${endY} T ${endX} ${endY}`}
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="drop-shadow-sm"
            />
          </svg>
        );
      })
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">Editor de Fluxo</h3>
            <div className="flex items-center space-x-2">
              {nodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <Button
                    key={nodeType.type}
                    variant="outline"
                    size="sm"
                    onClick={() => addNode(nodeType.type)}
                    className="neu-button"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {nodeType.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="neu-button">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onSave?.(nodes)}
              className="neu-button"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
            <Button size="sm" className="neu-button">
              <Play className="w-4 h-4 mr-2" />
              Testar Fluxo
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-muted/20">
        <div
          ref={canvasRef}
          className="w-full h-full relative"
          style={{ minHeight: '600px' }}
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          
          {/* Render connections */}
          {renderConnections()}
          
          {/* Render nodes */}
          {nodes.map(renderNode)}
        </div>
      </div>

      {/* Node Editor Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Nó</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="node-title">Título</Label>
                <Input
                  id="node-title"
                  value={selectedNode.data.title}
                  onChange={(e) => 
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, title: e.target.value }
                    })
                  }
                  className="neu-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="node-content">Conteúdo</Label>
                <Textarea
                  id="node-content"
                  value={selectedNode.data.content}
                  onChange={(e) => 
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, content: e.target.value }
                    })
                  }
                  className="neu-input"
                  rows={3}
                />
              </div>

              {selectedNode.type === 'question' && (
                <div className="space-y-2">
                  <Label>Opções de Resposta</Label>
                  {selectedNode.data.options?.map((option, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(selectedNode.data.options || [])];
                          newOptions[idx] = e.target.value;
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, options: newOptions }
                          });
                        }}
                        className="neu-input"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOptions = selectedNode.data.options?.filter((_, i) => i !== idx);
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, options: newOptions }
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(selectedNode.data.options || []), 'Nova opção'];
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, options: newOptions }
                      });
                    }}
                    className="neu-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Opção
                  </Button>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div className="space-y-2">
                  <Label htmlFor="delay-time">Tempo de Espera (segundos)</Label>
                  <Input
                    id="delay-time"
                    type="number"
                    value={selectedNode.data.delay || 0}
                    onChange={(e) => 
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, delay: parseInt(e.target.value) }
                      })
                    }
                    className="neu-input"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    updateNode(selectedNode.id, selectedNode);
                    setIsEditModalOpen(false);
                  }}
                  className="neu-button"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick edit panel */}
      {selectedNode && (
        <div className="border-t p-4 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full ${getNodeColor(selectedNode.type)} flex items-center justify-center`}>
                {React.createElement(getNodeIcon(selectedNode.type), { className: "w-4 h-4 text-white" })}
              </div>
              <div>
                <h4 className="font-semibold">{selectedNode.data.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {nodeTypes.find(nt => nt.type === selectedNode.type)?.label}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="neu-button"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}