// Shared open/close state for the AI Assistant drawer so the top-bar trigger
// (AppHeader) and the drawer rendered in the dashboard layout stay in sync.
export function useAiAssistant() {
  const isOpen = useState('ai-assistant-open', () => false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return { isOpen, open, close, toggle }
}
