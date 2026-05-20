export interface Cliente {
  id: string;
  nome: string;
  fantasia?: string;
  cnpj?: string;
  tel?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  responsavel?: string;
  cargo?: string;
  profissional_id?: string | null;
  profissional_nome?: string | null;
  profissional_crea?: string | null;
  total_equipamentos?: number;
  criado_em: string;
}

export interface Profissional {
  id: string;
  nome: string;
  crea?: string;
  email?: string;
  telefone?: string;
  especialidade?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em?: string;
}

export interface Equipamento {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  tag: string;
  tipo: string;
  fabricante?: string;
  serie?: string;
  ano?: string;
  posicao?: string;
  codigo_projeto?: string;
  local_instalacao?: string;
  fluido?: string;
  classe_fluido?: string;
  temperatura_projeto?: number;
  volume?: number;
  pressao_operacao?: number;
  pmta?: number;
  pressao_hidro?: number;
  metal_base?: string;
  categoria?: string;
  grupo_risco?: string;
  dt_ultima_insp?: string;
  tipo_ultima_insp?: string;
  art_ultima_insp?: string;
  prox_externo?: string;
  prox_interno?: string;
  prox_hidro?: string;
  foto_capa_id?: string | null;
  total_inspecoes?: number;
  total_fotos?: number;
  criado_em: string;
}

export interface Instrumento {
  id: string;
  nome: string;
  tipo?: string;
  fabricante?: string;
  modelo?: string;
  serie?: string;
  certificado_numero?: string;
  certificado_filename?: string | null;
  data_calibracao?: string;
  validade_calibracao?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em?: string;
}

export interface Inspecao {
  id: string;
  equipamento_id: string;
  data: string;
  tipo: string;
  resultado: 'Apto' | 'Inapto' | 'Apto com restrições';
  ph_nome?: string;
  ph_crea?: string;
  art?: string;
  art_filename?: string | null;
  pmta_confirmada?: number;
  prox_externo?: string;
  prox_interno?: string;
  prox_hidro?: string;
  prazo_complementos?: string;
  observacoes?: string;
  instrumentos?: Instrumento[];
  dispositivos?: DispositivoSeguranca[];
  total_fotos?: number;
  total_pontos_me?: number;
  tem_art?: 0 | 1;
  criado_em: string;
}

export interface DispositivoSeguranca {
  id: string;
  inspecao_id: string;
  tipo?: string;
  descricao?: string;
  fabricante?: string;
  modelo?: string;
  serie?: string;
  certificado_numero?: string;
  certificado_filename?: string | null;
  data_calibracao?: string;
  validade_calibracao?: string;
  observacoes?: string;
  criado_em: string;
}

export interface AnexoSeguranca {
  id: string;
  inspecao_id: string;
  descricao?: string | null;
  nome_original?: string | null;
  filename: string;
  mimetype?: string | null;
  tamanho?: number | null;
  criado_em: string;
}

export interface Foto {
  id: string;
  equipamento_id: string;
  inspecao_id?: string;
  numero: number;
  legenda?: string;
  filename: string;
  tamanho?: number;
  criado_em: string;
}

export interface PontoMe {
  id: string;
  medicao_id: string;
  numero: string;
  regiao?: string;
  espessura_nominal?: number;
  espessura_encontrada?: number;
  espessura_minima?: number;
  ordem: number;
}

export interface MedicaoEspessura {
  id: string;
  equipamento_id: string;
  inspecao_id?: string;
  instrumento_id?: string | null;
  data_ensaio?: string;
  norma?: string;
  procedimento?: string;
  equipamento_med?: string;
  cabecote?: string;
  acoplante?: string;
  cert_calibracao?: string;
  data_calibracao?: string;
  validade_calibracao?: string;
  metal_base?: string;
  condicao_superficial?: string;
  temperatura_peca?: number;
  inspetor?: string;
  conclusao?: string;
  croqui_filename?: string;
  pontos: PontoMe[];
  criado_em: string;
}
