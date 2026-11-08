import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown as LChevronDown,
  ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight,
  CircleCheck,
  CircleX,
  ClipboardPaste,
  Code,
  Columns3,
  Command,
  Copy,
  CornerDownLeft,
  Cpu,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  Gauge,
  GitBranch,
  Globe,
  History,
  Info,
  KeyRound,
  Keyboard,
  Languages,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  Minus,
  Palette,
  PanelLeft,
  Paperclip,
  PencilLine,
  PenLine,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from "lucide-preact";

interface IconProps {
  size?: number;
  className?: string;
}

/// Wrap a Lucide icon in the app's icon API ({ size, className }). One
/// stroke weight everywhere keeps the set optically consistent; it gets
/// slightly heavier at small sizes so 12px glyphs don't go faint.
function icon(Component: LucideIcon, weight = 1.75) {
  return function AppIcon({ size = 20, className = "" }: IconProps) {
    const strokeWidth = size <= 12 ? weight + 0.35 : size <= 14 ? weight + 0.15 : weight;
    return <Component size={size} strokeWidth={strokeWidth} className={className} aria-hidden={true} />;
  };
}

/// OmniRecall's glyph: an arrow returning into a loop ("recall").
export function LogoIcon({ size = 32, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden="true" focusable="false" viewBox="0 0 100 100" fill="none" className={className}>
      <path d="M65 35L50 50L65 65" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M50 50H70C81.0457 50 90 41.0457 90 30C90 18.9543 81.0457 10 70 10H50C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C72.0914 90 90 72.0914 90 50"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/// The glyph set in a softly lit accent tile — the app's brand mark.
export function LogoMark({ size = 28, className = "" }: IconProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center flex-shrink-0 text-accent-fg ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 80%, white), var(--accent) 55%, color-mix(in srgb, var(--accent) 70%, var(--accent-2)))",
        boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset, 0 4px 14px -4px color-mix(in srgb, var(--accent) 55%, transparent)",
      }}
      aria-hidden="true"
    >
      <LogoIcon size={Math.round(size * 0.58)} />
    </span>
  );
}

/// Three pulsing dots shown while waiting for the first token.
export function TypingIndicator({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

export const PinIcon = icon(Pin);
export const SearchIcon = icon(Search);
export const SendIcon = icon(ArrowUp, 2.25);
export const SettingsIcon = icon(Settings2);
export const ExpandIcon = icon(Maximize2);
export const CollapseIcon = icon(Minimize2);
export const CloseIcon = icon(X);
export const ClipboardIcon = icon(ClipboardPaste);
export const CopyIcon = icon(Copy);
export const FolderIcon = icon(Folder);
export const FolderOpenIcon = icon(FolderOpen);
export const PlusIcon = icon(Plus);
export const DocumentIcon = icon(FileText);
export const ChevronDownIcon = icon(LChevronDown);
export const ChevronRightIcon = icon(LChevronRight);
export const ChevronLeftIcon = icon(LChevronLeft);
export const RefreshIcon = icon(RefreshCw);
export const MenuIcon = icon(PanelLeft);
export const CheckIcon = icon(Check, 2);
export const AlertIcon = icon(TriangleAlert);
export const KeyIcon = icon(KeyRound);
export const EyeIcon = icon(Eye);
export const EyeOffIcon = icon(EyeOff);
export const BranchIcon = icon(GitBranch);
export const DownloadIcon = icon(Download);
export const UploadIcon = icon(Upload);
export const CompareIcon = icon(Columns3);
export const CommandIcon = icon(Command);
export const RegenerateIcon = icon(RotateCcw);
export const TrashIcon = icon(Trash2);
export const EditIcon = icon(PencilLine);
export const TokenIcon = icon(Gauge);
export const MessageIcon = icon(MessageSquare);
export const PaperclipIcon = icon(Paperclip);
export const NewChatIcon = icon(SquarePen);
export const MinimizeIcon = icon(Minus);
export const SparklesIcon = icon(Sparkles);
export const LightbulbIcon = icon(Lightbulb);
export const PenIcon = icon(PenLine);
export const TranslateIcon = icon(Languages);
export const KeyboardIcon = icon(Keyboard);
export const PaletteIcon = icon(Palette);
export const ShieldIcon = icon(ShieldCheck);
export const SlidersIcon = icon(SlidersHorizontal);
export const CodeIcon = icon(Code);
export const InfoIcon = icon(Info);
export const ErrorCircleIcon = icon(CircleX);
export const SuccessCircleIcon = icon(CircleCheck);
export const BookIcon = icon(BookOpen);
export const HistoryIcon = icon(History);
export const ArrowDownIcon = icon(ArrowDown);
export const MoreIcon = icon(Ellipsis);
export const GlobeIcon = icon(Globe);
export const CpuIcon = icon(Cpu);
export const EnterIcon = icon(CornerDownLeft);
export const StopSquareIcon = icon(Square);

/// Spinning loader.
export function SpinnerIcon({ size = 20, className = "" }: IconProps) {
  return <LoaderCircle size={size} strokeWidth={2} className={`animate-spin ${className}`} aria-hidden={true} />;
}

/// A filled square: the universal "stop" glyph.
export function StopIcon({ size = 20, className = "" }: IconProps) {
  const s = Math.round(size * 0.45);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className={className}>
      <rect x={(size - s) / 2} y={(size - s) / 2} width={s} height={s} rx={Math.max(1.5, s * 0.18)} fill="currentColor" />
    </svg>
  );
}
