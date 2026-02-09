import type { TabId } from '../../types/navigation'

interface TabHeaderProps {
  activeTab: TabId
}

const titles: Record<TabId, string> = {
  home: '',
  discover: 'Masterpieces',
  search: 'Search',
  favorites: 'Saved',
  settings: 'Settings',
}

export function TabHeader({ activeTab }: TabHeaderProps) {
  if (activeTab === 'home') {
    return (
      <header className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-accent">GEUSE</span>
          <span className="text-xs text-text-secondary font-medium mt-0.5">curator</span>
        </div>
      </header>
    )
  }

  return (
    <header className="px-5 pt-4 pb-2 flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">
        {titles[activeTab]}
      </h1>
    </header>
  )
}
