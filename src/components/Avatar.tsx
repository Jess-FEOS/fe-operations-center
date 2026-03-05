interface AvatarProps {
  initials: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-sm',
}

export default function Avatar({ initials, color, size = 'md' }: AvatarProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center text-white font-fira font-bold shrink-0`}
      style={{ backgroundColor: color }}
      title={initials}
    >
      {initials}
    </div>
  )
}
