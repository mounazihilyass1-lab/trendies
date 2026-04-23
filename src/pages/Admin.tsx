import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import AdminDashboard from './AdminDashboard';
import { Lock } from 'lucide-react';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [login, setLogin] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Removed session storage check so the user must login on every visit
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (login === 'admin' && password === 'admin123') {
      try {
        await signInAnonymously(auth);
        setIsAuthenticated(true);
        setError('');
      } catch (err: any) {
        console.error("Firebase auth error", err);
        // Fallback for prototype if Anonymous Auth is not enabled in Firebase yet
        if (err.code === 'auth/operation-not-allowed') {
          setIsAuthenticated(true);
          setError('');
          console.warn("Logged in locally, but Anonymous Auth is not enabled in Firebase. Firestore writes may fail.");
        } else {
          setError("Erreur de connexion. Veuillez vérifier la console.");
        }
      }
    } else {
      setError('Identifiants incorrects.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    auth.signOut();
  };

  if (isAuthenticated) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="flex-grow flex items-center justify-center p-8 bg-stone-50">
      <div className="max-w-md w-full bg-white p-12 border-2 border-zinc-900 rounded-sm shadow-[8px_8px_0px_0px_rgba(24,24,27,1)]">
        <div className="flex justify-center mb-8">
          <div className="bg-indigo-600 text-white p-4 rounded-full shadow-inner ring-4 ring-indigo-50">
            <Lock size={24} />
          </div>
        </div>
        <h2 className="font-serif italic text-4xl font-bold text-center mb-8 tracking-tight text-zinc-900">System Access</h2>
        {error && <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-sm mb-6 text-sm font-bold">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2">Identifiant</label>
            <input 
              type="text" 
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-5 py-4 bg-zinc-50 border-2 border-zinc-200 rounded-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold text-zinc-900"
              placeholder="Admin ID"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2">Mot de passe</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-zinc-50 border-2 border-zinc-200 rounded-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold text-zinc-900"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-zinc-900 text-white py-5 rounded-sm font-black uppercase tracking-[0.2em] text-[10px] hover:bg-indigo-600 hover:shadow-lg transition-all mt-4"
          >
            Se Connecter
          </button>
        </form>
      </div>
    </div>
  );
}
