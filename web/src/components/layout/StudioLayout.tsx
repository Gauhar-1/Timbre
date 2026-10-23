import { Archive } from 'lucide-react'

export interface StudioLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  mobileDrawer?: React.ReactNode
  isConnected?: boolean
  connectedLabel?: string
  title?: string
  statusExtras?: React.ReactNode
  navActions?: React.ReactNode
  onToggleMobileVault?: () => void
  mobileVaultCount?: number | null
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
  children,
  sidebar,
  mobileDrawer,
  isConnected = true,
  connectedLabel = 'Connected',
  title = 'timbre',
  statusExtras,
  navActions,
  onToggleMobileVault,
  mobileVaultCount,
}) => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-50 select-none antialiased">
      {/* Background ambient lighting for world-class DAW depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(139,92,246,0.05),transparent_70%)]"
      />

      {/* Full-viewport CSS Grid split-pane (grid-cols-1 md:grid-cols-[300px_1fr]) */}
      <div className="relative z-10 grid h-full w-full grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden">
        {/* Left Pane: RecordingVault Sidebar (Hidden on small mobile, persistent split-pane on md+) */}
        <aside className="hidden md:flex h-full w-[300px] flex-col border-r border-zinc-800/80 bg-[#09090b] z-20 overflow-hidden shrink-0 shadow-xl">
          {sidebar}
        </aside>

        {/* Right Pane: Main Studio Workspace & Header */}
        <div className="flex flex-col h-full overflow-hidden min-w-0 relative">
        {/* Step 2: Top Navbar with z-40 stacking context */}
        <header className="relative z-40 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 p-4 border-b border-zinc-800/60 bg-[#09090b]/80 backdrop-blur-md shrink-0">
          {/* Left: Mobile Vault Toggle Button & Project Branding */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Mobile Vault drawer button */}
            {onToggleMobileVault && (
              <button
                type="button"
                onClick={onToggleMobileVault}
                className="md:hidden inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Open Vault"
              >
                <Archive className="h-4 w-4 text-violet-400" />
                {mobileVaultCount !== null && mobileVaultCount !== undefined && (
                  <span className="text-[10px] font-mono text-violet-400 font-bold">
                    {mobileVaultCount}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
              <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-50 font-sans">
                {title}
              </span>
            </div>
            <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Studio
            </span>
          </div>

          {/* Center: Navigation Actions slot (Solo vs Multiplayer switcher) */}
          {navActions && (
            <div className="flex items-center justify-center w-full sm:w-auto overflow-x-auto">
              {navActions}
            </div>
          )}

          {/* Right: Pulsing green "Connected" status indicator + system dots */}
          <div className="flex items-center gap-3 sm:gap-4">
            {statusExtras}

            <div
              id="status-connection-badge"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'
                  }`}
                />
              </span>
              <span className="text-[11px] font-medium tracking-tight text-emerald-300">
                {connectedLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Center Stage: Full flex-1 container with subtle radial gradient background */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-start overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#09090b] to-[#09090b]">
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-start">
            {children}
          </div>
        </main>
      </div>
    </div>

    {/* Step 2: Mobile Drawer with z-50 stacking context to completely cover z-40 header */}
    {mobileDrawer}
  </div>
)
}

export default StudioLayout
