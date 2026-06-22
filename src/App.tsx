import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import VideoPage from './pages/VideoPage';
import { FavoritesPage, HistoryPage } from './pages/ListPage';
import ListsPage from './pages/ListsPage';
import SearchPage from './pages/SearchPage';
import UploadPage from './pages/UploadPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col bg-white text-zinc-900">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/anime" element={<CategoryPage key="anime" />} />
            <Route path="/anime/:id" element={<VideoPage />} />
            <Route path="/popular" element={<ListsPage mode="popular" />} />
            <Route path="/latest" element={<ListsPage mode="latest" />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
