import { cn } from '@/lib/utils'

interface BrandMarkProps {
  size?: 'sm' | 'md'
  className?: string
}

const sizeClass = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
}

export default function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}isologo.png`}
      alt="Bartez"
      className={cn(sizeClass[size], 'flex-shrink-0 object-contain', className)}
      draggable={false}
    />
  )
}
