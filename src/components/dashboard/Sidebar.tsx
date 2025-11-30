import {
  spaces,
  activeSpaceId,
  setActiveSpace,
  viewMode,
  isSettingsOpen,
  conversations,
  activeConversationId,
} from "../../stores/appStore";
import {
  LogoIcon,
  SearchIcon,
  FolderIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  MenuIcon,
} from "../icons";
import { clsx } from "clsx";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const recentConversations = conversations.value
    .filter((c) => c.spaceId === activeSpaceId.value)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5);

  if (collapsed) {
    return (
      <div className="w-[60px] h-full bg-bg-secondary border-r border-border flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors mb-4"
        >
          <MenuIcon size={20} className="text-text-secondary" />
        </button>
        <LogoIcon size={28} className="text-accent-primary mb-6" />
        <div className="flex-1 flex flex-col items-center gap-2 w-full px-2">
          {spaces.value.map((space) => (
            <button
              key={space.id}
              onClick={() => setActiveSpace(space.id)}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors",
                activeSpaceId.value === space.id
                  ? "bg-accent-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              )}
              title={space.name}
            >
              {space.icon}
            </button>
          ))}
        </div>
        <button
          onClick={() => (isSettingsOpen.value = true)}
          className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-text-primary"
        >
          <SettingsIcon size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[250px] h-full bg-bg-secondary border-r border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <LogoIcon size={24} className="text-accent-primary" />
          <span className="font-semibold text-text-primary">OmniRecall</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary"
        >
          <MenuIcon size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg">
          <SearchIcon size={16} className="text-text-tertiary" />
          <input
            type="text"
            placeholder="Search spaces..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </div>

      {/* Spaces */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
          Spaces
        </div>
        <div className="space-y-1">
          {spaces.value.map((space) => (
            <button
              key={space.id}
              onClick={() => setActiveSpace(space.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                activeSpaceId.value === space.id
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              )}
            >
              {space.id === activeSpaceId.value ? (
                <StarIcon size={16} className="flex-shrink-0" />
              ) : (
                <FolderIcon size={16} className="flex-shrink-0" />
              )}
              <span className="flex-1 truncate text-sm">{space.name}</span>
              <span className="text-xs text-text-tertiary">
                {space.documentCount}
              </span>
            </button>
          ))}
        </div>
        <button className="w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors">
          <PlusIcon size={16} />
          <span className="text-sm">New Space</span>
        </button>

        {/* Recent Conversations */}
        {recentConversations.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
              Recent
            </div>
            <div className="space-y-1">
              {recentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => (activeConversationId.value = conv.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors",
                    activeConversationId.value === conv.id
                      ? "bg-bg-tertiary text-text-primary"
                      : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  )}
                >
                  <div className="text-sm truncate">{conv.title}</div>
                  <div className="text-xs text-text-tertiary">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => (isSettingsOpen.value = true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
        >
          <SettingsIcon size={16} />
          <span className="text-sm">Settings</span>
        </button>
        <button
          onClick={() => (viewMode.value = "spotlight")}
          className="w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-lg text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-sm"
        >
          Press Alt+Space for Spotlight
        </button>
      </div>
    </div>
  );
}
