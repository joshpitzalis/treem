import type {
  DataReadiness,
  LeaderboardSummary,
  RankedContributor,
  TimeRangeKey,
  TreemapSummary
} from "../../shared/types"

import {
  buildTreemapTileStyle,
  createTreemapLayout,
  describeTreemapTileDensity,
  formatPercentage,
  formatScore
} from "../lib/helpers"

export function ReadinessChip(input: { state: DataReadiness }) {
  const copy =
    input.state.status === "ready"
      ? "Ready"
      : input.state.status === "scroll"
        ? "Scroll more"
        : "Not up to date"

  return (
    <span className={`readiness-chip is-${input.state.status}`}>
      {input.state.label}: {copy}
    </span>
  )
}

export function LeaderboardSection(input: {
  onTimeRangeChange: (timeRange: TimeRangeKey) => Promise<void>
  scopeLabel: string
  selectedTimeRange: TimeRangeKey
  summary: LeaderboardSummary
}) {
  const topTen = input.summary.ranked.slice(0, 10)
  const viewerOutsideTopTen =
    input.summary.viewer && input.summary.viewer.rank > 10
      ? input.summary.viewer
      : null

  return (
    <>
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Discord Contributions Leaderboard</h2>
        <p className="leaderboard-subtitle">{input.scopeLabel}</p>
        <div className="time-tabs" role="tablist" aria-label="Time range">
          {(["24h", "7d", "30d"] as const).map((timeRange) => (
            <button
              key={timeRange}
              className={`time-tab ${
                input.selectedTimeRange === timeRange ? "is-active" : ""
              }`}
              data-range={timeRange}
              type="button"
              onClick={() => {
                void input.onTimeRangeChange(timeRange)
              }}
            >
              {timeRange}
            </button>
          ))}
        </div>
      </div>

      {topTen.length === 0 ? (
        <div className="empty-state">
          No contributors captured for this slice yet.
        </div>
      ) : (
        topTen.map((contributor) => (
          <ContributorCard
            key={contributor.authorKey}
            contributor={contributor}
            viewerAuthorKey={input.summary.viewer?.authorKey ?? null}
          />
        ))
      )}

      {viewerOutsideTopTen ? (
        <>
          <div className="you-divider">Your position</div>
          <ContributorCard
            contributor={viewerOutsideTopTen}
            viewerAuthorKey={viewerOutsideTopTen.authorKey}
          />
        </>
      ) : null}

      <GapCard summary={input.summary} />
    </>
  )
}

export function GapCard(input: { summary: LeaderboardSummary }) {
  if (!input.summary.viewer) return null
  if (input.summary.viewer.rank <= 10) return null
  if (input.summary.isTopTenOpen) return null
  if (input.summary.gapToTopTen == null) return null

  return (
    <article className="gap-card">
      <p className="gap-title">Leaderboard gap</p>
      <p className="gap-value">
        {formatScore(input.summary.gapToTopTen)} points to pass #10
      </p>
      <p className="gap-copy">
        Current #10 score: {formatScore(input.summary.topTenScore ?? 0)} points.
      </p>
    </article>
  )
}

export function ContributorCard(input: {
  contributor: RankedContributor
  viewerAuthorKey: string | null
}) {
  const isViewer = input.viewerAuthorKey === input.contributor.authorKey

  return (
    <article className={`leader-card ${isViewer ? "is-viewer" : ""}`}>
      <div className="leader-rank">#{input.contributor.rank}</div>
      {input.contributor.authorAvatarUrl ? (
        <img
          className="avatar"
          src={input.contributor.authorAvatarUrl}
          alt={`${input.contributor.authorName} avatar`}
        />
      ) : (
        <div className="avatar-fallback">
          {input.contributor.authorName.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <div className="leader-main">
        <div className="leader-name-row">
          <div className="leader-name">{input.contributor.authorName}</div>
          {isViewer ? <span className="you-pill">You</span> : null}
        </div>
        <div className="leader-meta">
          {formatScore(input.contributor.score)} points ·{" "}
          {input.contributor.messageCount} messages ·{" "}
          {input.contributor.replyCount} replies
        </div>
      </div>
      <div className="leader-trailing">
        <div>{input.contributor.reactionCount} reactions</div>
        <div>
          {new Date(input.contributor.lastContributionAt).toLocaleDateString()}
        </div>
      </div>
    </article>
  )
}

export function TreemapSection(input: {
  hasSelectedGuild: boolean
  scopeLabel: string
  summary: TreemapSummary
}) {
  const layout = createTreemapLayout(input.summary)
  const emptyCopy = input.hasSelectedGuild
    ? "No captured messages in this slice yet."
    : "Capture Discord messages to see category composition."

  return (
    <>
      <div className="treemap-header">
        <h2 className="treemap-title">Category Composition</h2>
        <p className="treemap-subtitle">{input.scopeLabel}</p>
      </div>
      <div className="treemap-frame">
        {input.summary.totalMessages === 0 ? (
          <div className="treemap-empty">{emptyCopy}</div>
        ) : (
          <div
            className="treemap-chart"
            role="img"
            aria-label="Category composition treemap"
          >
            {layout.map(({ tile, rect }, index) => {
              const density = describeTreemapTileDensity(rect)
              const style = buildTreemapTileStyle(rect, tile.id, index)

              return (
                <article
                  key={tile.id}
                  className={`treemap-tile is-${density}`}
                  data-tile-id={tile.id}
                  style={style}
                >
                  <p className="treemap-tile-name">{tile.label}</p>
                  {density !== "tiny" ? (
                    <p className="treemap-tile-count">
                      {tile.messageCount} messages
                    </p>
                  ) : null}
                  {density === "large" ||
                  density === "medium" ||
                  tile.percentage >= 8 ? (
                    <p className="treemap-tile-share">
                      {formatPercentage(tile.percentage)} of slice
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
