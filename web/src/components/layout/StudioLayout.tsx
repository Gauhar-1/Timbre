import React from 'react'

export interface StudioLayoutProps {
  children: React.ReactNode
  dock?: React.ReactNode
  isConnected?: boolean
  connectedLabel?: string
  title?: string
  statusExtras?: React.ReactNode
  navActions?: React.ReactNode
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
  children,
  dock,
  isConnected = true,
  connectedLabel = 'Connected',
  title = 'timbre',
  statusExtras,
  navActions,
}) => {
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#09090b] text-zinc-50 select-none antialiased">
      {/* Background ambient lighting for world-class DAW depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(139,92,246,0.05),transparent_70%)]"
      />

      {/* Top Navbar: Slim, semi-transparent header */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/50 bg-[#09090b]/75 px-4 sm:px-6 backdrop-blur-md">
        {/* Left: Project title & tag */}
        <div className="flex items-center gap-3">
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

        {/* Center: Navigation Actions slot (e.g. Solo vs Multiplayer switcher) */}
        {navActions && (
          <div className="flex items-center">
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

      {/* Center Stage: Massive flex-1 container with subtle radial gradient background */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-start overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 pb-36 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#09090b] to-[#09090b]">
        <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-start">
          {children}
        </div>
      </main>

      {/* Bottom Dock slot: Fixed floating container */}
      {dock && (
        <div className="relative z-30">
          {dock}
        </div>
      )}
    </div>
  )
}

export default StudioLayout
