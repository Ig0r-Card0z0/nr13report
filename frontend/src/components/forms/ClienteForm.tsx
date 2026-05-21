'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clientesApi, profissionaisApi } from '@/lib/api';
import { Profissional } from '@/types';
import { buscarCep, maskCep, maskCnpj } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface Props { clienteId?: string; }

export default function ClienteForm({ clienteId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [logoFilename, setLogoFilename] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [form, setForm] = useState({
    nome: '', fantasia: '', cnpj: '', tel: '', email: '',
    cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '',
    responsavel: '', cargo: '', profissionalId: '',
  });

  useEffect(() => {
    profissionaisApi.listar().then(setProfissionais).catch(() => setProfissionais([]));
  }, []);

  useEffect(() => {
    if (clienteId) clientesApi.buscar(clienteId).then(c => {
      setForm({
        nome: c.nome || '', fantasia: c.fantasia || '', cnpj: c.cnpj || '',
        tel: c.tel || '', email: c.email || '', cep: c.cep || '',
        logradouro: c.logradouro || '', numero: c.numero || '', bairro: c.bairro || '',
        cidade: c.cidade || '', uf: c.uf || '', responsavel: c.responsavel || '', cargo: c.cargo || '',
        profissionalId: c.profissional_id || '',
      });
      setLogoFilename(c.logo_filename || null);
    });
  }, [clienteId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let v = e.target.value;
    if (k === 'cnpj') v = maskCnpj(v);
    if (k === 'cep') v = maskCep(v);
    setForm(f => ({ ...f, [k]: v }));
  };

  const handleCep = async () => {
    setCepBusy(true);
    const d = await buscarCep(form.cep).finally(() => setCepBusy(false));
    if (d) setForm(f => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.cidade, uf: d.uf }));
    else toast.error('CEP não encontrado.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file || !clienteId) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo de 5 MB.');
      return;
    }
    setLogoBusy(true);
    try {
      const c = await clientesApi.uploadLogo(clienteId, file);
      setLogoFilename(c.logo_filename || null);
      toast.success('Logo enviada!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao enviar a logo.';
      toast.error(String(msg));
    } finally { setLogoBusy(false); }
  };

  const handleLogoRemove = async () => {
    if (!clienteId) return;
    setLogoBusy(true);
    try {
      await clientesApi.removerLogo(clienteId);
      setLogoFilename(null);
      toast.success('Logo removida.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao remover a logo.';
      toast.error(String(msg));
    } finally { setLogoBusy(false); }
  };

  const submit = async () => {
    if (!form.nome.trim()) { toast.error('Informe a razão social.'); return; }
    setSaving(true);
    const payload = { ...form, profissionalId: form.profissionalId || null };
    try {
      if (clienteId) await clientesApi.atualizar(clienteId, payload);
      else await clientesApi.criar(payload);
      toast.success('Cliente salvo!');
      router.push('/clientes');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-5">{clienteId ? 'Editar cliente' : 'Novo cliente'}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Razão social *</label>
          <input className="input" value={form.nome} onChange={set('nome')} placeholder="ERAM – Estaleiro Rio Amazonas Ltda" />
        </div>
        <div>
          <label className="label">Nome fantasia</label>
          <input className="input" value={form.fantasia} onChange={set('fantasia')} placeholder="ERAM" />
        </div>
        <div>
          <label className="label">CNPJ</label>
          <input className="input" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input" value={form.tel} onChange={set('tel')} placeholder="(00) 00000-0000" />
        </div>
      </div>
      <div className="mt-4">
        <label className="label">E-mail</label>
        <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="contato@empresa.com.br" />
      </div>

      <hr className="my-5 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Logo do cliente</div>
      {!clienteId ? (
        <div className="text-xs text-gray-400">
          Salve o cliente primeiro para poder enviar a logo. Depois, edite o cadastro
          e a opção de upload aparecerá aqui.
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-32 h-20 border border-gray-200 rounded flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
            {logoFilename ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/uploads/${logoFilename}`} alt="Logo do cliente"
                   className="max-w-full max-h-full object-contain" />
            ) : (
              <ImageIcon size={24} className="text-gray-300" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn btn-primary mt-0 cursor-pointer inline-flex">
              <Upload size={14} /> {logoBusy ? 'Enviando...' : (logoFilename ? 'Trocar logo' : 'Enviar logo')}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                     onChange={handleLogoUpload} disabled={logoBusy} />
            </label>
            {logoFilename && (
              <button onClick={handleLogoRemove} disabled={logoBusy}
                      className="btn mt-0 text-red-600 inline-flex">
                <Trash2 size={14} /> Remover
              </button>
            )}
            <span className="text-xs text-gray-400">
              PNG com fundo transparente é o ideal. JPG e WEBP também aceitos. Máx. 5 MB.
            </span>
          </div>
        </div>
      )}

      <hr className="my-5 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Endereço</div>

      <div className="flex gap-2 mb-4">
        <div className="flex-shrink-0">
          <label className="label">CEP</label>
          <div className="flex gap-2">
            <input className="input w-36" value={form.cep} onChange={set('cep')}
              placeholder="00000-000" onKeyDown={e => e.key === 'Enter' && handleCep()} />
            <button onClick={handleCep} disabled={cepBusy} className="btn btn-primary mt-0">
              <Search size={14} /> {cepBusy ? '...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Logradouro</label>
          <input className="input" value={form.logradouro} onChange={set('logradouro')} placeholder="Av. / Rua" />
        </div>
        <div>
          <label className="label">Número / Complemento</label>
          <input className="input" value={form.numero} onChange={set('numero')} placeholder="Lote 42" />
        </div>
        <div>
          <label className="label">Bairro</label>
          <input className="input" value={form.bairro} onChange={set('bairro')} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="label">Cidade</label>
            <input className="input" value={form.cidade} onChange={set('cidade')} />
          </div>
          <div>
            <label className="label">UF</label>
            <input className="input" value={form.uf} onChange={set('uf')} maxLength={2} />
          </div>
        </div>
      </div>

      <hr className="my-5 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Responsável do cliente</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={form.responsavel} onChange={set('responsavel')} />
        </div>
        <div>
          <label className="label">Cargo</label>
          <input className="input" value={form.cargo} onChange={set('cargo')} placeholder="Gerente de Manutenção" />
        </div>
      </div>

      <hr className="my-5 border-gray-100" />
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profissional responsável (PH)</div>
        <Link href="/profissionais/novo" target="_blank" className="text-xs text-primary-700 hover:underline">
          Cadastrar novo profissional →
        </Link>
      </div>
      {profissionais.length === 0 ? (
        <div className="text-xs text-gray-400">
          Nenhum profissional cadastrado. Vá em{' '}
          <Link href="/profissionais" className="text-primary-700 hover:underline">Profissionais</Link>
          {' '}para fazer o cadastro.
        </div>
      ) : (
        <>
          <select className="input" value={form.profissionalId} onChange={set('profissionalId')}>
            <option value="">— Nenhum (definir depois) —</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome}{p.crea ? ` · CREA ${p.crea}` : ''}{p.especialidade ? ` · ${p.especialidade}` : ''}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-400 mt-2">
            Engenheiro habilitado que responde tecnicamente pelos equipamentos deste cliente.
            Será sugerido como PH nas inspeções e impresso na assinatura do relatório.
          </div>
        </>
      )}

      <div className="flex gap-3 justify-end mt-6">
        <button onClick={() => router.back()} className="btn">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : 'Salvar cliente'}
        </button>
      </div>
    </div>
  );
}