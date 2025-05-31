// client/src/config/copyConfigurations.ts
export type LaunchPhase = 'pre_launch' | 'launch' | 'post_launch';

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date';
  placeholder?: string;
  tooltip: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
  dependsOn?: string;
  showIf?: (formData: Record<string, any>) => boolean;
}

export interface CopyPurposeConfig {
  key: string;
  label: string;
  phase: LaunchPhase;
  fields: FieldDefinition[];
  category: string;
  promptEnhancer?: (basePrompt: string, details: Record<string, any>, baseForm: any /* BaseGeneratorFormState */) => string;
}

export const allCopyPurposesConfig: CopyPurposeConfig[] = [
  // --- PRÉ-LANÇAMENTO ---
  {
    key: 'prelaunch_ad_event_invitation',
    label: 'Anúncio: Convite para Evento Online Gratuito (Webinar/Masterclass)',
    phase: 'pre_launch',
    category: 'Anúncios (Pré-Lançamento)',
    fields: [
      { name: 'eventName', label: 'Nome do Evento *', type: 'text', placeholder: 'Ex: Masterclass "Decole Seu Negócio Online"', tooltip: 'O título principal do seu evento.', required: true },
      { name: 'eventSubtitle', label: 'Subtítulo do Evento (Opcional)', type: 'text', placeholder: 'Ex: O guia definitivo para...', tooltip: 'Uma frase curta para complementar o nome.'},
      { name: 'eventFormat', label: 'Formato do Evento', type: 'text', placeholder: 'Ex: Workshop online de 3 dias via Zoom', tooltip: 'Descreva como será o evento (live, gravado, desafio, etc.).', defaultValue: 'Webinar Ao Vivo' },
      { name: 'eventDateTime', label: 'Data e Hora Principal do Evento *', type: 'text', placeholder: 'Ex: Terça, 25 de Junho, às 20h (Horário de Brasília)', tooltip: 'Quando o evento principal acontecerá? Inclua fuso horário se relevante.', required: true },
      { name: 'eventDuration', label: 'Duração Estimada do Evento', type: 'text', placeholder: 'Ex: Aproximadamente 1h30', tooltip: 'Quanto tempo o público deve reservar?' },
      { name: 'eventPromise', label: 'Principal Promessa/Transformação do Evento *', type: 'textarea', placeholder: 'Ex: Você vai descobrir o método exato para criar anúncios que vendem todos os dias, mesmo começando do zero.', tooltip: 'O que a pessoa vai ganhar/aprender de mais valioso?', required: true },
      { name: 'eventTopics', label: 'Principais Tópicos Abordados (1 por linha) *', type: 'textarea', placeholder: 'Ex:\n- Como definir seu público ideal\n- Os 3 erros que te fazem perder dinheiro em anúncios\n- O segredo das headlines que convertem', tooltip: 'Liste os pontos chave que serão ensinados.', required: true },
      { name: 'eventTargetAudience', label: 'Público Específico Deste Evento', type: 'text', placeholder: 'Ex: Empreendedores que já tentaram anunciar e não tiveram resultado', tooltip: 'Para quem este evento é especialmente desenhado?' },
      { name: 'eventCTA', label: 'Chamada para Ação do Anúncio *', type: 'text', placeholder: 'Ex: "Garanta sua vaga gratuita agora!" ou "Clique em Saiba Mais e inscreva-se!"', tooltip: 'O que você quer que a pessoa faça ao ver o anúncio?', required: true, defaultValue: 'Inscreva-se Gratuitamente!' },
      { name: 'urgencyScarcityElement', label: 'Elemento de Urgência/Escassez (Opcional)', type: 'text', placeholder: 'Ex: Vagas limitadas, Bônus para os 100 primeiros inscritos', tooltip: 'Algum motivo para a pessoa agir rápido?' },
    ],
  },
  {
    key: 'prelaunch_ad_lead_magnet_download',
    label: 'Anúncio: Download de Material Rico (E-book, Checklist)',
    phase: 'pre_launch',
    category: 'Anúncios (Pré-Lançamento)',
    fields: [
      { name: 'leadMagnetTitle', label: 'Título do Material Rico *', type: 'text', placeholder: 'Ex: Guia Completo: 5 Passos Para Organizar Suas Finanças', tooltip: 'O nome chamativo do seu e-book, checklist, template, etc.', required: true },
      { name: 'leadMagnetFormat', label: 'Formato do Material Rico', type: 'text', placeholder: 'Ex: E-book em PDF com 30 páginas, Planilha no Google Sheets', tooltip: 'Qual o formato prático do material?', defaultValue: 'E-book PDF' },
      { name: 'leadMagnetBenefit', label: 'Principal Benefício/Problema que Resolve *', type: 'textarea', placeholder: 'Ex: Aprenda a sair das dívidas e começar a investir em 30 dias com este guia prático.', tooltip: 'Qual a grande vantagem ou solução que o material oferece?', required: true },
      { name: 'leadMagnetContentTeaser', label: 'Conteúdo Resumido/Destaques (1 por linha)', type: 'textarea', placeholder: 'Ex:\n- Checklist para controle de gastos\n- Planilha de orçamento mensal pronta para usar\n- Dicas de apps de finanças', tooltip: 'O que a pessoa encontrará de mais valioso dentro do material?'},
      { name: 'targetAudienceForMagnet', label: 'Público Ideal para este Material', type: 'text', placeholder: 'Ex: Pessoas que se sentem perdidas com suas finanças pessoais.', tooltip: 'Para quem este material é mais indicado?'},
      { name: 'leadMagnetCTA', label: 'Chamada para Ação do Anúncio *', type: 'text', placeholder: 'Ex: "Baixe seu guia gratuito agora!"', tooltip: 'O que você quer que a pessoa faça?', required: true, defaultValue: 'Download Gratuito!' },
    ],
  },
  {
    key: 'prelaunch_email_welcome_confirmation',
    label: 'E-mail: Boas-vindas e Confirmação de Inscrição',
    phase: 'pre_launch',
    category: 'E-mails (Pré-Lançamento)',
    fields: [
      { name: 'signupReason', label: 'Motivo da Inscrição do Lead *', type: 'text', placeholder: 'Ex: Inscrição na Masterclass XPTO, Download do Guia Y', tooltip: 'O que o lead fez para entrar na sua lista e receber este e-mail?', required: true },
      { name: 'deliveredItemName', label: 'Nome do Item Entregue (se houver)', type: 'text', placeholder: 'Ex: Acesso à Masterclass, Seu Guia de Finanças', tooltip: 'Nome do evento/material que está sendo confirmado/entregue.'},
      { name: 'deliveredItemLink', label: 'Link de Acesso/Download (se houver)', type: 'text', placeholder: 'Ex: https://...', tooltip: 'O link direto para o evento, material, grupo, etc.'},
      { name: 'senderName', label: 'Nome do Remetente do E-mail *', type: 'text', placeholder: 'Ex: João Silva da Empresa XPTO', tooltip: 'Como você ou sua empresa devem ser identificados?', required: true },
      { name: 'nextStepsForLead', label: 'Próximos Passos Sugeridos (1 por linha)', type: 'textarea', placeholder: 'Ex:\n- Adicione este e-mail aos seus contatos.\n- Marque na agenda o dia do nosso evento!\n- Siga-nos no Instagram @seuperfil', tooltip: 'O que você quer que o lead faça em seguida?'},
      { name: 'valueTeaser', label: 'Pequeno Teaser de Conteúdo Futuro (Opcional)', type: 'textarea', placeholder: 'Ex: Nos próximos dias, vou compartilhar dicas exclusivas sobre X...', tooltip: 'Uma pequena amostra do que mais ele pode esperar.'},
    ],
  },
  {
    key: 'prelaunch_social_post_value_engagement',
    label: 'Post Social: Conteúdo de Valor (Educação/Engajamento)',
    phase: 'pre_launch',
    category: 'Posts Redes Sociais (Pré-Lançamento)',
    fields: [
      { name: 'postTopic', label: 'Tópico Central do Post *', type: 'text', placeholder: 'Ex: 3 Mitos sobre Investimentos', tooltip: 'Sobre qual assunto específico será o post?', required: true },
      { name: 'postFormatSuggestion', label: 'Formato Sugerido', type: 'select', options: [{value: 'carrossel', label: 'Carrossel'}, {value: 'reels_script', label: 'Roteiro Reels/TikTok'}, {value: 'imagem_unica_texto', label: 'Imagem Única com Texto Longo'}, {value: 'enquete_story', label: 'Enquete para Story'}], tooltip: 'Qual formato visual/de conteúdo é mais adequado?', defaultValue: 'carrossel'},
      { name: 'mainTeachingPoint', label: 'Principal Ensinamento/Dica *', type: 'textarea', placeholder: 'Ex: A importância de começar pequeno.', tooltip: 'Qual a mensagem chave ou lição?', required: true},
      { name: 'supportingPoints', label: 'Pontos de Suporte (1 por linha)', type: 'textarea', placeholder: 'Ex:\n- Dica prática 1...\n- Exemplo real...', tooltip: 'Detalhes que sustentam o ensinamento.'},
      { name: 'engagementPrompt', label: 'Chamada para Engajamento *', type: 'text', placeholder: 'Ex: "Qual sua maior dificuldade? Comenta aqui!"', tooltip: 'Como incentivar interação?', required: true},
      { name: 'relevantHashtags', label: 'Hashtags Relevantes (,)', type: 'text', placeholder: '#dicas, #marketing', tooltip: 'Sugestões de hashtags.'}
    ]
  },
  // --- LANÇAMENTO ---
  {
    key: 'launch_sales_page_headline',
    label: 'Página de Vendas: Headline Principal',
    phase: 'launch',
    category: 'Página de Vendas',
    fields: [
      { name: 'productName', label: 'Nome do Produto/Oferta Principal *', type: 'text', placeholder: 'Ex: Curso Online "Método Vendas Imparáveis"', required: true, tooltip: 'O nome exato do seu produto/serviço.'  },
      { name: 'mainTransformation', label: 'Principal Transformação/Resultado da Oferta *', type: 'textarea', placeholder: 'Ex: Conquistar seus primeiros 10 clientes em 30 dias.', required: true, tooltip: 'O resultado final mais desejado.' },
      { name: 'targetAudiencePain', label: 'Principal Dor/Problema do Público Resolvido *', type: 'text', placeholder: 'Ex: Dificuldade em atrair clientes qualificados.', required: true, tooltip: 'Qual o maior problema que seu produto soluciona?' },
      { name: 'uniqueMechanism', label: 'Mecanismo Único/Diferencial (Opcional)', type: 'text', placeholder: 'Ex: Nosso método "Cliente Atrai Cliente".', tooltip: 'Sua abordagem única.'},
      { name: 'timeOrEffortElement', label: 'Elemento de Tempo/Esforço (Opcional)', type: 'text', placeholder: 'Ex: Em apenas 15 minutos por dia.', tooltip: 'Como economiza tempo ou simplifica.'},
    ]
  },
  {
    key: 'launch_ad_direct_to_sales_page',
    label: 'Anúncio: Direto para Página de Vendas',
    phase: 'launch',
    category: 'Anúncios (Lançamento)',
    fields: [
      { name: 'productName', label: 'Nome do Produto/Oferta Principal *', type: 'text', required: true, tooltip: 'O nome exato do seu produto/serviço.'  },
      { name: 'offerHeadline', label: 'Headline Principal do Anúncio *', type: 'text', placeholder: 'Ex: Cansado de...? Descubra como!', required: true, tooltip: 'A frase de impacto para o anúncio.'},
      { name: 'keyBenefits', label: 'Principais Benefícios da Oferta (1 por linha) *', type: 'textarea', placeholder: 'Ex:\n- Aumente suas vendas\n- Tenha clareza', required: true, tooltip: 'Resultados mais atraentes.'},
      { name: 'targetAudienceFocus', label: 'Foco no Público-Alvo *', type: 'text', placeholder: 'Ex: Para coaches que querem lotar a agenda.', required: true, tooltip: 'Conexão direta com o público.'},
      { name: 'callToActionSalesPage', label: 'CTA para Página de Vendas *', type: 'text', placeholder: 'Ex: "Clique em Saiba Mais!"', required: true, defaultValue: 'Ver Detalhes e Inscrever-se!'},
      { name: 'urgencyElementLaunch', label: 'Urgência/Escassez (Opcional)', type: 'text', placeholder: 'Ex: Inscrições SÓ esta semana!', tooltip: 'Por que agir agora?'},
    ]
  },
  {
    key: 'launch_email_cart_open',
    label: 'E-mail: Abertura de Carrinho',
    phase: 'launch',
    category: 'E-mails (Lançamento)',
    fields: [
      { name: 'productName', label: 'Nome do Produto/Oferta Principal *', type: 'text', required: true, tooltip: 'O nome exato do seu produto/serviço.'  },
      { name: 'greetingLine', label: 'Saudação Personalizada (Opcional)', type: 'text', placeholder: 'Ex: Chegou o momento, [Nome]!', tooltip: 'Abertura pessoal.'},
      { name: 'mainOfferAnnouncement', label: 'Anúncio Principal da Abertura *', type: 'textarea', placeholder: 'Ex: As portas para o [Produto] estão abertas!', required: true, tooltip: 'Mensagem central.'},
      { name: 'linkToSalesPage', label: 'Link da Página de Vendas *', type: 'text', placeholder: 'https://...', required: true, tooltip: 'URL da página de vendas.'},
      { name: 'keyBonusesIfAny', label: 'Bônus Principais (1 por linha, opcional)', type: 'textarea', placeholder: 'Ex:\n- Bônus 1: Acesso VIP', tooltip: 'Bônus importantes.'},
      { name: 'reasonToActNow', label: 'Motivo para Agir Agora *', type: 'text', placeholder: 'Ex: Bônus para os 50 primeiros.', required: true, tooltip: 'Urgência/Escassez.'},
      { name: 'senderSignature', label: 'Assinatura do E-mail *', type: 'text', placeholder: 'Ex: Abraços, João', required: true},
    ]
  },
  // --- PÓS-LANÇAMENTO ---
  {
    key: 'postlaunch_email_thank_you_non_buyers',
    label: 'E-mail: Agradecimento para Não Compradores',
    phase: 'post_launch',
    category: 'E-mails (Pós-Lançamento)',
    fields: [
      { name: 'launchName', label: 'Nome do Lançamento Encerrado *', type: 'text', placeholder: 'Ex: Curso Vendas Imparáveis', required: true, tooltip: 'Qual produto teve o carrinho fechado?' },
      { name: 'mainThankYouMessage', label: 'Mensagem Principal de Agradecimento *', type: 'textarea', placeholder: 'Ex: Agradeço seu interesse no [Lançamento].', required: true, tooltip: 'Seja genuíno.' },
      { name: 'valueDeliveredDuringLaunch', label: 'Relembrar Valor Entregue (Opcional)', type: 'text', placeholder: 'Ex: Espero que os conteúdos da Semana X tenham sido úteis.', tooltip: 'Valor compartilhado gratuitamente.'},
      { name: 'futureOpportunityTeaser', label: 'Teaser para Futuras Oportunidades (Opcional)', type: 'text', placeholder: 'Ex: Em breve teremos mais novidades.', tooltip: 'Deixe uma porta aberta.'},
      { name: 'feedbackRequestLink', label: 'Link para Pesquisa de Feedback (Opcional)', type: 'text', placeholder: 'Ex: https://forms.gle/suapesquisa', tooltip: 'Link para feedback.'},
    ],
  },
  // Adicione mais finalidades conforme a lista completa discutida (anuncio_lista_espera_vip, etc.)
];

// Adicionando as outras finalidades mencionadas no prompt, mas com campos placeholder por enquanto.
// O USUÁRIO DEVE COMPLETAR ESSES CAMPOS DETALHADAMENTE.
const placeholderFields: FieldDefinition[] = [
  { name: 'detail1', label: 'Detalhe Importante 1*', type: 'text', placeholder: 'Informação crucial para esta copy', tooltip: 'Descreva o primeiro detalhe essencial.', required: true },
  { name: 'detail2', label: 'Detalhe Importante 2', type: 'textarea', placeholder: 'Mais informações sobre o tópico', tooltip: 'Descreva o segundo detalhe importante.' },
  { name: 'cta_specific', label: 'Chamada para Ação Específica', type: 'text', placeholder: 'Ex: "Saiba Mais Agora Mesmo!"', tooltip: 'Qual ação o usuário deve tomar?', defaultValue: 'Veja Mais' }
];

allCopyPurposesConfig.push(
  { key: 'prelaunch_ad_waitlist_vip', label: 'Anúncio: Lista de Espera/VIP', phase: 'pre_launch', category: 'Anúncios (Pré-Lançamento)', fields: placeholderFields },
  { key: 'prelaunch_social_post_anticipation', label: 'Post Social: Curiosidade/Antecipação', phase: 'pre_launch', category: 'Posts Redes Sociais (Pré-Lançamento)', fields: placeholderFields },
  { key: 'prelaunch_landing_page_title', label: 'Página de Captura: Título Principal', phase: 'pre_launch', category: 'Página de Captura', fields: placeholderFields },
  { key: 'prelaunch_email_value_nurturing', label: 'E-mail: Conteúdo de Valor (Aquecimento)', phase: 'pre_launch', category: 'E-mails (Pré-Lançamento)', fields: placeholderFields },
  { key: 'launch_email_testimonial_proof', label: 'E-mail: Prova Social/Depoimentos', phase: 'launch', category: 'E-mails (Lançamento)', fields: placeholderFields },
  { key: 'launch_email_objection_handling', label: 'E-mail: Quebra de Objeções', phase: 'launch', category: 'E-mails (Lançamento)', fields: placeholderFields },
  { key: 'launch_email_last_chance_24h', label: 'E-mail: Última Chance (24h)', phase: 'launch', category: 'E-mails (Lançamento)', fields: placeholderFields },
  { key: 'launch_email_cart_closing_soon', label: 'E-mail: Carrinho Fechando em Breve', phase: 'launch', category: 'E-mails (Lançamento)', fields: placeholderFields },
  { key: 'launch_social_post_product_demo', label: 'Post Social: Demonstração do Produto', phase: 'launch', category: 'Posts Redes Sociais (Lançamento)', fields: placeholderFields },
  { key: 'launch_social_post_live_qa', label: 'Post Social: Sessão de Q&A Ao Vivo', phase: 'launch', category: 'Posts Redes Sociais (Lançamento)', fields: placeholderFields },
  { key: 'postlaunch_email_survey_buyers', label: 'E-mail: Pesquisa de Satisfação (Compradores)', phase: 'post_launch', category: 'E-mails (Pós-Lançamento)', fields: placeholderFields },
  { key: 'postlaunch_email_upsell_cross_sell', label: 'E-mail: Upsell/Cross-sell para Compradores', phase: 'post_launch', category: 'E-mails (Pós-Lançamento)', fields: placeholderFields },
  { key: 'postlaunch_social_post_student_results', label: 'Post Social: Resultados de Alunos/Clientes', phase: 'post_launch', category: 'Posts Redes Sociais (Pós-Lançamento)', fields: placeholderFields }
);
