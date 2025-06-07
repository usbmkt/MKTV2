// client/src/components/grapesjs-editor.tsx
import React, { useEffect, useRef } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
// Se você for usar o preset de webpage, descomente a linha abaixo
// import grapesjsPresetWebpage from 'grapesjs-preset-webpage';

interface GrapesJsEditorProps {
  initialData?: string;
  onSave: (jsonData: string, htmlData: string, cssData: string) => void;
  pageName?: string;
}

const GrapesJsEditor: React.FC<GrapesJsEditorProps> = ({ initialData, onSave }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<Editor | null>(null);

  useEffect(() => {
    if (editorRef.current && !editorInstance.current) {
      const editor = grapesjs.init({
        container: editorRef.current,
        fromElement: false,
        // ✅ CORREÇÃO: Altura e largura flexíveis para preencher o container
        height: '100%',
        width: '100%',
        storageManager: {
          type: 'local',
          autosave: true,
          stepsBeforeSave: 5,
        },
        // Adicionar plugins aqui se desejar
        // plugins: [grapesjsPresetWebpage],
      });

      if (initialData) {
        try {
          editor.loadProjectData(JSON.parse(initialData));
        } catch (e) {
          console.error("GrapesJS: Erro ao carregar dados do projeto.", e);
        }
      } else {
        editor.setComponents(`
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; color: #333;">
            <h1>Sua Landing Page Começa Aqui!</h1>
            <p>Arraste e solte os blocos da barra lateral para construir.</p>
          </div>
        `);
      }
      
      editor.Panels.addButton('options', [{
        id: 'save-db',
        className: 'fa fa-floppy-o',
        label: '<i class="fa fa-floppy-o"></i>',
        command: () => {
          const jsonData = JSON.stringify(editor.getProjectData());
          const htmlData = editor.getHtml();
          const cssData = editor.getCss();
          onSave(jsonData, htmlData, cssData);
        },
        attributes: { title: 'Salvar no Banco de Dados' }
      }]);

      editorInstance.current = editor;
    }

    return () => {
      if (editorInstance.current) {
        editorInstance.current.destroy();
        editorInstance.current = null;
      }
    };
  }, [initialData, onSave]);

  // ✅ CORREÇÃO: O container do editor também deve ser flexível
  return <div ref={editorRef} className="h-full w-full" />;
};

export default GrapesJsEditor;
