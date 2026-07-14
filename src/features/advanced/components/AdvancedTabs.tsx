import styles from '../pages/AdvancedMenu.module.css'

export type AdvancedTab = 'devoluciones' | 'reimpresion' | 'cierres' | 'terminal' | 'metrics' | 'cola'

interface Props {
  activeTab: AdvancedTab
  onSelectTab: (tab: AdvancedTab) => void
}

export function AdvancedTabs({ activeTab, onSelectTab }: Props) {
  return (
    <div className={styles.tabs}>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'devoluciones' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('devoluciones')}
      >
        Devoluciones
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'reimpresion' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('reimpresion')}
      >
        Reimpresión
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'cierres' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('cierres')}
      >
        Cierres de Caja
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'terminal' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('terminal')}
      >
        Terminal
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'metrics' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('metrics')}
      >
        Métricas
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeTab === 'cola' ? styles.activeTab : ''}`}
        onClick={() => onSelectTab('cola')}
      >
        Cola Offline
      </button>
    </div>
  )
}
