'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { instrumentosApi } from '@/lib/api';
import { Instrumento } from '@/types';
import toast from 'react-hot-toast';
import { FileText, Trash2, Upload } from 'lucide-react';
import clsx from 'clsx';

interface Props { instrumentoId?: string; }

const TIPOS_INSTRUMENTO = [
  'Ultrassom de espessura',
  'Manômetro',
  'Termômetro',
  'Paquímetro',
  'Trena',
  'Câmera termográfica',
  'Detector de gases',
  'Outro',
];

export default function InstrumentoForm({ instrumentoId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [instr, setInstr] = useState<Instrumento | null>(null);
  const [form, setForm] = useState({
    nome: '', tipo: 'Ultrassom de espessura', fabricante: '', modelo: '', serie: '',
    certificadoNumero: '', dataCalibracao: '', validadeCalibracao: '', observacoes: '',
  });

  useEffect(() => {
    if (!instrumentoId) return;
    instrumentosApi.buscar(instrumentoId).then((i: Instrumento) => {
      setInstr(i);
      setForm({
        nome: i.nome || '', tipo: i.tipo || 'Ultrassom de espessura',
        fabricante: i.fabricante || '', modelo: i.modelo || '', serie: i.serie || '',
        certificadoNumero: i.certificado_numero || '',
        dataCalibracao: i.data_calibracao || '', validadeCalibracao: i.validade_calibracao || '',
        observacoes: i.observacoes || '',
      });
    });
  }, [instrumentoId]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.nome.trim()) { toast.error('Informe o nome do instrumento.'); return; }
    setSaving(true);
    try {
      if (instrumentoId) {
        await instrumentosApi.atualizar(instrumentoId, form);
        toast.success('Instrumento atualizado!');
      } else {
        const created: Instrumento = await instrumentosApi.criar(form);
        toast.success('Instrumento cadastrado!');
        router.push(`/instrumentos/${created.id}/editar`);
        return;
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  const uploadPdf = async (file: File) => {
    if (!instrumentoId) {
      toast.error('Salve o instrumento antes de anexar o certificado.');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('O certificado deve ser um arquivo PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10 MB).');
      return;
    }
    setUploading(true);
    try {
      const updated = await instrumentosApi.uploadCertificado(instrumentoId, file);
      setInstr(updated);
      toast.success('Certificado enviado!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao enviar o PDF.');
    } finally { setUploading(false); }
  };

  const removePdf = async () => {
    if (!instrumentoId) return;
    setUploading(true);
    try {
      const updated = await instrumentosApi.removeCertificado(instrumentoId);
      setInstr(updated);
      toast.success('Certificado removido.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao remover.');
    } finally { setUploading(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-5">
        {instrumentoId ? 'Editar instrumento de medição' : 'Novo instrumento de medição'}
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="label">Nome / Descrição *</label>
          <input className="input" value={form.nome} onChange={set('nome')} placeholder="Ultrassom Krautkrämer USM Go+" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={set('tipo')}>
            {TIPOS_INSTRUMENTO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fabricante</label>
          <input className="input" value={form.fabricante} onChange={set('fabricante')} placeholder="Krautkrämer" />
        </div>
        <div>
          <label className="label">Modelo</label>
          <input className="input" value={form.modelo} onChange={set('modelo')} placeholder="USM Go+" />
        </div>
        <div>
          <label className="label">Nº de série</label>
          <input className="input" value={form.serie} onChange={set('serie')} placeholder="SN12345" />
        </div>
        <div>
          <label className="label">Nº do certificado</label>
          <input className="input" value={form.certificadoNumero} onChange={set('certificadoNumero')} placeholder="CC-2025/001" />
        </div>
        <div>
          <label className="label">Data da calibração</label>
          <input className="input" type="date" value={form.dataCalibracao} onChange={set('dataCalibracao')} />
        </div>
        <div>
          <label className="label">Validade da calibração</label>
          <input className="input" type="date" value={form.validadeCalibracao} onChange={set('validadeCalibracao')} />
        </div>
      </div>

      <div className="mt-4">
        <label className="label">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')}
          placeholder="Detalhes adicionais sobre o instrumento ou a calibração..." />
      </div>

      <hr className="my-5 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Certificado de calibração (PDF)</div>

      {!instrumentoId ? (
        <p className="text-xs text-gray-400 py-2">
          Salve o instrumento antes de anexar o certificado em PDF.
        </p>
      ) : instr?.certificado_filename ? (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <FileText className="text-primary-600" size={18} />
          <a
            href={`/uploads/${encodeURIComponent(instr.certificado_filename)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-700 hover:underline flex-1 truncate"
          >
            Visualizar certificado PDF
          </a>
          <button
            type="button"
            onClick={removePdf}
            disabled={uploading}
            className="btn btn-sm btn-danger"
          >
            <Trash2 size={12} /> {uploading ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      ) : (
        <label
          className={clsx(
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
            uploading
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50',
          )}
        >
          <Upload className="text-gray-300" size={22} />
          <span className="text-sm text-gray-500">
            {uploading ? 'Enviando...' : 'Clique para enviar o certificado em PDF'}
          </span>
          <span className="text-xs text-gray-400">Apenas PDF — máx 10 MB</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadPdf(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      <div className="flex gap-3 justify-end mt-6">
        <button type="button" onClick={() => router.back()} className="btn">Cancelar</button>
        <button type="button" onClick={submit} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : (instrumentoId ? 'Salvar alterações' : 'Cadastrar instrumento')}
        </button>
      </div>
    </div>
  );
}
