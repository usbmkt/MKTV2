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
import { Loader2 } from 'lucide-react';
import LogoPng from '@/img/logo.png'; // ATUALIZADO O CAMINHO DO LOGO

export default function Login() {
  const [, navigate] = useLocation();
  const { login, register, isLoading: authLoading, error: authError, clearError } = useAuthStore(); 
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({
    email: 'admin@usbmkt.com', 
    password: 'admin123', 
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); 

    const success = await login(loginForm.email, loginForm.password); 

    if (success) {
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao USB MKT PRO V2',
      });
      navigate('/dashboard');
    } else {
      toast({
        title: 'Erro no login',
        description: authError || 'Verifique suas credenciais e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); 

    const success = await register(registerForm.username, registerForm.email, registerForm.password); 

    if (success) {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Bem-vindo ao USB MKT PRO V2',
      });
      navigate('/dashboard');
    } else {
      toast({
        title: 'Erro no registro',
        description: authError || 'Não foi possível criar sua conta. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md neu-card">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto w-20 h-20 mb-3"> 
            <img src={LogoPng} alt="USB MKT PRO V2 Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">USB MKT PRO V2</CardTitle> 
            <CardDescription className="text-muted-foreground">
              Plataforma completa de marketing digital
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-6 pb-8">
          <Tabs defaultValue="login" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 neu-card-inset p-1">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md">Login</TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md">Registrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    className="neu-input" 
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    className="neu-input"
                  />
                </div>
                <Button type="submit" className="w-full neu-button-primary" disabled={authLoading}>
                  {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-username">Nome de usuário</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="usuario123"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    required
                    className="neu-input"
                  />
                </div>
                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                    className="neu-input"
                  />
                </div>
                <div>
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                    className="neu-input"
                  />
                </div>
                <Button type="submit" className="w-full neu-button-primary" disabled={authLoading}>
                  {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
