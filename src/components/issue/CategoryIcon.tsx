import {
  Construction,
  Droplet,
  Waves,
  Lightbulb,
  Zap,
  Trash2,
  CircleAlert,
  Hammer,
  TreePine,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  construction: Construction,
  droplet: Droplet,
  waves: Waves,
  lightbulb: Lightbulb,
  zap: Zap,
  'trash-2': Trash2,
  'circle-alert': CircleAlert,
  hammer: Hammer,
  'tree-pine': TreePine,
  'alert-triangle': TriangleAlert,
}

interface CategoryIconProps {
  icon: string | null | undefined
  className?: string
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  const Icon = (icon && ICONS[icon]) || TriangleAlert
  return <Icon className={className} />
}
