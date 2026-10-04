import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import {
  ProtectedRoute,
  AdminRoute,
  GuestRoute,
  LandingRoute,
} from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import GeneratePage from './pages/GeneratePage'
import ReportPreviewPage from './pages/ReportPreviewPage'
import AdminPage from './pages/AdminPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  { path: '/', element: <LandingRoute><LandingPage /></LandingRoute> },
  { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
  { path: '/dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
  { path: '/generate', element: <ProtectedRoute><GeneratePage /></ProtectedRoute> },
  { path: '/reports/:id', element: <ProtectedRoute><ReportPreviewPage /></ProtectedRoute> },
  { path: '/admin', element: <AdminRoute><AdminPage /></AdminRoute> },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
