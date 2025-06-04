// Conteúdo para: NodeContextMenu.tsx
import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"; // Ajuste se o caminho estiver diferente
import { Copy, Trash2, Edit3 } from 'lucide-react';
import { NodeContextMenuProps } from '@/types/zapTypes'; // Usando o novo caminho

interface FullNodeContextMenuProps extends NodeContextMenuProps {
  onClose: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  // onEdit?: (id: string) => void; // Adicionar se houver edição direta pelo menu
}

const NodeContextMenu: React.FC<FullNodeContextMenuProps> = ({
  id,
  top,
  left,
  nodeType,
  onClose,
  onDelete,
  onDuplicate,
  // onEdit
}) => {
  return (
    <div style={{ top, left, position: 'fixed', zIndex: 1000 }} onMouseLeave={onClose}>
      <ContextMenuContent className="w-48 neu-card"> {/* Aplicando estilo neu-card */}
        <ContextMenuItem onClick={() => onDuplicate(id)} className="text-xs">
          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar Nó
        </ContextMenuItem>
        {/* Adicionar "Editar Nó" se você tiver uma função para isso */}
        {/* {onEdit && (
          <ContextMenuItem onClick={() => onEdit(id)} className="text-xs">
            <Edit3 className="mr-2 h-3.5 w-3.5" /> Editar Nó
          </ContextMenuItem>
        )} */}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete(id)}
          className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Deletar Nó
        </ContextMenuItem>
      </ContextMenuContent>
    </div>
  );
};

export default NodeContextMenu;
