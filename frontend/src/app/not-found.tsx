import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl font-bold text-gray-100 mb-4">404</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Página não encontrada</h1>
      <p className="text-gray-500 text-sm mb-8">
        A página que você procura não existe ou foi movida.
      </p>
      <Link href="/" className="btn btn-primary px-6">
        Voltar ao painel
      </Link>
    </div>
  );
}
