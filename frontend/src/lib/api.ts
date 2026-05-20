import axios from 'axios';

const api = axios.create({
  baseURL: typeof window !== 'undefined'
    ? '/api'
    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000'}/api`,
  timeout: 30000,
});

// Interceptor para extrair data do envelope { success, data, timestamp }
api.interceptors.response.use(
  res => {
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      return { ...res, data: res.data.data };
    }
    return res;
  },
  err => Promise.reject(err)
);

// ── Dashboard ─────────────────────────────────────────
export const dashboardApi = {
  stats:       ()           => api.get('/dashboard/stats').then(r => r.data),
  vencimentos: (dias = 90)  => api.get('/dashboard/vencimentos', { params: { dias } }).then(r => r.data),
  recentes:    ()           => api.get('/dashboard/recentes').then(r => r.data),
};

// ── Clientes ──────────────────────────────────────────
export const clientesApi = {
  listar:     ()                    => api.get('/clientes').then(r => r.data),
  buscar:     (id: string)          => api.get(`/clientes/${id}`).then(r => r.data),
  criar:      (data: any)           => api.post('/clientes', data).then(r => r.data),
  atualizar:  (id: string, d: any)  => api.patch(`/clientes/${id}`, d).then(r => r.data),
  excluir:    (id: string)          => api.delete(`/clientes/${id}`).then(r => r.data),
};

// ── Equipamentos ──────────────────────────────────────
export const equipamentosApi = {
  listar:     (clienteId?: string)  => api.get('/equipamentos', { params: { clienteId } }).then(r => r.data),
  buscar:     (id: string)          => api.get(`/equipamentos/${id}`).then(r => r.data),
  vencimentos:(dias = 90)           => api.get('/equipamentos/vencimentos', { params: { dias } }).then(r => r.data),
  criar:      (data: any)           => api.post('/equipamentos', data).then(r => r.data),
  atualizar:  (id: string, d: any)  => api.patch(`/equipamentos/${id}`, d).then(r => r.data),
  excluir:    (id: string)          => api.delete(`/equipamentos/${id}`).then(r => r.data),
  setFotoCapa:(id: string, fotoId: string | null) =>
    api.patch(`/equipamentos/${id}/foto-capa`, { foto_id: fotoId }).then(r => r.data),
};

// ── Inspeções ─────────────────────────────────────────
export const inspecoesApi = {
  listar:  (equipamentoId: string)  => api.get('/inspecoes', { params: { equipamentoId } }).then(r => r.data),
  buscar:  (id: string)             => api.get(`/inspecoes/${id}`).then(r => r.data),
  criar:   (data: any)              => api.post('/inspecoes', data).then(r => r.data),
  excluir: (id: string)             => api.delete(`/inspecoes/${id}`).then(r => r.data),
  uploadArt: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/inspecoes/${id}/art`, fd).then(r => r.data);
  },
  removeArt: (id: string) => api.delete(`/inspecoes/${id}/art`).then(r => r.data),
  setInstrumentos: (id: string, instrumentoIds: string[]) =>
    api.put(`/inspecoes/${id}/instrumentos`, { instrumento_ids: instrumentoIds }).then(r => r.data),
  setDispositivosSeguranca: (id: string, dispositivos: any[]) =>
    api.put(`/inspecoes/${id}/dispositivos-seguranca`, { dispositivos }).then(r => r.data),
  uploadCertificadoDispositivoSeguranca: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/inspecoes/dispositivos-seguranca/${id}/certificado`, fd).then(r => r.data);
  },
  removeCertificadoDispositivoSeguranca: (id: string) =>
    api.delete(`/inspecoes/dispositivos-seguranca/${id}/certificado`).then(r => r.data),
  listarAnexosSeguranca: (inspecaoId: string) =>
    api.get(`/inspecoes/${inspecaoId}/anexos-seguranca`).then(r => r.data),
  uploadAnexosSeguranca: (inspecaoId: string, files: File[]) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return api.post(`/inspecoes/${inspecaoId}/anexos-seguranca`, fd).then(r => r.data);
  },
  excluirAnexoSeguranca: (id: string) =>
    api.delete(`/inspecoes/anexos-seguranca/${id}`).then(r => r.data),
};

// ── Profissionais ─────────────────────────────────────
export const profissionaisApi = {
  listar: ()                      => api.get('/profissionais').then(r => r.data),
  buscar: (id: string)            => api.get(`/profissionais/${id}`).then(r => r.data),
  criar:  (data: any)             => api.post('/profissionais', data).then(r => r.data),
  atualizar: (id: string, d: any) => api.patch(`/profissionais/${id}`, d).then(r => r.data),
  excluir: (id: string)           => api.delete(`/profissionais/${id}`).then(r => r.data),
};

// ── Instrumentos de medição ───────────────────────────
export const instrumentosApi = {
  listar: ()                       => api.get('/instrumentos').then(r => r.data),
  buscar: (id: string)             => api.get(`/instrumentos/${id}`).then(r => r.data),
  criar:  (data: any)              => api.post('/instrumentos', data).then(r => r.data),
  atualizar: (id: string, d: any)  => api.patch(`/instrumentos/${id}`, d).then(r => r.data),
  excluir: (id: string)            => api.delete(`/instrumentos/${id}`).then(r => r.data),
  uploadCertificado: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/instrumentos/${id}/certificado`, fd).then(r => r.data);
  },
  removeCertificado: (id: string) => api.delete(`/instrumentos/${id}/certificado`).then(r => r.data),
};

// ── Fotos ─────────────────────────────────────────────
export const fotosApi = {
  listar: (equipamentoId: string, inspecaoId?: string) =>
    api.get('/fotos', { params: inspecaoId ? { inspecaoId } : { equipamentoId } }).then(r => r.data),
  upload: (formData: FormData)          => api.post('/fotos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  legenda:(id: string, legenda: string) => api.patch(`/fotos/${id}/legenda`, { legenda }).then(r => r.data),
  excluir:(id: string)                  => api.delete(`/fotos/${id}`).then(r => r.data),
};

// ── Medição Espessura ─────────────────────────────────
export const meApi = {
  listar: (equipamentoId: string, inspecaoId?: string) =>
    api.get('/me', { params: inspecaoId ? { inspecaoId } : { equipamentoId } }).then(r => r.data),
  salvar: (data: any)               => api.post('/me', data).then(r => r.data),
  excluir:(id: string)              => api.delete(`/me/${id}`).then(r => r.data),
  uploadCroqui: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/me/${id}/croqui`, fd).then(r => r.data);
  },
  removeCroqui: (id: string) => api.delete(`/me/${id}/croqui`).then(r => r.data),
};

// ── Relatórios ────────────────────────────────────────
export const relatoriosApi = {
  urlPDF: (equipamentoId: string)   => `/api/relatorios/pdf/${equipamentoId}`,
  urlPDFDownload: (equipamentoId: string) => `/api/relatorios/pdf/${equipamentoId}?download=1`,
  urlPDFInspecao: (equipamentoId: string, inspecaoId: string) => `/api/relatorios/pdf/${equipamentoId}?inspecaoId=${encodeURIComponent(inspecaoId)}`,
  urlPDFInspecaoDownload: (equipamentoId: string, inspecaoId: string) =>
    `/api/relatorios/pdf/${equipamentoId}?download=1&inspecaoId=${encodeURIComponent(inspecaoId)}`,
};

// ── Health ────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health', { baseURL: typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000' }).then(r => r.data),
};

export default api;
