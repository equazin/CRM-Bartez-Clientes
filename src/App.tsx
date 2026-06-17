import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Hoy from '@/pages/Hoy'
import Empresas from '@/pages/Empresas'
import EmpresaDetalle from '@/pages/EmpresaDetalle'
import Pipeline from '@/pages/Pipeline'
import Agenda from '@/pages/Agenda'
import Oportunidades from '@/pages/Oportunidades'
import Reportes from '@/pages/Reportes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Hoy />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/empresas" element={<Empresas />} />
                <Route path="/empresas/:id" element={<EmpresaDetalle />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/oportunidades" element={<Oportunidades />} />
                <Route path="/reportes" element={<Reportes />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
