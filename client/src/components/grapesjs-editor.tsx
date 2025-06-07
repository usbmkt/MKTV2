import React, { useEffect, useRef } from 'react';
import grapesjs, { Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
// import grapesjsPresetWebpage from 'grapesjs-preset-webpage';

interface GrapesJsEditorProps {
  initialData?: any;
  onSave: (jsonData: string, htmlData: string, cssData: string) => void;
}

const GrapesJsEditor: React.FC<GrapesJsEditorProps> = ({ initialData, onSave }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<Editor | null>(null);

  useEffect(() => {
    if (editorRef.current && !editorInstance.current) {
      const editor = grapesjs.init({
        container: editorRef.current,
        fromElement: false,
        height: 'calc(100vh - 150px)',
        width: 'auto',
        storageManager: { autosave: false },
        assetManager: {
            // Configurações básicas, idealmente você integraria com seu backend
            assets: [],
            upload: false, // Desabilitar upload nativo se for usar um manager customizado
        },
        // plugins: [grapesjsPresetWebpage],
      });

      if (initialData) {
        try {
          // GrapesJS espera um objeto, não uma string JSON
          const dataToLoad = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
          editor.loadProjectData(dataToLoad);
        } catch (e) {
          console.error("Erro ao carregar dados no GrapesJS:", e);
        }
      }

      editor.Panels.addButton('options', [{
        id: 'save-db',
        className: 'fa fa-floppy-o',
        label: 'Salvar',
        command: () => {
          const projectData = editor.getProjectData();
          const htmlData = editor.getHtml();
          const cssData = editor.getCss();
          onSave(JSON.stringify(projectData), htmlData, cssData);
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

  return <div ref={editorRef} className="grapesjs-editor-wrapper" />;
};

export default GrapesJsEditor;
