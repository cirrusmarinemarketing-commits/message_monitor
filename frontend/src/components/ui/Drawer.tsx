import type { ReactNode } from 'react'

type DrawerProps = {
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

function Drawer({ onClose, children, wide = false }: DrawerProps) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className={`drawer${wide ? ' drawer-wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Drawer
