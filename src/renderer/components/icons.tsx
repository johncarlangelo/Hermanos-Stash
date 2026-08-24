import {
  ArrowLeft,
  Braces,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Code,
  Copy,
  Crop,
  FileText,
  Film,
  Folder,
  Image,
  Loader2,
  Lock,
  Music,
  Search,
  Settings,
  Sparkles,
  Star,
  TriangleAlert,
  UploadCloud,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  'file-text': FileText,
  image: Image,
  crop: Crop,
  film: Film,
  music: Music,
  braces: Braces,
  code: Code,
  sparkles: Sparkles,
  star: Star,
  clock: Clock,
  search: Search,
  settings: Settings,
  x: X,
  check: Check,
  copy: Copy,
  back: ArrowLeft,
  chevron: ChevronRight,
  upload: UploadCloud,
  alert: TriangleAlert,
  loader: Loader2,
  lock: Lock
}

/** Resolve a Lucide icon by name with a neutral fallback. */
export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? Circle
}
