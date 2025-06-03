// zap/client/src/components/ZapWhatsAppConnection.tsx
import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zap_client/components/ui/card";
import { Button } from "@zap_client/components/ui/button";
import { Badge } from "@zap_client/components/ui/badge";
import { Input } from "@zap_client/components/ui/input";
import { Label } from "@zap_client/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zap_client/components/ui/tabs";
import { Alert, AlertDescription } from "@zap_client/components/ui/alert"; // Renomeado AlertDescription para UIAlertDescription se houver conflito com DialogDescription
import {
  Smartphone,
  QrCode,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Copy,
  Download,
  Shield,
  Zap as ZapIcon, // Renomeado para ZapIcon
  Loader2,
  Unlink,
  Info,
} from "lucide-react";
import QRCodeReact from "qrcode.react"; // Usando QRCodeReact diretamente para teste
// import QRCodeDisplay from "./QRCodeDisplay"; // Certifique-se que este componente existe ou crie-o

interface WhatsAppConnectionStatus {
  status:
    | "DISCONNECTED"
    | "CONNECTED"
    | "PENDING_QR"
    | "ERROR"
    | "INITIALIZING";
  qrCode?: string | null;
  connectedPhoneNumber?: string | null;
  deviceName?: string | null;
  batteryLevel?: number | null;
  lastSeen?: string | null;
  lastError?: string | null;
}

interface ApiError {
  message: string;
  details?: any;
}

const mockApiCall = async (action: string, payload?: any): Promise<any> => {
  console.log(`[API Mock] Action: ${action}`, payload);
  await new Promise((resolve) =>
    setTimeout(resolve, 1000 + Math.random() * 1000),
  );

  if (action === "generate-qr") {
    if (Math.random() < 0.1) throw new Error("Failed to generate QR");
    return { status: "PENDING_QR", qrCode: `mock-qr-data-${Date.now()}` };
  }
  if (action === "get-status") {
    const rand = Math.random();
    if (rand < 0.3) return { status: "DISCONNECTED", lastError: null };
    if (rand < 0.6)
      return { status: "PENDING_QR", qrCode: `mock-qr-data-${Date.now()}` };
    if (rand < 0.9)
      return {
        status: "CONNECTED",
        connectedPhoneNumber: "+1234567890",
        deviceName: "iPhone 13",
        batteryLevel: Math.floor(Math.random() * 70) + 30,
        lastSeen: new Date(
          Date.now() - Math.random() * 100000,
        ).toLocaleTimeString(),
      };
    return { status: "ERROR", lastError: "Unexpected connection error." };
  }
  if (action === "disconnect") {
    return { status: "DISCONNECTED" };
  }
  return { status: "INITIALIZING" };
};

interface ZapWhatsAppConnectionProps {
  onConnectionChange?: (status: WhatsAppConnectionStatus) => void;
}

export default function ZapWhatsAppConnection({
  onConnectionChange,
}: ZapWhatsAppConnectionProps) { // Removido valor padrão {}
  const [connectionStatus, setConnectionStatus] =
    useState<WhatsAppConnectionStatus>({ status: "INITIALIZING" });
  const [isLoading, setIsLoading] = useState(false);
  const [apiToken, setApiToken] = useState("");

  const fetchStatus = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const data: WhatsAppConnectionStatus = await mockApiCall("get-status");
        setConnectionStatus(data);
        if (onConnectionChange) onConnectionChange(data);
      } catch (error) {
        console.error("Error fetching status:", error);
        setConnectionStatus({
          status: "ERROR",
          lastError: (error as ApiError).message || "Communication error",
        });
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [onConnectionChange],
  );

  const generateAndSetQRCode = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: WhatsAppConnectionStatus = await mockApiCall("generate-qr");
      setConnectionStatus(data);
    } catch (error) {
      console.error("Error generating QR Code:", error);
      setConnectionStatus((prev) => ({
        ...prev,
        status: "ERROR",
        lastError: (error as ApiError).message || "Failed to generate QR",
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect your WhatsApp session?",
      )
    )
      return;
    setIsLoading(true);
    try {
      await mockApiCall("disconnect");
      setConnectionStatus({ status: "DISCONNECTED", qrCode: null });
      if (onConnectionChange) onConnectionChange({ status: "DISCONNECTED" });
    } catch (error) {
      console.error("Error disconnecting:", error);
      setConnectionStatus((prev) => ({
        ...prev,
        status: "ERROR",
        lastError: (error as ApiError).message || "Failed to disconnect",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(false), 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (connectionStatus.status === "PENDING_QR" && !connectionStatus.qrCode) {
      generateAndSetQRCode();
    }
  }, [connectionStatus.status, connectionStatus.qrCode, generateAndSetQRCode]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const webhookUrlToCopy = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/zap/webhook`;

  return (
    <Card className="shadow-xl bg-background neu-card">
      <CardHeader className="border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Smartphone className="mr-2 h-5 w-5 text-primary" />
            WhatsApp Connection
          </CardTitle>
          <Badge
            variant={
              connectionStatus.status === "CONNECTED"
                ? "default"
                : connectionStatus.status === "PENDING_QR" ||
                    connectionStatus.status === "INITIALIZING"
                  ? "secondary"
                  : "destructive"
            }
            className={`px-3 py-1 text-xs font-medium ${connectionStatus.status === "CONNECTED" ? "bg-green-500 text-white" : ""}`}
          >
            {connectionStatus.status === "CONNECTED" && (
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            )}
            {connectionStatus.status === "ERROR" && (
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            )}
            {connectionStatus.status === "PENDING_QR" && (
              <QrCode className="w-3.5 h-3.5 mr-1.5" />
            )}
            {connectionStatus.status === "INITIALIZING" && (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            )}
            {connectionStatus.status === "DISCONNECTED" && (
              <Unlink className="w-3.5 h-3.5 mr-1.5" />
            )}
            {connectionStatus.status === "CONNECTED"
              ? `Connected (${connectionStatus.connectedPhoneNumber || ""})`
              : connectionStatus.status === "PENDING_QR"
                ? "Waiting for QR Code"
                : connectionStatus.status === "ERROR"
                  ? `Error: ${connectionStatus.lastError || "Unknown"}`
                  : connectionStatus.status === "INITIALIZING"
                    ? "Initializing..."
                    : "Disconnected"}
          </Badge>
        </div>
        <CardDescription>
          Manage your WhatsApp Business API connection for automations and
          messaging.
        </CardDescription>
      </CardHeader>
      <Tabs defaultValue="connect" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4">
          <TabsTrigger value="connect" className="text-xs neu-button">
            <ZapIcon className="mr-1.5 h-3.5 w-3.5" />
            Connect
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs neu-button">
            <Info className="mr-1.5 h-3.5 w-3.5" />
            Status
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs neu-button">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connect" className="p-6">
          {connectionStatus.status === "PENDING_QR" &&
            connectionStatus.qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <p className="text-center text-muted-foreground">
                  Scan the QR Code below with the WhatsApp app on your phone to
                  connect.
                </p>
                {/* Substituído QRCodeDisplay por QRCodeReact diretamente para teste */}
                <div className="p-2 border-4 border-primary rounded-lg bg-white inline-block neu-card">
                  <QRCodeReact value={connectionStatus.qrCode} size={256} level="M" />
                </div>
                <div className="flex space-x-2">
                    <Button onClick={generateAndSetQRCode} disabled={isLoading} variant="outline" className="neu-button">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Renovar QR
                    </Button>
                    {/* <Button onClick={downloadQRCodeImage} variant="outline" className="neu-button"> 
                        <Download className="mr-2 h-4 w-4" /> Baixar QR
                    </Button> */}
                </div>
                <Alert className="mt-4 neu-card-inset">
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a
                    Device.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          {connectionStatus.status === "CONNECTED" && (
            <div className="text-center space-y-3">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
              <h3 className="text-xl font-semibold">Successfully Connected!</h3>
              <p className="text-muted-foreground">
                Number:{" "}
                <span className="font-medium text-foreground">
                  {connectionStatus.connectedPhoneNumber}
                </span>
                <br />
                Device:{" "}
                <span className="font-medium text-foreground">
                  {connectionStatus.deviceName}
                </span>
              </p>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                disabled={isLoading}
                  className="neu-button"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>
          )}
          {(connectionStatus.status === "DISCONNECTED" ||
            connectionStatus.status === "INITIALIZING" ||
            connectionStatus.status === "ERROR") &&
            !connectionStatus.qrCode && (
              <div className="text-center space-y-3">
                {isLoading && connectionStatus.status === "INITIALIZING" && (
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />
                )}
                {connectionStatus.status === "ERROR" && (
                  <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
                )}
                <p className="text-muted-foreground">
                  {connectionStatus.status === "ERROR"
                    ? `Error: ${connectionStatus.lastError}`
                    : "Click to generate the QR Code and start connecting."}
                </p>
                <Button onClick={generateAndSetQRCode} disabled={isLoading} className="neu-button-primary">
                  <QrCode className="mr-2 h-4 w-4" /> Generate QR Code
                </Button>
              </div>
            )}
        </TabsContent>

        <TabsContent value="status" className="p-6 space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-base">
                Connection Information
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>{" "}
                <Badge
                  variant={
                    connectionStatus.status === "CONNECTED"
                      ? "default"
                      : "outline"
                  }
                  className={
                    connectionStatus.status === "CONNECTED"
                      ? "bg-green-500 text-white"
                      : ""
                  }
                >
                  {connectionStatus.status}
                </Badge>
              </div>
              {connectionStatus.status === "CONNECTED" && (
                <>
                  <div className="flex justify-between">
                    <span>Connected Number:</span>{" "}
                    <span>{connectionStatus.connectedPhoneNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Device Name:</span>{" "}
                    <span>{connectionStatus.deviceName || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery Level:</span>{" "}
                    <span>
                      {connectionStatus.batteryLevel !== null &&
                      connectionStatus.batteryLevel !== undefined
                        ? `${connectionStatus.batteryLevel}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Seen:</span>{" "}
                    <span>{connectionStatus.lastSeen || "-"}</span>
                  </div>
                </>
              )}
              {connectionStatus.status === "ERROR" && (
                <div className="flex justify-between text-destructive">
                  <span>Last Error:</span>{" "}
                  <span>{connectionStatus.lastError || "Unknown"}</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Button
            onClick={() => fetchStatus()}
            variant="outline"
            className="w-full neu-button"
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh Status
          </Button>
        </TabsContent>

        <TabsContent value="settings" className="p-6 space-y-6">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-base">
                API Settings (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="apiToken" className="text-xs">
                  Your API Token (if using external provider)
                </Label>
                {/* LINHA ~200 - A linha do Input. Verifique esta sintaxe com atenção. */}
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Paste your token here if needed"
                  value={apiToken}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setApiToken(e.target.value)}
                  className="mt-1 neu-input"
                />
              </div>
              <Button className="text-xs neu-button" size="sm" type="button">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                <span>Save Token</span>
              </Button>
            </CardContent>
          </Card>
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-base">
                Webhook for Received Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Configure this URL in your WhatsApp provider to receive messages
                and events.
              </p>
              <div className="flex items-center space-x-2">
                <Input value={webhookUrlToCopy} readOnly className="text-xs neu-input" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrlToCopy)}
                  className="h-9 w-9 neu-button"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Alert className="neu-card-inset">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This endpoint is secure and expects specific data from the
                  WhatsApp API.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// Removida a função downloadQRCode pois não era usada no JSX de QRCodeDisplay
// e para simplificar, já que QRCodeDisplay não foi fornecido.
// Se precisar dela, pode adicionar de volta.
