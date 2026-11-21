export type ChurchCategory = 'jovens' | 'irmas' | 'ceia' | 'familia' | 'campanha';
export type PostFormatId = 'feed45' | 'square' | 'stories';
export type TextureStyle = 'none' | 'grain' | 'paper' | 'sparkles';
export type FrameStyle = 'none' | 'thin' | 'double' | 'corners';

export interface PostFormat {
  id: PostFormatId;
  label: string;
  width: number;
  height: number;
  ratioLabel: string;
}

export const POST_FORMATS: PostFormat[] = [
  { id: 'feed45', label: 'Feed Vertical', width: 1080, height: 1350, ratioLabel: '4:5' },
  { id: 'square', label: 'Quadrado', width: 1080, height: 1080, ratioLabel: '1:1' },
  { id: 'stories', label: 'Stories / Status', width: 1080, height: 1920, ratioLabel: '9:16' },
];

export interface ChurchProfile {
  churchName: string;
  address: string;
  logoDataUrl: string | null;
  localPastorsLabel: string;
  localPastorsPhoto: string | null;
  presidentPastorsLabel: string;
  presidentPastorsPhoto: string | null;
  circleLeaderLabel: string;
  circleLeaderPhoto: string | null;
}

export const DEFAULT_CHURCH_PROFILE: ChurchProfile = {
  churchName: 'Assembleia de Deus M. Madureira Parque Petrópolis',
  address: 'Alameda Canuto de Pito Nº 233, Roseira, Mairiporã - SP',
  logoDataUrl: null,
  localPastorsLabel: 'Prs. Local:\nPr. Brazão e Diaconisa Vânia',
  localPastorsPhoto: null,
  presidentPastorsLabel: 'Prs. Presidentes:\nPr. Zacarias B. Felix e Pra. Anna Alzira',
  presidentPastorsPhoto: null,
  circleLeaderLabel: 'Dirigente Círculo de Oração:\nEv. Sueli',
  circleLeaderPhoto: null,
};

export interface BackgroundAsset {
  id: string;
  name: string;
  category: ChurchCategory | 'geral';
  type: 'image' | 'gradient';
  src?: string;
  colors?: [string, string, string?];
  isLight?: boolean;
}

export const CHURCH_BACKGROUNDS: BackgroundAsset[] = [
  {
    id: 'bg-jovens-crowd',
    name: 'Louvor Jovens',
    category: 'jovens',
    type: 'image',
    src: '/assets/church/bg-jovens-crowd.jpg',
    isLight: false,
  },
  {
    id: 'bg-irmas-floral',
    name: 'Floral Rosé',
    category: 'irmas',
    type: 'image',
    src: '/assets/church/bg-irmas-floral.jpg',
    isLight: true,
  },
  {
    id: 'bg-ceia-dark',
    name: 'Ceia Bronze',
    category: 'ceia',
    type: 'image',
    src: '/assets/church/bg-ceia-dark.jpg',
    isLight: false,
  },
  {
    id: 'bg-ceia-parchment',
    name: 'Pergaminho & Coroa',
    category: 'ceia',
    type: 'image',
    src: '/assets/church/bg-ceia-parchment.jpg',
    isLight: true,
  },
  {
    id: 'bg-familia-sunset',
    name: 'Pôr do Sol & Cruz',
    category: 'familia',
    type: 'image',
    src: '/assets/church/bg-familia-sunset.jpg',
    isLight: false,
  },
  {
    id: 'bg-campanha-dark',
    name: 'Campanha Fogo',
    category: 'campanha',
    type: 'image',
    src: '/assets/church/bg-campanha-dark.jpg',
    isLight: false,
  },
  {
    id: 'grad-amber',
    name: 'Âmbar Texturizado',
    category: 'campanha',
    type: 'gradient',
    colors: ['#9a5b08', '#784104', '#4a2502'],
    isLight: false,
  },
  {
    id: 'grad-rose',
    name: 'Aquarela Rosé',
    category: 'irmas',
    type: 'gradient',
    colors: ['#f9d8e2', '#f1b5c8', '#e79ab3'],
    isLight: true,
  },
  {
    id: 'grad-youth-dark',
    name: 'Noite Urbana',
    category: 'jovens',
    type: 'gradient',
    colors: ['#0f172a', '#18181b', '#09090b'],
    isLight: false,
  },
  {
    id: 'grad-royal',
    name: 'Azul Royal & Ouro',
    category: 'familia',
    type: 'gradient',
    colors: ['#0f172a', '#1e3a5f', '#090d16'],
    isLight: false,
  },
];

export interface ChurchTemplate {
  id: string;
  name: string;
  category: ChurchCategory;
  categoryLabel: string;
  backgroundId: string;
  titleStyle: 'script' | 'impact' | 'serif' | 'neon-pill' | 'fire-gradient';
  accentColor: string;
  secondaryColor: string;
  textColor: string;
  isLightBg: boolean;
  defaultEyebrow: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultDateText: string;
  defaultVerse: string;
  defaultShowFoodBadge: boolean;
  defaultShowCircleLeader: boolean;
  defaultTexture: TextureStyle;
  defaultFrame: FrameStyle;
  defaultDim: number; // 0..75
}

export const CHURCH_TEMPLATES: ChurchTemplate[] = [
  {
    id: 'jovens-gold',
    name: 'Jovens • Amarelo',
    category: 'jovens',
    categoryLabel: 'Culto de Jovens',
    backgroundId: 'bg-jovens-crowd',
    titleStyle: 'impact',
    accentColor: '#facc15',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'CULTO DE',
    defaultTitle: 'JOVENS',
    defaultSubtitle: 'Não perca!',
    defaultDateText: 'DOMINGO • 22/11 • 18H00',
    defaultVerse: '',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: false,
    defaultTexture: 'grain',
    defaultFrame: 'none',
    defaultDim: 35,
  },
  {
    id: 'jovens-neon',
    name: 'Jovens • Lima Neon',
    category: 'jovens',
    categoryLabel: 'Culto de Jovens',
    backgroundId: 'bg-jovens-crowd',
    titleStyle: 'neon-pill',
    accentColor: '#e2ff66',
    secondaryColor: '#111827',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'NÃO PERCA!',
    defaultTitle: 'CULTO JOVEM',
    defaultSubtitle: '',
    defaultDateText: 'DOMINGO • 23/08 • 18H',
    defaultVerse: '',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: false,
    defaultTexture: 'sparkles',
    defaultFrame: 'none',
    defaultDim: 40,
  },
  {
    id: 'irmas-floral',
    name: 'Irmãs • Floral Rosé',
    category: 'irmas',
    categoryLabel: 'Culto das Irmãs',
    backgroundId: 'bg-irmas-floral',
    titleStyle: 'script',
    accentColor: '#9f2c48',
    secondaryColor: '#c2516b',
    textColor: '#6d1d33',
    isLightBg: true,
    defaultEyebrow: 'Mulheres de fé e oração',
    defaultTitle: 'Culto das Irmãs',
    defaultSubtitle: 'Venham ao culto e se renovem em Deus!',
    defaultDateText: 'DOMINGO • 18/10 • 18H00',
    defaultVerse: '',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: true,
    defaultTexture: 'paper',
    defaultFrame: 'none',
    defaultDim: 0,
  },
  {
    id: 'irmas-aquarela',
    name: 'Irmãs • Aquarela Bordô',
    category: 'irmas',
    categoryLabel: 'Culto das Irmãs',
    backgroundId: 'grad-rose',
    titleStyle: 'impact',
    accentColor: '#9f2c48',
    secondaryColor: '#ffffff',
    textColor: '#6d1d33',
    isLightBg: true,
    defaultEyebrow: 'Mulheres de fé e oração, venham se renovar em Deus!',
    defaultTitle: 'CULTO DAS IRMÃS',
    defaultSubtitle: '',
    defaultDateText: 'DOMINGO • 20/09 • 18H00',
    defaultVerse: '',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: true,
    defaultTexture: 'paper',
    defaultFrame: 'corners',
    defaultDim: 0,
  },
  {
    id: 'ceia-bronze',
    name: 'Santa Ceia • Bronze',
    category: 'ceia',
    categoryLabel: 'Santa Ceia',
    backgroundId: 'bg-ceia-dark',
    titleStyle: 'impact',
    accentColor: '#f3d19c',
    secondaryColor: '#c68b45',
    textColor: '#fef3e2',
    isLightBg: false,
    defaultEyebrow: 'CULTO DE',
    defaultTitle: 'SANTA CEIA',
    defaultSubtitle: 'do Senhor',
    defaultDateText: 'SÁBADO • 07/11 • 19H00',
    defaultVerse: '',
    defaultShowFoodBadge: true,
    defaultShowCircleLeader: false,
    defaultTexture: 'grain',
    defaultFrame: 'thin',
    defaultDim: 20,
  },
  {
    id: 'ceia-pergaminho',
    name: 'Santa Ceia • Pergaminho',
    category: 'ceia',
    categoryLabel: 'Santa Ceia',
    backgroundId: 'bg-ceia-parchment',
    titleStyle: 'impact',
    accentColor: '#ffffff',
    secondaryColor: '#452815',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'CULTO DE',
    defaultTitle: 'SANTA CEIA',
    defaultSubtitle: '',
    defaultDateText: 'DOMINGO • ÀS 18HRS',
    defaultVerse: '',
    defaultShowFoodBadge: true,
    defaultShowCircleLeader: false,
    defaultTexture: 'paper',
    defaultFrame: 'none',
    defaultDim: 22,
  },
  {
    id: 'familia-sunset',
    name: 'Família • Pôr do Sol',
    category: 'familia',
    categoryLabel: 'Culto da Família',
    backgroundId: 'bg-familia-sunset',
    titleStyle: 'serif',
    accentColor: '#f5b942',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'culto da',
    defaultTitle: 'FAMÍLIA',
    defaultSubtitle: '',
    defaultDateText: 'DOMINGO • ÀS 18H',
    defaultVerse: '"Eu e a minha casa serviremos ao Senhor." — Josué 24:15',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: false,
    defaultTexture: 'none',
    defaultFrame: 'thin',
    defaultDim: 15,
  },
  {
    id: 'campanha-fogo',
    name: 'Campanha • Impacto',
    category: 'campanha',
    categoryLabel: 'Campanha / Quarta',
    backgroundId: 'bg-campanha-dark',
    titleStyle: 'fire-gradient',
    accentColor: '#ff512f',
    secondaryColor: '#f9d423',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'NÃO SAIA DO BARCO',
    defaultTitle: 'CAMPANHA',
    defaultSubtitle: 'Aviva, Senhor, os nossos corações.',
    defaultDateText: '07/10 QUA • ÀS 19H30',
    defaultVerse: 'ATOS 27:31',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: false,
    defaultTexture: 'grain',
    defaultFrame: 'none',
    defaultDim: 20,
  },
  {
    id: 'quarta-ambar',
    name: 'Culto de Quarta • Âmbar',
    category: 'campanha',
    categoryLabel: 'Campanha / Quarta',
    backgroundId: 'grad-amber',
    titleStyle: 'impact',
    accentColor: '#fef3c7',
    secondaryColor: '#f59e0b',
    textColor: '#ffffff',
    isLightBg: false,
    defaultEyebrow: 'NESTA',
    defaultTitle: 'QUARTA',
    defaultSubtitle: '',
    defaultDateText: 'QUARTA-FEIRA • 19H30',
    defaultVerse: '',
    defaultShowFoodBadge: false,
    defaultShowCircleLeader: false,
    defaultTexture: 'grain',
    defaultFrame: 'double',
    defaultDim: 10,
  },
];

export const CATEGORY_LABELS: { id: ChurchCategory; label: string }[] = [
  { id: 'jovens', label: 'Jovens' },
  { id: 'irmas', label: 'Irmãs' },
  { id: 'ceia', label: 'Santa Ceia' },
  { id: 'familia', label: 'Família' },
  { id: 'campanha', label: 'Campanha / Quarta' },
];
