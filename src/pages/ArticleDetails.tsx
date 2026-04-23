import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Hash, Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface Article {
  title: string;
  content: string;
  category: string;
  platforms: string[];
  tags: string[];
  imageUrl?: string;
  imageUrls?: string[];
  publishedAt: number;
}

export default function ArticleDetails() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      if (!id) return;
      try {
        const docRef = doc(db, 'articles', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArticle(docSnap.data() as Article);
          
          // Increment views in Firestore
          try {
            await updateDoc(docRef, {
              views: increment(1)
            });
            console.log("View tracked successfully for article:", id);
          } catch (trackErr) {
            console.warn("Failed to track view (silently ignoring):", trackErr);
          }
        }
      } catch (err) {
        console.error("Fetch article error", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchArticle();
    
    // Track site visits (once per session)
    async function trackVisit() {
      const hasVisited = sessionStorage.getItem('trendies_visited');
      if (!hasVisited) {
        try {
          const statsRef = doc(db, 'site_stats', 'global');
          await setDoc(statsRef, {
            totalVisits: increment(1)
          }, { merge: true });
          sessionStorage.setItem('trendies_visited', 'true');
        } catch (e) {
          console.error("Failed to track visit", e);
        }
      }
    }
    trackVisit();
  }, [id]);

  useEffect(() => {
    if (article && id) {
      // Track view for personalization
      const profileStr = localStorage.getItem('trendies_profile');
      let profile = { categories: {} as Record<string, number>, tags: {} as Record<string, number> };
      try {
        if (profileStr) profile = JSON.parse(profileStr);
      } catch (e) {}

      profile.categories[article.category] = (profile.categories[article.category] || 0) + 1;
      article.tags.forEach((t: string) => profile.tags[t] = (profile.tags[t] || 0) + 1);
      localStorage.setItem('trendies_profile', JSON.stringify(profile));

      // Check saved state
      const savedStr = localStorage.getItem('trendies_saved');
      let saved: string[] = [];
      try {
        if (savedStr) saved = JSON.parse(savedStr);
      } catch (e) {}
      setIsSaved(saved.includes(id));
    }
  }, [article, id]);

  const toggleSave = () => {
    if (!id) return;
    const savedStr = localStorage.getItem('trendies_saved');
    let saved: string[] = [];
    try {
      if (savedStr) saved = JSON.parse(savedStr);
    } catch (e) {}

    let newSaved;
    if (isSaved) {
      newSaved = saved.filter(savedId => savedId !== id);
    } else {
      newSaved = [...saved, id];
      // Boost profile for saving
      if (article) {
        const profileStr = localStorage.getItem('trendies_profile');
        let profile = { categories: {} as Record<string, number>, tags: {} as Record<string, number> };
        try {
          if (profileStr) profile = JSON.parse(profileStr);
        } catch (e) {}
        profile.categories[article.category] = (profile.categories[article.category] || 0) + 2;
        localStorage.setItem('trendies_profile', JSON.stringify(profile));
      }
    }
    localStorage.setItem('trendies_saved', JSON.stringify(newSaved));
    setIsSaved(!isSaved);
  };

  if (isLoading) {
    return <div className="h-[60vh] flex items-center justify-center font-medium">Chargement...</div>;
  }

  if (!article) {
    return <div className="p-20 text-center font-medium text-xl">Article introuvable.</div>;
  }

  return (
    <article className="max-w-3xl mx-auto px-8 py-12">
      <div className="mb-12 border-b border-zinc-900 pb-8">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-900 transition-colors mb-12">
          <ArrowLeft size={12} /> Back to Insights
        </Link>
        <div className="flex gap-3 mb-6">
          <span className="bg-indigo-600 text-white px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest">
            {article.category}
          </span>
          {article.platforms.map(p => (
            <span key={p} className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border border-zinc-200">
              {p}
            </span>
          ))}
        </div>
        <h1 className="font-serif text-5xl md:text-6xl italic leading-tight tracking-tight mb-8">
          {article.title}
        </h1>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-t border-zinc-200 pt-4">
          <span>{format(article.publishedAt, "dd MMM yyyy", { locale: fr })}</span>
          <div className="flex items-center gap-4">
            <button onClick={toggleSave} className="flex items-center gap-1 hover:text-zinc-900 transition-colors">
              {isSaved ? <BookmarkCheck size={14} className="text-indigo-600" /> : <Bookmark size={14} />} 
              {isSaved ? 'Saved' : 'Save Article'}
            </button>
            <span className="bg-zinc-900 text-white px-2 py-1 rounded-sm">AI Curated</span>
          </div>
        </div>
      </div>

      {article.imageUrls && article.imageUrls.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          {article.imageUrls.map((url, i) => (
            <div key={i} className={cn("w-full overflow-hidden bg-zinc-100 rounded-sm outline outline-1 outline-zinc-200 outline-offset-4", article.imageUrls!.length === 1 ? 'md:col-span-2 aspect-video' : 'aspect-square')}>
              <img src={url} alt={`${article.title} - Image ${i+1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : article.imageUrl ? (
        <div className="w-full aspect-video overflow-hidden mb-16 bg-zinc-100 rounded-sm outline outline-1 outline-zinc-200 outline-offset-4">
          <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
        </div>
      ) : null}

      <div className="prose prose-zinc prose-a:text-indigo-600 prose-a:font-bold prose-p:text-zinc-800 prose-headings:font-bold max-w-none prose-h2:text-3xl prose-h3:text-2xl marker:text-indigo-600">
        <Markdown>{article.content}</Markdown>
      </div>

      <div className="mt-20 pt-10 border-t border-zinc-200">
        <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400 mb-4">Related Datapoints</h4>
        <div className="flex flex-wrap gap-2">
          {article.tags.map(tag => (
            <span key={tag} className="flex items-center text-[10px] font-bold uppercase tracking-tighter bg-white border border-zinc-200 px-2 py-1 rounded-sm text-zinc-600">
              <Hash size={10} className="mr-1 text-zinc-400" />
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
