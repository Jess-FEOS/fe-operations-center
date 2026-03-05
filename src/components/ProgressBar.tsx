interface ProgressBarProps {
  percent: number
  size?: 'sm' | 'md'
}

export default function ProgressBar({ percent, size = 'sm' }: ProgressBarProps) {
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${size === 'sm' ? 'h-2' : 'h-3'}`}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          backgroundColor: percent === 100 ? '#046A38' : '#0762C8',
        }}
      />
    </div>
  )
}
