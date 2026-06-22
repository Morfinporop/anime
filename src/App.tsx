import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import CacheWarmer from './components/CacheWarmer';
import HomePage from './pages/HomePage';
import AnimePage from './pages/AnimePage';
import EpisodePage from './pages/EpisodePage';
import { FavoritesPage } from './pages/ListPage';
import SearchPage from './pages/SearchPage';
import UploadPage from './pages/UploadPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CacheWarmer />
      <div className="flex min-h-screen flex-col bg-white text-zinc-900">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/anime" element={<HomePage />} />
            <Route path="/anime/:id" element={<AnimePage />} />
            <Route path="/anime/:id/season/:seasonId" element={<AnimePage />} />
            <Route path="/episode/:id" element={<EpisodePage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
