import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black text-white font-serif">
      <h2 className="text-6xl font-bold mb-4 text-amber-500">404</h2>
      <p className="text-xl text-slate-400 mb-8">Lost in the Void</p>
      <Link href="/" className="px-6 py-3 border border-slate-700 hover:bg-slate-800 rounded-full transition-colors text-sm uppercase tracking-widest">
        Return to Cosmos
      </Link>
    </div>
  )
}
