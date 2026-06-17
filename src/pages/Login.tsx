import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from '@/lib/auth'
import BrandMark from '@/components/layout/BrandMark'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setError(null)
    try {
      await signIn(data.email, data.password)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? 'Credenciales incorrectas. Revisá email y contraseña.' : 'Error al ingresar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logotipo */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BrandMark />
            <span className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Bartez CRM
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Ingresá con tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full px-3 py-2 text-sm border rounded-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-green-deep transition-colors"
              style={{
                borderColor: errors.email ? '#ef4444' : 'var(--border)',
                color: 'var(--text)',
                backgroundColor: 'var(--surface)',
              }}
            />
            {errors.email && (
              <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text)' }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full px-3 py-2 text-sm border rounded-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-green-deep transition-colors"
              style={{
                borderColor: errors.password ? '#ef4444' : 'var(--border)',
                color: 'var(--text)',
                backgroundColor: 'var(--surface)',
              }}
            />
            {errors.password && (
              <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 text-sm font-medium text-white bg-green-deep rounded-sm hover:bg-green-ink transition-colors focus:outline-none focus:ring-2 focus:ring-green-deep focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
