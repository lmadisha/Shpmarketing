// Shared sidebar UI state so the top app bar (hamburger) and the Sidebar
// drawer stay in sync on mobile. Collapse state is desktop-only.
export function useSidebar() {
  const isOpen = useState('sidebar-open', () => false)
  const isCollapsed = useState('sidebar-collapsed', () => false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function toggleCollapsed() {
    isCollapsed.value = !isCollapsed.value
  }

  return { isOpen, isCollapsed, open, close, toggle, toggleCollapsed }
}
