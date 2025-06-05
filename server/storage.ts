// server/storage.ts
import bcrypt from 'bcrypt';
import * as schemaShared from "../shared/schema";

// Simulando um banco de dados em memória (substitua por sua implementação real)
interface Database {
  users: schemaShared.User[];
  campaigns: schemaShared.Campaign[];
  creatives: schemaShared.Creative[];
  flows: schemaShared.Flow[];
  landingPages: schemaShared.LandingPage[];
}

// Base de dados em memória
const db: Database = {
  users: [],
  campaigns: [],
  creatives: [],
  flows: [],
  landingPages: []
};

// Contadores para IDs
let userIdCounter = 1;
let campaignIdCounter = 1;
let creativeIdCounter = 1;
let flowIdCounter = 1;
let landingPageIdCounter = 1;

class Storage {
  // Métodos de usuário
  async getUser(id: number): Promise<schemaShared.User | null> {
    return db.users.find(user => user.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<schemaShared.User | null> {
    return db.users.find(user => user.email === email) || null;
  }

  async createUser(userData: Omit<schemaShared.User, 'id' | 'createdAt' | 'updatedAt'>): Promise<schemaShared.User> {
    const now = new Date();
    const user: schemaShared.User = {
      id: userIdCounter++,
      ...userData,
      createdAt: now,
      updatedAt: now
    };
    db.users.push(user);
    return user;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Métodos de campanhas
  async getCampaignsByUserId(userId: number): Promise<schemaShared.Campaign[]> {
    return db.campaigns.filter(campaign => campaign.userId === userId);
  }

  async createCampaign(campaignData: Omit<schemaShared.Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<schemaShared.Campaign> {
    const now = new Date();
    const campaign: schemaShared.Campaign = {
      id: campaignIdCounter++,
      ...campaignData,
      createdAt: now,
      updatedAt: now
    };
    db.campaigns.push(campaign);
    return campaign;
  }

  async updateCampaign(id: number, updateData: Partial<schemaShared.Campaign>, userId: number): Promise<schemaShared.Campaign> {
    const campaignIndex = db.campaigns.findIndex(c => c.id === id && c.userId === userId);
    if (campaignIndex === -1) {
      throw new Error('Campanha não encontrada ou não pertence ao usuário');
    }

    const updatedCampaign = {
      ...db.campaigns[campaignIndex],
      ...updateData,
      updatedAt: new Date()
    };
    db.campaigns[campaignIndex] = updatedCampaign;
    return updatedCampaign;
  }

  async deleteCampaign(id: number, userId: number): Promise<void> {
    const campaignIndex = db.campaigns.findIndex(c => c.id === id && c.userId === userId);
    if (campaignIndex === -1) {
      throw new Error('Campanha não encontrada ou não pertence ao usuário');
    }
    db.campaigns.splice(campaignIndex, 1);
  }

  // Métodos de criativos
  async getCreativesByUserId(userId: number): Promise<schemaShared.Creative[]> {
    return db.creatives.filter(creative => creative.userId === userId);
  }

  async createCreative(creativeData: Omit<schemaShared.Creative, 'id' | 'createdAt' | 'updatedAt'>): Promise<schemaShared.Creative> {
    const now = new Date();
    const creative: schemaShared.Creative = {
      id: creativeIdCounter++,
      ...creativeData,
      createdAt: now,
      updatedAt: now
    };
    db.creatives.push(creative);
    return creative;
  }

  async updateCreative(id: number, updateData: Partial<schemaShared.Creative>, userId: number): Promise<schemaShared.Creative> {
    const creativeIndex = db.creatives.findIndex(c => c.id === id && c.userId === userId);
    if (creativeIndex === -1) {
      throw new Error('Criativo não encontrado ou não pertence ao usuário');
    }

    const updatedCreative = {
      ...db.creatives[creativeIndex],
      ...updateData,
      updatedAt: new Date()
    };
    db.creatives[creativeIndex] = updatedCreative;
    return updatedCreative;
  }

  async deleteCreative(id: number, userId: number): Promise<void> {
    const creativeIndex = db.creatives.findIndex(c => c.id === id && c.userId === userId);
    if (creativeIndex === -1) {
      throw new Error('Criativo não encontrado ou não pertence ao usuário');
    }
    db.creatives.splice(creativeIndex, 1);
  }

  // Métodos de fluxos
  async getFlowsByUserId(userId: number): Promise<schemaShared.Flow[]> {
    return db.flows.filter(flow => flow.userId === userId);
  }

  async createFlow(flowData: Omit<schemaShared.Flow, 'id' | 'createdAt' | 'updatedAt'>): Promise<schemaShared.Flow> {
    const now = new Date();
    const flow: schemaShared.Flow = {
      id: flowIdCounter++,
      ...flowData,
      createdAt: now,
      updatedAt: now
    };
    db.flows.push(flow);
    return flow;
  }

  async updateFlow(id: number, updateData: Partial<schemaShared.Flow>, userId: number): Promise<schemaShared.Flow> {
    const flowIndex = db.flows.findIndex(f => f.id === id && f.userId === userId);
    if (flowIndex === -1) {
      throw new Error('Fluxo não encontrado ou não pertence ao usuário');
    }

    const updatedFlow = {
      ...db.flows[flowIndex],
      ...updateData,
      updatedAt: new Date()
    };
    db.flows[flowIndex] = updatedFlow;
    return updatedFlow;
  }

  async deleteFlow(id: number, userId: number): Promise<void> {
    const flowIndex = db.flows.findIndex(f => f.id === id && f.userId === userId);
    if (flowIndex === -1) {
      throw new Error('Fluxo não encontrado ou não pertence ao usuário');
    }
    db.flows.splice(flowIndex, 1);
  }

  // Métodos de landing pages
  async getLandingPagesByUserId(userId: number): Promise<schemaShared.LandingPage[]> {
    return db.landingPages.filter(lp => lp.userId === userId);
  }

  async createLandingPage(lpData: Omit<schemaShared.LandingPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<schemaShared.LandingPage> {
    const now = new Date();
    const landingPage: schemaShared.LandingPage = {
      id: landingPageIdCounter++,
      ...lpData,
      createdAt: now,
      updatedAt: now
    };
    db.landingPages.push(landingPage);
    return landingPage;
  }

  async updateLandingPage(id: number, updateData: Partial<schemaShared.LandingPage>, userId: number): Promise<schemaShared.LandingPage> {
    const lpIndex = db.landingPages.findIndex(lp => lp.id === id && lp.userId === userId);
    if (lpIndex === -1) {
      throw new Error('Landing page não encontrada ou não pertence ao usuário');
    }

    const updatedLandingPage = {
      ...db.landingPages[lpIndex],
      ...updateData,
      updatedAt: new Date()
    };
    db.landingPages[lpIndex] = updatedLandingPage;
    return updatedLandingPage;
  }

  async deleteLandingPage(id: number, userId: number): Promise<void> {
    const lpIndex = db.landingPages.findIndex(lp => lp.id === id && lp.userId === userId);
    if (lpIndex === -1) {
      throw new Error('Landing page não encontrada ou não pertence ao usuário');
    }
    db.landingPages.splice(lpIndex, 1);
  }

  // Método utilitário para limpar todos os dados (útil para testes)
  async clearAll(): Promise<void> {
    db.users = [];
    db.campaigns = [];
    db.creatives = [];
    db.flows = [];
    db.landingPages = [];
    userIdCounter = 1;
    campaignIdCounter = 1;
    creativeIdCounter = 1;
    flowIdCounter = 1;
    landingPageIdCounter = 1;
  }

  // Método para obter estatísticas do banco
  async getStats(): Promise<{
    totalUsers: number;
    totalCampaigns: number;
    totalCreatives: number;
    totalFlows: number;
    totalLandingPages: number;
  }> {
    return {
      totalUsers: db.users.length,
      totalCampaigns: db.campaigns.length,
      totalCreatives: db.creatives.length,
      totalFlows: db.flows.length,
      totalLandingPages: db.landingPages.length
    };
  }
}

// Exporta uma instância única do storage
export const storage = new Storage();
