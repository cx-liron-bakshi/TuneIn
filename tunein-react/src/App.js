import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./Pages/AuthPage";
import HomePage from "./Pages/HomePage";
import RoomPage from "./Pages/RoomPage";
import AuthCallbackPage from "./Pages/AuthCallbackPage";
import { AuthProvider, useAuth } from "./Components/AuthPage/AuthContext";
import ErrorBoundary from "./Components/.reusable/ErrorBoundary";

function App() {




  // Protected route component
  const ProtectedRoute = ({ element }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    return isAuthenticated ? element : <Navigate to="/auth" replace />;
  };

  return (
    <ErrorBoundary>
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/home" element={<ProtectedRoute element={<HomePage />} />} />
          <Route path="/room/:roomId" element={<ProtectedRoute element={<RoomPage />} />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;