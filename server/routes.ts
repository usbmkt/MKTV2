// server/routes.ts
// ...
app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Adicionar um log para verificar o req.body recebido
    console.log('[REGISTER_ROUTE] req.body recebido:', JSON.stringify(req.body));

    // Esta linha deveria lançar um ZodError se req.body for {} e os campos são obrigatórios
    const userData = insertUserSchema.parse(req.body);

    console.log('[REGISTER_ROUTE] userData após Zod parse:', JSON.stringify(userData));

    const existingUserByEmail = await storage.getUserByEmail(userData.email);
    if (existingUserByEmail) return res.status(409).json({ error: 'Usuário com este email já existe.' });

    const existingUserByUsername = await storage.getUserByUsername(userData.username);
    if (existingUserByUsername) return res.status(409).json({ error: 'Nome de usuário já está em uso.' });

    const user = await storage.createUser(userData); // Esta chamada agora está mais protegida pela verificação interna

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    // O erro da verificação em createUser (se userData for {}) será pego aqui
    // E se ZodError for lançado, ele também será pego aqui e passado para handleZodError
    next(error); 
  }
});
// ...
