'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  UnidadePressao, ROTULO_UNIDADE, FATOR_PARA_KPA,
  tabelaConversaoPressao, converterPressao,
} from '@/lib/nr13';
import { Gauge } from 'lucide-react';

const UNIDADES: UnidadePressao[] = ['kPa', 'MPa', 'bar', 'kgf/cm2', 'psi'];

// Quantidade de casas decimais por unidade para exibição
const CASAS: Record<UnidadePressao, number> = {
  kPa: 2, MPa: 4, bar: 4, 'kgf/cm2': 4, psi: 3,
};

// Valores de referência úteis no contexto NR-13
const REFERENCIAS: { rotulo: string; valor: number; unidade: UnidadePressao }[] = [
  { rotulo: 'Caldeira categoria A (limite)', valor: 1960, unidade: 'kPa' },
  { rotulo: 'Caldeira categoria C (limite de pressão)', valor: 588, unidade: 'kPa' },
  { rotulo: '1 atmosfera técnica', valor: 1, unidade: 'kgf/cm2' },
  { rotulo: 'Pressão típica de rede de ar', valor: 8, unidade: 'bar' },
];

export default function ConversorPressaoPage() {
  const [valor, setValor] = useState<string>('100');
  const [unidade, setUnidade] = useState<UnidadePressao>('kPa');

  const num = parseFloat(valor);
  const valido = !isNaN(num);
  const conv = valido ? tabelaConversaoPressao(num, unidade) : null;

  const fmt = (v: number, u: UnidadePressao) =>
    v.toLocaleString('pt-BR', {
      minimumFractionDigits: CASAS[u],
      maximumFractionDigits: CASAS[u],
    });

  return (
    <div>
      <PageHeader
        title="Conversor de pressão"
        breadcrumbs={[
          { label: 'Ferramentas' },
          { label: 'Conversor de pressão' },
        ]}
      />

      {/* Conversor interativo */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={16} className="text-primary-600" />
          <h2 className="font-semibold text-gray-900">Converter um valor</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Valor</label>
            <input
              className="input"
              type="number"
              step="any"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="Ex.: 100"
            />
          </div>
          <div>
            <label className="label">Unidade de origem</label>
            <select
              className="input"
              value={unidade}
              onChange={e => setUnidade(e.target.value as UnidadePressao)}
            >
              {UNIDADES.map(u => (
                <option key={u} value={u}>{ROTULO_UNIDADE[u]}</option>
              ))}
            </select>
          </div>
        </div>

        {conv ? (
          <div className="grid grid-cols-5 gap-3">
            {UNIDADES.map(u => (
              <div
                key={u}
                className={
                  'p-3 rounded-lg text-center ' +
                  (u === unidade ? 'bg-primary-100' : 'bg-gray-50')
                }
              >
                <div className="text-xs text-gray-500">{ROTULO_UNIDADE[u]}</div>
                <div className="font-bold text-gray-900 text-sm mt-0.5 break-all">
                  {fmt(conv[u], u)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">Informe um valor numérico válido.</div>
        )}
      </div>

      {/* Tabela de fatores de conversão */}
      <div className="card mb-5">
        <h2 className="font-semibold text-gray-900 mb-1">Fatores de conversão</h2>
        <p className="text-xs text-gray-500 mb-4">
          Para converter de uma unidade da linha para uma da coluna, multiplique pelo fator.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                  De ↓ / Para →
                </th>
                {UNIDADES.map(u => (
                  <th key={u} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                    {ROTULO_UNIDADE[u]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UNIDADES.map(de => (
                <tr key={de} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold text-gray-700">{ROTULO_UNIDADE[de]}</td>
                  {UNIDADES.map(para => {
                    const fator = converterPressao(1, de, para);
                    return (
                      <td key={para} className="px-3 py-2 text-right text-gray-600">
                        {de === para
                          ? '1'
                          : fator.toLocaleString('pt-BR', {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 6,
                            })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-400 mt-3">
          Equivalências base: 1 MPa = 1000 kPa · 1 bar = 100 kPa ·
          1 kgf/cm² = {FATOR_PARA_KPA['kgf/cm2']} kPa ·
          1 psi = {FATOR_PARA_KPA.psi.toFixed(6)} kPa.
        </div>
      </div>

      {/* Referências NR-13 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-1">Referências NR-13</h2>
        <p className="text-xs text-gray-500 mb-4">
          Valores de limiar usados na categorização, em todas as unidades.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                  Referência
                </th>
                {UNIDADES.map(u => (
                  <th key={u} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                    {ROTULO_UNIDADE[u]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REFERENCIAS.map(ref => {
                const t = tabelaConversaoPressao(ref.valor, ref.unidade);
                return (
                  <tr key={ref.rotulo} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{ref.rotulo}</td>
                    {UNIDADES.map(u => (
                      <td key={u} className="px-3 py-2 text-right text-gray-600">
                        {fmt(t[u], u)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
