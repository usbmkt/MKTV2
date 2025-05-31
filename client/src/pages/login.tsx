// client/src/pages/login.tsx
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { Loader2 } from 'lucide-react'; // Rocket removido se o logo substituir

export default function Login() {
  const [, navigate] = useLocation();
  const { login, register, isLoading: authLoading, error: authError, clearError } = useAuthStore(); 
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: 'admin@usbmkt.com', password: 'admin123' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => { /* ... (como antes) ... */ };
  const handleRegister = async (e: React.FormEvent) => { /* ... (como antes) ... */ };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          {/* LOGO ADICIONADO AQUI */}
          <img 
            src="/logo-usbmkt.svg" // Coloque seu logo em client/public/logo-usbmkt.svg (ou .png)
            alt="USB MKT PRO V2 Logo"
            className="mx-auto h-16 w-auto object-contain mb-2" // Ajuste tamanho e margem
          />
          <div>
            <CardTitle className="text-2xl">USB MKT PRO V2</CardTitle>
            <CardDescription>Plataforma completa de marketing digital</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="login" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Registrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                {/* ... (campos do formulário como antes) ... */}
                <div> <Label htmlFor="login-email">Email</Label> <Input id="login-email" type="email" placeholder="seu@email.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required /> </div> <div> <Label htmlFor="login-password">Senha</Label> <Input id="login-password" type="password" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required /> </div>
                <Button type="submit" className="w-full" disabled={authLoading}> {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                {/* ... (campos do formulário como antes) ... */}
                <div> <Label htmlFor="register-username">Nome de usuário</Label> <Input id="register-username" type="text" placeholder="usuario123" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} required /> </div> <div> <Label htmlFor="register-email">Email</Label> <Input id="register-email" type="email" placeholder="seu@email.com" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required /> </div> <div> <Label htmlFor="register-password">Senha</Label> <Input id="register-password" type="password" placeholder="••••••••" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required /> </div>
                <Button type="submit" className="w-full" disabled={authLoading}> {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
