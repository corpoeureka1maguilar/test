export type AdvancedTab = 'devoluciones' | 'reimpresion' | 'cierres' | 'terminal' | 'metrics' | 'cola'

interface Props {
  activeTab: AdvancedTab
  onSelectTab: (tab: AdvancedTab) => void
}

const TAB_BASE =
  'flex-1 whitespace-nowrap border-none bg-transparent px-4 py-[0.6rem] text-[0.95rem] font-bold text-text-muted rounded-[15px] cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] font-app hover:text-text hover:bg-white/40'
const TAB_ACTIVE = 'bg-white text-text! shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)]'

export function AdvancedTabs({ activeTab, onSelectTab }: Props) {
  return (
    <div className="flex bg-surface p-[0.3rem] rounded-[20px] gap-2 w-full mb-6">
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'devoluciones' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('devoluciones')}
      >
        Devoluciones
      </button>
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'reimpresion' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('reimpresion')}
      >
        Reimpresión
      </button>
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'cierres' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('cierres')}
      >
        Cierres de Caja
      </button>
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'terminal' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('terminal')}
      >
        Terminal
      </button>
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'metrics' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('metrics')}
      >
        Métricas
      </button>
      <button
        type="button"
        className={`${TAB_BASE} ${activeTab === 'cola' ? TAB_ACTIVE : ''}`}
        onClick={() => onSelectTab('cola')}
      >
        Cola Offline
      </button>
    </div>
  )
}
