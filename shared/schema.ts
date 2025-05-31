// client/src/pages/login.tsx
// Abaixo, indicar o caminho completo da pasta de destino.
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
import { Rocket, Loader2 } from 'lucide-react';

export default function Login() {
  const [, navigate] = useLocation();
  // Obtém login, register, isLoading (renomeado para authLoading) e error (renomeado para authError) do store
  const { login, register, isLoading: authLoading, error: authError, clearError } = useAuthStore(); 
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({
    email: 'admin@usbmkt.com', // Pré-preenchido para facilitar o teste
    password: 'admin123', // Pré-preenchido para facilitar o teste
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); // Limpa erros anteriores do store antes de uma nova tentativa

    // Chama a função login do store e captura o resultado booleano
    const success = await login(loginForm.email, loginForm.password); 

    if (success) {
      // Se o login foi bem-sucedido (retornou true)
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao USB MKT PRO V2',
      });
      navigate('/dashboard');
    } else {
      // Se o login falhou (retornou false)
      toast({
        title: 'Erro no login',
        // Usa a mensagem de erro que veio do store (authError), ou uma genérica se não houver
        description: authError || 'Verifique suas credenciais e tente novamente.',
        variant: 'destructive',
      });
    }
    // O estado de carregamento (authLoading) é gerenciado diretamente pelo useAuthStore
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); // Limpa erros anteriores

    // Chama a função register do store e captura o resultado booleano
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
    // O estado de carregamento (authLoading) é gerenciado diretamente pelo useAuthStore
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <Rocket className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">USB MKT PRO V2</CardTitle>
            <CardDescription>
              Plataforma completa de marketing digital
            </CardDescription>
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
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
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
                  />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}> {/* Usa o estado de carregamento do store */}
                  {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {/* Exibe loader se estiver carregando */}
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
                  />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}> {/* Usa o estado de carregamento do store */}
                  {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {/* Exibe loader se estiver carregando */}
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
