import { Navigate } from 'react-router-dom';

// /anime = главная страница (всё аниме в одном месте)
export default function CategoryPage() {
  return <Navigate to="/" replace />;
}
