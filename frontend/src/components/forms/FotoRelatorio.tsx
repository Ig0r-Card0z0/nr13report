'use client';
import { useEffect, useRef, useState } from 'react';
import { equipamentosApi, fotosApi } from '@/lib/api';
import { Foto } from '@/types';
import toast from 'react-hot-toast';
import { X, Plus, ImageIcon, Star } from 'lucide-react';
import clsx from 'clsx';

interface Props { equipamentoId: string; inspecaoId?: string; compact?: boolean; }

export function FotoRelatorio({ equipamentoId, inspecaoId, compact = false }: Props) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [capaId, setCapaId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => Promise.all([
    fotosApi.listar(equipamentoId, inspecaoId),
    equipamentosApi.buscar(equipamentoId),
  ]).then(([fs, eq]) => {
    setFotos(fs);
    setCapaId(eq?.foto_capa_id || null);
  });

  useEffect(() => { load(); }, [equipamentoId, inspecaoId]);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('equipamentoId', equipamentoId);
        if (inspecaoId) fd.append('inspecaoId', inspecaoId);
        await fotosApi.upload(fd);
      }
      toast.success(`${files.length} foto(s) adicionada(s)!`);
      load();
    } catch { toast.error('Erro no upload.'); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    upload(e.dataTransfer.files);
  };

  const excluir = async (id: string) => {
    await fotosApi.excluir(id);
    toast.success('Foto removida.');
    load();
  };

  const legenda = async (id: string, val: string) => {
    await fotosApi.legenda(id, val);
  };

  const toggleCapa = async (id: string) => {
    const novaCapa = capaId === id ? null : id;
    try {
      await equipamentosApi.setFotoCapa(equipamentoId, novaCapa);
      setCapaId(novaCapa);
      toast.success(novaCapa ? 'Foto definida como capa.' : 'Capa removida.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao definir capa.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          {fotos.length} foto(s) adicionada(s)
          {capaId && <span className="ml-2 text-primary-700 font-medium">• capa definida</span>}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="btn btn-primary btn-sm">
          <Plus size={14} /> {uploading ? 'Enviando...' : 'Adicionar fotos'}
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
          onChange={e => upload(e.target.files)} />
      </div>

      {!compact && (
        <div className="text-xs text-gray-400 mb-4 -mt-2">
          Clique na estrela em uma foto para defini-la como capa do relatório PDF.
        </div>
      )}

      {/* Drop zone quando vazio */}
      {fotos.length === 0 && (
        <div onDrop={drop} onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer
            hover:border-primary-400 hover:bg-primary-50 transition-colors group">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-200 group-hover:text-primary-300 transition-colors" />
          <div className="text-sm text-gray-500 group-hover:text-primary-600">
            Clique ou arraste imagens aqui
          </div>
          <div className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — múltiplas fotos suportadas</div>
        </div>
      )}

      {/* Grid de fotos */}
      {fotos.length > 0 && (
        <>
          <div onDrop={drop} onDragOver={e => e.preventDefault()}
            className="flex flex-wrap gap-4 justify-start items-stretch">
            {fotos.map(f => {
              const ehCapa = f.id === capaId;
              return (
                <div key={f.id} className={clsx(
                  'bg-white border rounded-xl overflow-hidden transition-colors flex-1 min-w-[280px] max-w-[520px]',
                  ehCapa ? 'border-primary-400 ring-2 ring-primary-200' : 'border-gray-200',
                )}>
                  <div className="relative">
                    <img
                      src={`/uploads/${f.filename}`}
                      alt={`Foto ${f.numero}`}
                      className={clsx(
                        'w-full object-contain bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity',
                        compact ? 'h-40' : 'h-72',
                      )}
                      onClick={() => setLightbox(`/uploads/${f.filename}`)}
                    />
                    <button onClick={() => toggleCapa(f.id)}
                      className={clsx(
                        'absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center shadow transition-colors',
                        ehCapa
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-white/90 text-gray-400 hover:text-primary-700 hover:bg-white',
                      )}
                      title={ehCapa ? 'Capa do relatório (clique para remover)' : 'Definir como capa do relatório'}
                    >
                      <Star size={13} fill={ehCapa ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => excluir(f.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white
                        flex items-center justify-center hover:bg-red-600 transition-colors shadow">
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                      Foto {f.numero}{ehCapa && ' · CAPA'}
                    </div>
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <input
                      className="w-full text-xs border-0 bg-transparent focus:outline-none
                        text-gray-700 placeholder-gray-300 font-medium"
                      defaultValue={f.legenda || ''}
                      placeholder="Legenda da foto..."
                      onBlur={e => legenda(f.id, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}

            {/* Botão de adicionar mais no grid */}
            <div onClick={() => fileRef.current?.click()}
              className={clsx(
                'border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer',
                'hover:border-primary-300 hover:bg-primary-50 transition-colors text-gray-300 hover:text-primary-400',
                'flex-1 min-w-[280px] max-w-[520px]',
                compact ? 'h-40' : 'h-72',
              )}>
              <Plus size={24} />
              <span className="text-xs mt-1">Adicionar</span>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-5 right-6 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img src={lightbox} className="max-w-5xl max-h-[90vh] rounded-lg object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
