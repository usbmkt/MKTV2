// ✅ CORREÇÃO: Usando a importação padrão do SDK que funciona em diferentes ambientes
import StudioEditor from '@grapesjs/studio-sdk/react';
import { 
    flexComponent, canvasFullSize, canvasGridMode, rteProseMirror, 
    tableComponent, swiperComponent, canvasEmptyState, iconifyComponent, 
    accordionComponent, listPagesComponent, fsLightboxComponent, 
    layoutSidebarButtons, youtubeAssetProvider, lightGalleryComponent 
} from '@grapesjs/studio-sdk-plugins';
import '@grapesjs/studio-sdk/style';

// ✅ CORREÇÃO: Removida a importação do React que não é mais necessária com o novo JSX transform
// import React from 'react'; 

interface StudioEditorComponentProps {
  // ✅ CORREÇÃO: A chave de licença agora é uma prop obrigatória
  licenseKey: string;
  projectId?: string;
  onProjectSave: (projectData: any, projectIdToSaveUnder: string) => Promise<void | { id: string }>;
  onProjectLoad: (projectIdToLoad: string) => Promise<{ project: any }>;
  onAssetsUpload: (files: File[]) => Promise<{ src: string }[]>; 
  onAssetsDelete: (assets: { src: string }[]) => Promise<void>;
  onEditorError?: (error: any) => void;
  onEditorLoad?: () => void;
  initialProjectData?: any;
}

const StudioEditorComponent: React.FC<StudioEditorComponentProps> = ({
  // ✅ CORREÇÃO: Recebendo a chave via props
  licenseKey,
  projectId,
  onProjectSave,
  onProjectLoad,
  onAssetsUpload,
  onAssetsDelete,
  onEditorError,
  onEditorLoad,
  initialProjectData,
}) => {
  // ✅ CORREÇÃO: Checagem robusta da licenseKey
  if (!licenseKey) {
    const errMsg = "Chave de licença do GrapesJS Studio não fornecida ao componente editor.";
    console.error("StudioEditorComponent:", errMsg);
    if (onEditorError) onEditorError(new Error(errMsg));
    return <div className="p-4 text-center text-destructive bg-destructive/10 rounded-md">Erro: {errMsg}</div>;
  }
  
  const projectConfig = projectId ? { id: projectId } : (initialProjectData ? { data: initialProjectData } : undefined);

  return (
    <StudioEditor
      // ✅ CORREÇÃO: Garantindo que a chave do componente React mude quando o projeto mudar, forçando a recriação
      key={projectId || 'new-studio-project-instance'}
      options={{
        licenseKey: licenseKey, // ✅ CORREÇÃO: Usando a prop
        theme: 'dark',
        project: projectConfig,
        assets: {
          storageType: 'self',
          onUpload: async ({ files }) => {
            try {
              const result = await onAssetsUpload(files);
              return result; 
            } catch (error) {
              console.error('StudioEditorComponent: Asset upload callback error:', error);
              if (onEditorError) onEditorError(error);
              return []; 
            }
          },
          onDelete: async ({ assets }) => {
            try {
              await onAssetsDelete(assets.map((asset: any) => ({ src: asset.src || asset.url || '' })));
            } catch (error) {
              console.error('StudioEditorComponent: Asset delete callback error:', error);
              if (onEditorError) onEditorError(error);
            }
          }
        },
        storage: {
          type: 'self',
          onSave: async ({ project }: any) => {
            try {
              // ✅ CORREÇÃO: Usa o projectId existente ou um novo ID baseado em timestamp para garantir que tenhamos um identificador.
              const idToSaveUnder = projectId || `new_${Date.now()}`;
              return await onProjectSave(project, idToSaveUnder); 
            } catch (error) {
              console.error('StudioEditorComponent: Project save callback error:', error);
              if (onEditorError) onEditorError(error);
              throw error; 
            }
          },
          onLoad: async () => {
            if (!projectId) {
              return { project: initialProjectData || {} }; 
            }
            try {
              const loadedData = await onProjectLoad(projectId);
              return loadedData;
            } catch (error) {
              console.error('StudioEditorComponent: Project load callback error:', error);
              if (onEditorError) onEditorError(error);
              throw error; 
            }
          },
          autosaveChanges: 50, 
          autosaveIntervalMs: 60000 
        },
        plugins: [
          flexComponent.init({}), canvasFullSize.init({}), canvasGridMode.init({}), rteProseMirror.init({}), 
          tableComponent.init({}), swiperComponent.init({}), canvasEmptyState.init({}), iconifyComponent.init({}), 
          accordionComponent.init({}), listPagesComponent.init({}), fsLightboxComponent.init({}), 
          layoutSidebarButtons.init({}), youtubeAssetProvider.init({}), lightGalleryComponent.init({})
        ],
        onLoad: () => {
           if (onEditorLoad) onEditorLoad();
        },
        onError: (error: any) => {
           if (onEditorError) onEditorError(error);
        }
      }}
    />
  );
};

export default StudioEditorComponent;
