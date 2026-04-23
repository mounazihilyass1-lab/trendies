import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ArticleDetails from './pages/ArticleDetails';
import Admin from './pages/Admin';
import Layout from './components/Layout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="article/:id" element={<ArticleDetails />} />
          <Route path="admin/*" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
