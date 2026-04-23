import { useState, useRef, useEffect } from 'react';
import { generateSuggestions, generateArticle } from '../lib/geminiService';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sparkles, Loader2, Plus, RefreshCw, Upload, X, LogOut, FileText, Settings, Trash2, Edit } from 'lucide-react';

interface ArticleData {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  publishedAt?: number;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.6));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function AdminDashboard({ onLogout }: { onLogout?: () => void }) {
  const [activeTab, setActiveTab] = useState<'ai' | 'manage'>('ai');
  const [topicInput, setTopicInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{base64: string, mimeType: string}[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);

  // Manage Articles State
  const [publishedArticles, setPublishedArticles] = useState<ArticleData[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchArticles = async () => {
    setIsLoadingArticles(true);
    try {
      const q = query(collection(db, 'articles'), orderBy('publishedAt', 'desc'));
      const snapshot = await getDocs(q);
      setPublishedArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleData)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingArticles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') {
      fetchArticles();
    }
  }, [activeTab]);

  const handleDeleteArticle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'articles', id));
      setPublishedArticles(prev => prev.filter(a => a.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleUpdateArticle = async () => {
    if (!editingArticle) return;
    try {
      const { id, ...data } = editingArticle;
      await updateDoc(doc(db, 'articles', id), data);
      alert("Article mis à jour avec succès.");
      setEditingArticle(null);
      fetchArticles();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise à jour.");
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 4); // Limit to 4 images
    try {
      const compressedUrls = await Promise.all(files.map(f => compressImage(f)));
      setEditingArticle(prev => prev ? { 
        ...prev, 
        imageUrl: compressedUrls[0], // fallback for old queries
        imageUrls: compressedUrls 
      } : null);
    } catch (err) {
      alert("Erreur au traitement de l'image");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 4); // Limit to 4 images
    try {
      const compressedUrls = await Promise.all(files.map(f => compressImage(f)));
      setUploadPreviews(compressedUrls);
      setUploadedImages(compressedUrls.map(url => ({
        base64: url,
        mimeType: 'image/webp'
      })));
    } catch(err) {
      alert("Erreur au traitement de l'image");
    }
  };

  const fetchSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const result = await generateSuggestions();
      setSuggestions(result);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la génération des suggestions.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleGenerateArticle = async (topic: string, useUploaded = false) => {
    setGeneratingArticle(topic);
    try {
      const firstImgToUse = useUploaded && uploadedImages.length > 0 ? uploadedImages[0] : undefined;
      const article = await generateArticle(topic, firstImgToUse?.base64, firstImgToUse?.mimeType);
      
      const allUrlsToSave = useUploaded && uploadedImages.length > 0 
        ? uploadedImages.map(img => img.base64) 
        : (article.imageUrl ? [article.imageUrl] : ["https://placehold.co/800x600/f5f2ed/000000?text=Trendies."]);

      const articleData = {
        title: article.title,
        content: article.content,
        summary: article.summary,
        category: article.category,
        platforms: article.platforms,
        tags: article.tags,
        // Si on a uploadé des images, on les utilise
        imageUrl: allUrlsToSave[0],
        imageUrls: allUrlsToSave,
        publishedAt: Date.now(), // Store as JS timestamp for easier sorting
      };
      
      console.log("Saving article to Firebase.");

      await addDoc(collection(db, 'articles'), articleData);
      
      // Remove from suggestions
      setSuggestions(s => s.filter(t => t !== topic));
      
      if (useUploaded) {
        setUploadedImages([]);
        setUploadPreviews([]);
        setTopicInput('');
      }
      return true;
    } catch (error) {
      console.error("Error creating article:", error);
      alert("Erreur lors de la création de l'article. Consultez la console.");
      return false;
    } finally {
      setGeneratingArticle(null);
    }
  };

  const executeAutoPilot = async () => {
    if (!confirm("Voulez-vous vraiment lancer la génération automatique et publier plusieurs articles d'un coup ?")) return;
    
    setIsAutoGenerating(true);
    try {
      let currentTopics = [...suggestions];
      
      // Fetch new suggestions if list is very small
      if (currentTopics.length < 2) {
        setIsLoadingSuggestions(true);
        currentTopics = await generateSuggestions();
        setSuggestions(currentTopics);
        setIsLoadingSuggestions(false);
      }

      // Take top 3 for auto-generation
      const topicsToGenerate = currentTopics.slice(0, 3);
      
      for (const topic of topicsToGenerate) {
        await handleGenerateArticle(topic);
      }
      
      alert(`Auto-Pilot terminé : ${topicsToGenerate.length} articles publiés.`);
    } catch (err) {
      console.error(err);
      alert("Auto-Pilot interrompu par une erreur.");
    } finally {
      setIsAutoGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-900 pb-4 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">System Active</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl italic font-bold">Trendies Cockpit</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-100 rounded-sm p-1">
            <button 
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-colors ${activeTab === 'ai' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <Sparkles size={14} className="inline mr-2 -mt-0.5" /> AI Operations
            </button>
            <button 
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-sm transition-colors ${activeTab === 'manage' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <FileText size={14} className="inline mr-2 -mt-0.5" /> Data Manager
            </button>
          </div>
          {onLogout && (
            <button onClick={onLogout} className="text-zinc-400 hover:text-red-500 transition-colors" title="Disconnect">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ai' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-8">
          <div className="bg-zinc-900 text-white p-8 rounded-sm">
            <h3 className="font-black uppercase tracking-widest text-[10px] text-zinc-400 mb-4 border-b border-zinc-700 pb-2">Auto-Pilot System</h3>
            <p className="text-sm text-zinc-300 mb-6 font-medium">Scrape internet for trends and automatically publish articles. Use with caution.</p>
            <button 
              onClick={executeAutoPilot}
              disabled={isAutoGenerating || generatingArticle !== null}
              className="w-full bg-red-600 text-white py-3 rounded-sm font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 disabled:opacity-50 transition-colors shadow-lg"
            >
              {isAutoGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Initiate Full Auto-Pilot
            </button>
          </div>

          <div className="bg-zinc-900 text-white p-8 rounded-sm">
            <h3 className="font-black uppercase tracking-widest text-[10px] text-zinc-400 mb-4 border-b border-zinc-700 pb-2">Manual Generation</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Ex : Nouvelle trend TikTok..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-sm text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
              />
              <div className="border border-zinc-700 rounded-sm bg-zinc-800 p-3 relative hover:border-indigo-500 transition-colors cursor-pointer">
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-700 rounded-sm flex items-center justify-center shrink-0 overflow-hidden">
                      {uploadPreviews.length > 0 ? (
                        <img src={uploadPreviews[0]} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <Upload size={16} className="text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Images (Max 4)</p>
                      <p className="text-xs text-zinc-500 truncate cursor-pointer hover:text-white transition-colors">
                        {uploadPreviews.length > 0 ? `${uploadPreviews.length} image(s) chargée(s).` : "Cliquez ou glissez ICI"}
                      </p>
                    </div>
                    {uploadPreviews.length > 0 && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUploadPreviews([]); setUploadedImages([]); }}
                        className="p-1 hover:bg-zinc-700 rounded-sm z-20 shrink-0 text-zinc-400 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {uploadPreviews.length > 1 && (
                    <div className="flex gap-2 mt-2">
                      {uploadPreviews.slice(1).map((p, i) => (
                        <div key={i} className="w-10 h-10 bg-zinc-900 rounded-sm overflow-hidden">
                          <img src={p} alt="Preview extra" className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => topicInput && handleGenerateArticle(topicInput, true)}
                disabled={!topicInput || generatingArticle !== null}
                className="w-full bg-indigo-600 text-white py-3 rounded-sm font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {generatingArticle === topicInput ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Rédiger & Publier
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-8 rounded-sm border border-zinc-200">
            <div className="flex items-center justify-between mb-8 border-b border-zinc-200 pb-4">
              <h3 className="font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 text-zinc-900">
                <Sparkles size={14} className="text-indigo-600" /> 
                AI Sourced Insights
              </h3>
              <button 
                onClick={fetchSuggestions}
                disabled={isLoadingSuggestions}
                className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {isLoadingSuggestions ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Refresh Data
              </button>
            </div>

            {suggestions.length === 0 && !isLoadingSuggestions ? (
              <div className="text-center py-16 px-6 border-2 border-dashed border-zinc-200 rounded-sm bg-zinc-50 flex flex-col items-center justify-center">
                <Sparkles size={32} className="text-zinc-300 mb-4" />
                <h4 className="text-lg font-bold text-zinc-900 mb-2">No active insights.</h4>
                <p className="text-sm font-medium text-zinc-500 mb-6 max-w-sm">
                  The AI needs to scan social networks to find trending topics. You can initiate a scan or use the Auto-Pilot.
                </p>
                <button
                  onClick={fetchSuggestions}
                  className="bg-zinc-900 text-white px-6 py-3 rounded-sm text-[10px] uppercase font-black tracking-widest hover:bg-indigo-600 transition-colors"
                >
                  Scan the Web Now
                </button>
              </div>
            ) : null}

            <div className="space-y-0">
              {suggestions.map((topic, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-zinc-100 group">
                  <div className="border-l-2 border-indigo-500 pl-4 mb-3 sm:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Priority Query</span>
                    </div>
                    <p className="font-bold text-sm text-zinc-900">{topic}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSuggestions(s => s.filter(t => t !== topic))}
                      disabled={generatingArticle !== null}
                      className="shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleGenerateArticle(topic)}
                      disabled={generatingArticle !== null}
                      className="shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-indigo-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                      {generatingArticle === topic ? <Loader2 size={12} className="animate-spin" /> : "Generate Article →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white p-8 rounded-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-8 border-b border-zinc-200 pb-4">
            <h3 className="font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 text-zinc-900">
              <Settings size={14} className="text-indigo-600" /> 
              Published Database
            </h3>
            <button 
              onClick={fetchArticles}
              disabled={isLoadingArticles}
              className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {isLoadingArticles ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh Data
            </button>
          </div>

          {editingArticle ? (
            <div className="border border-zinc-200 rounded-sm p-6 mb-8 bg-zinc-50">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-lg">Modifier l'article</h4>
                <button onClick={() => setEditingArticle(null)} className="text-zinc-400 hover:text-red-500"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1">Titre</label>
                  <input 
                    type="text" 
                    value={editingArticle.title}
                    onChange={e => setEditingArticle({...editingArticle, title: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-sm text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1">Contenu (Markdown)</label>
                  <textarea 
                    value={editingArticle.content}
                    onChange={e => setEditingArticle({...editingArticle, content: e.target.value})}
                    rows={8}
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-sm text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1">Image Couverture (Remplacer)</label>
                  <div className="border border-zinc-300 rounded-sm bg-white p-3 relative hover:border-indigo-500 transition-colors cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleEditImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-sm flex items-center justify-center shrink-0 overflow-hidden">
                        {editingArticle.imageUrl && !editingArticle.imageUrl.includes('placehold') ? (
                          <img src={editingArticle.imageUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <Upload size={16} className="text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Image Source</p>
                        <p className="text-xs text-zinc-500 truncate">Cliquez ou glissez une nouvelle image ICI pour remplacer (max 700KB)</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={handleUpdateArticle}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-colors"
                  >
                    Mettre à jour
                  </button>
                  <button 
                    onClick={() => setEditingArticle(null)}
                    className="bg-white border border-zinc-200 text-zinc-600 px-6 py-3 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-zinc-100 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-4 text-[10px] uppercase font-black tracking-widest text-zinc-400 w-[50%]">Article Title</th>
                  <th className="py-4 text-[10px] uppercase font-black tracking-widest text-zinc-400">ID</th>
                  <th className="py-4 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {publishedArticles.length === 0 && !isLoadingArticles ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-zinc-500 italic">No published articles found.</td>
                  </tr>
                ) : (
                  publishedArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-sm text-zinc-900 truncate pr-4">{article.title}</div>
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-[10px] text-zinc-400">{article.id}</span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => setEditingArticle(article)}
                            className="text-zinc-400 hover:text-indigo-600 transition-colors" title="Edit Article"
                          >
                            <Edit size={16} />
                          </button>
                          {confirmDeleteId === article.id ? (
                            <div className="flex gap-2 items-center bg-red-50 px-2 py-1 rounded-sm border border-red-100">
                              <button onClick={() => handleDeleteArticle(article.id)} className="text-red-600 hover:text-red-700 text-[10px] font-black uppercase tracking-widest transition-colors">Confirm</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-zinc-500 hover:text-zinc-700 text-[10px] font-black uppercase tracking-widest transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setConfirmDeleteId(article.id)}
                              className="text-zinc-400 hover:text-red-600 transition-colors" title="Delete Article"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
