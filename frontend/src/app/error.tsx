'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-5xl font-bold text-red-100 mb-4">Erro</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Algo deu errado</h1>
      <p className="text-gray-500 text-sm mb-2">{error.message || 'Erro inesperado.'}</p>
      <p className="text-gray-400 text-xs mb-8">
        Verifique se o servidor NestJS está rodando em localhost:3001
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary">Tentar novamente</button>
        <a href="/" className="btn">Voltar ao painel</a>
      </div>
    </div>
  );
}
