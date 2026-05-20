'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { profissionaisApi } from '@/lib/api';
import { Profissional } from '@/types';
import toast from 'react-hot-toast';

interface Props { profissionalId?: string; }

const ESPECIALIDADES = [
  'Engenharia Mecânica',
  'Engenharia de Inspeção',
  'Engenharia Metalúrgica',
  'Engenharia de Segurança do Trabalho',
  'Inspetor de Equipamentos',
  'Outra',
];

export default function ProfissionalForm({ profissionalId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '', crea: '', email: '', telefone: '',
    especialidade: 'Engenharia Mecânica', observacoes: '',
  });

  useEffect(() => {
    if (!profissionalId) return;
    profissionaisApi.buscar(profissionalId).then((p: Profissional) => {
      setForm({
        nome: p.nome || '', crea: p.crea || '', email: p.email || '',
        telefone: p.telefone || '', especialidade: p.especialidade || 'Engenharia Mecânica',
        observacoes: p.observacoes || '',
      });
    });
  }, [profissionalId]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do profissional.'); return; }
    setSaving(true);
    try {
      if (profissionalId) {
        await profissionaisApi.atualizar(profissionalId, form);
        toast.success('Profissional atualizado!');
      } else {
        await profissionaisApi.criar(form);
        toast.success('Profissional cadastrado!');
      }
      router.push('/profissionais');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-5">
        {profissionalId ? 'Editar profissional' : 'Novo profissional'}
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="label">Nome completo *</label>
          <input className="input" value={form.nome} onChange={set('nome')}
            placeholder="Ex.: Igor Cardozo e Oliveira Santos" />
        </div>
        <div>
          <label className="label">CREA</label>
          <input className="input" value={form.crea} onChange={set('crea')}
            placeholder="041725365-6" />
        </div>
        <div>
          <label className="label">Especialidade</label>
          <select className="input" value={form.especialidade} onChange={set('especialidade')}>
            {ESPECIALIDADES.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" value={form.email} onChange={set('email')}
            placeholder="eng@exemplo.com" />
        </div>
        <div>
          <label className="label">Telefone</label>
          <input className="input" value={form.telefone} onChange={set('telefone')}
            placeholder="(92) 99999-9999" />
        </div>
      </div>

      <div className="mt-4">
        <label className="label">Observações</label>
        <textarea className="input" rows={3} value={form.observacoes} onChange={set('observacoes')}
          placeholder="Notas internas sobre o profissional (cargo, especialidades adicionais, restrições etc.)" />
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button type="button" onClick={() => router.back()} className="btn">Cancelar</button>
        <button type="button" onClick={submit} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : (profissionalId ? 'Salvar alterações' : 'Cadastrar profissional')}
        </button>
      </div>
    </div>
  );
}
