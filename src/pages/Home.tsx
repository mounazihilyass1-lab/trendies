import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Hash, Rss } from 'lucide-react';
import { cn } from '../lib/utils';

interface Article {
  id: string;
  title: string;
  summary: string;
  category: string;
  platforms: string[];
  tags: string[];
  imageUrl?: string;
  publishedAt: number;
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [feedType, setFeedType] = useState<'latest' | 'foryou' | 'saved'>('latest');

  useEffect(() => {
    async function fetchArticles() {
      try {
        const q = query(collection(db, 'articles'), orderBy('publishedAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Article[];
        setArticles(data);
      } catch (err) {
        console.error("Failed to fetch articles", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchArticles();
  }, []);

  // Compute unique categories and platforms
  const categories = Array.from(new Set(articles.map(a => a.category))).filter(Boolean);
  const platforms = Array.from(new Set(articles.flatMap(a => a.platforms))).filter(Boolean);

  const filteredArticles = articles.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      a.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory ? a.category === selectedCategory : true;
    const matchPlatform = selectedPlatform ? a.platforms.includes(selectedPlatform) : true;
    
    let matchFeed = true;
    if (feedType === 'saved') {
      const savedStr = localStorage.getItem('trendies_saved');
      let saved: string[] = [];
      try {
        if (savedStr) saved = JSON.parse(savedStr);
      } catch (e) {}
      matchFeed = saved.includes(a.id);
    }

    return matchSearch && matchCategory && matchPlatform && matchFeed;
  });

  // Personalization sorting
  if (feedType === 'foryou') {
    const profileStr = localStorage.getItem('trendies_profile');
    let profile = { categories: {} as Record<string, number>, tags: {} as Record<string, number> };
    try {
      if (profileStr) profile = JSON.parse(profileStr);
    } catch (e) {}

    filteredArticles.sort((a, b) => {
      let scoreA = (profile.categories[a.category] || 0) * 2;
      a.tags.forEach(t => scoreA += (profile.tags[t] || 0));
      
      let scoreB = (profile.categories[b.category] || 0) * 2;
      b.tags.forEach(t => scoreB += (profile.tags[t] || 0));

      // Recency boost
      const recencyA = a.publishedAt / 1000000000;
      const recencyB = b.publishedAt / 1000000000;
      
      return (scoreB + recencyB) - (scoreA + recencyA);
    });
  } else {
    // Already sorted by 'desc' in firebase, but let's ensure it just in case
    filteredArticles.sort((a, b) => b.publishedAt - a.publishedAt);
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-zinc-900 pb-4 mb-10 gap-6">
        <h2 className="text-4xl md:text-5xl font-serif italic">Le pouls du web</h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Rechercher une tendance..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-zinc-100 border-none rounded-full pl-10 pr-6 py-2 w-64 text-sm focus:ring-1 focus:ring-zinc-400 outline-none"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-zinc-100 border border-zinc-200 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-tighter focus:outline-none appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select 
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              className="bg-zinc-100 border border-zinc-200 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-tighter focus:outline-none appearance-none"
            >
              <option value="">All Platforms</option>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6 mb-8 border-b border-zinc-200">
        <button 
          onClick={() => setFeedType('latest')} 
          className={cn("text-[10px] font-black uppercase tracking-widest pb-3 transition-colors border-b-2", feedType === 'latest' ? "text-zinc-900 border-zinc-900" : "text-zinc-400 border-transparent hover:text-zinc-600")}
        >
          Latest Intelligence
        </button>
        <button 
          onClick={() => setFeedType('foryou')} 
          className={cn("text-[10px] font-black uppercase tracking-widest pb-3 transition-colors border-b-2", feedType === 'foryou' ? "text-zinc-900 border-zinc-900" : "text-zinc-400 border-transparent hover:text-zinc-600")}
        >
          For You (Curated)
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20"><Rss size={32} className="animate-pulse text-gray-300" /></div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-24 px-6 border border-zinc-200 bg-white rounded-sm shadow-sm flex flex-col items-center justify-center max-w-2xl mx-auto mt-12">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
            <Search size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-2xl font-serif italic font-bold mb-2 text-zinc-900">Le flux est vide.</h3>
          <p className="text-zinc-500 text-sm mb-8">Les algorithmes n'ont pas encore généré de contenu. Si vous êtes administrateur, utilisez le Cockpit pour initier l'analyse.</p>
          <Link to="/admin" className="bg-zinc-900 text-white px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors">
            Ouvrir le Cockpit IA
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.map((article, idx) => (
            <Link 
              key={article.id} 
              to={`/article/${article.id}`}
              className={cn(
                "group overflow-hidden flex flex-col relative rounded-sm bg-zinc-900 border border-zinc-800",
                idx === 0 
                  ? "col-span-1 md:col-span-2 lg:col-span-2 h-[450px]" 
                  : "col-span-1 h-[350px]"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-900/60 to-zinc-900/10 opacity-90 z-10 pointer-events-none"></div>
              {article.imageUrl && (
                <img 
                  src={article.imageUrl} 
                  alt={article.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:scale-105 transition-transform duration-700" 
                />
              )}
              <div className="absolute top-4 right-4 text-white text-[10px] font-mono opacity-50 z-20">TRND-{article.id.substring(0, 4).toUpperCase()}</div>
              
              <div className="absolute bottom-0 p-6 z-20 w-full flex flex-col justify-end h-full">
                <div className="mb-3">
                  <span className="bg-indigo-600 text-[10px] font-black px-2 py-1 text-white uppercase tracking-widest inline-block">
                    {article.category}
                  </span>
                </div>
                <h3 className={cn(
                  "text-white font-bold leading-tight mb-2",
                  idx === 0 ? "text-4xl max-w-2xl" : "text-2xl line-clamp-3"
                )}>
                  {article.title}
                </h3>
                <p className="text-zinc-300 text-sm line-clamp-2 max-w-xl mb-4">
                  {article.summary}
                </p>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto border-t border-zinc-700/50 pt-4 gap-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {format(article.publishedAt, "dd MMM yyyy", { locale: fr })}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {article.platforms.map(p => (
                      <span key={p} className="text-[9px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded-sm uppercase tracking-tighter font-bold">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
