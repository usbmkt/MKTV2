// zap/client/src/components/QRCodeDisplay.tsx
import React from 'react';
import QRCodeReact from 'qrcode.react';
import { Button } from '@zap_client/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';

interface QRCodeDisplayProps {
  qrCodeValue: string;
  onRefresh: () => void;
  isLoading: boolean;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ qrCodeValue, onRefresh, isLoading }) => {
  const downloadQRCodeImage = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement; // Adicionado ID para buscar o canvas correto
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'whatsapp-qr.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="p-2 border-4 border-primary rounded-lg bg-white inline-block neu-card">
        <QRCodeReact id="qr-code-canvas" value={qrCodeValue} size={256} level="M" /> {/* Adicionado ID */}
      </div>
      <div className="flex space-x-2">
        <Button onClick={onRefresh} disabled={isLoading} variant="outline" className="neu-button">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Renovar QR
        </Button>
        <Button onClick={downloadQRCodeImage} variant="outline" className="neu-button">
          <Download className="mr-2 h-4 w-4" /> Baixar QR
        </Button>
      </div>
    </div>
  );
};
export default QRCodeDisplay;
