import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import rawLatticeData from './data/posts-lattice.reactflow.json'
import {
  downwardClosure,
  maximalElementsOutsideClosure,
  minimalElementsOutsideClosure,
  upwardClosure,
  type DirectedEdge,
} from './lattice'
import {
  wikipediaCloneNamesById,
  type WikipediaCloneName,
} from './wikipediaCloneNames'
import {
  type LatticeJsonData,
  type LatticeJsonNode,
  type Point,
  type TikzRouting,
} from './latticeDataTypes'
import './App.css'

type SelectionMode = 'upward' | 'downward'
type LatticeStatus =
  | 'default'
  | 'generator'
  | 'generated'
  | 'complement'
  | 'complementGenerator'
type EditableLatticeStatus = Exclude<LatticeStatus, 'default'>

type StatusColorTheme = {
  background: string
  border: string
  text: string
  ring: string
  shadow: string
}

type FlowViewport = {
  x: number
  y: number
  zoom: number
}

type ShareState = {
  title?: string
  selectedIds?: string[]
  selectionMode?: SelectionMode
  viewport?: FlowViewport
  colors?: Partial<Record<EditableLatticeStatus, string>>
}

type LatticeNodeData = {
  label: string
  labelLatex: string
  description: string
  definition: { plain: string }
  bases: { plain: string }[]
  group: string | null
  status: LatticeStatus
}

type LatticeEdgeData = {
  sourceId: string
  targetId: string
  sourceCenter: Point
  targetCenter: Point
  semanticKind: string
  tikzRouting?: TikzRouting
}

const latticeData = rawLatticeData as LatticeJsonData

const nodeDiameter = 48
const nodeRadius = nodeDiameter / 2
const horizontalLayoutScale = 1.2
const verticalLayoutScale = 1.5
const displayedGapNodeOffset = 23
const layoutLeft = Math.min(...latticeData.nodes.map((node) => node.position.x))
const layoutRight = Math.max(...latticeData.nodes.map((node) => node.position.x))
const layoutCenterX = (layoutLeft + layoutRight) / 2
const layoutTop = Math.min(...latticeData.nodes.map((node) => node.position.y))
const graphEdges = latticeData.edges satisfies readonly DirectedEdge[]
const graphNodeIds = latticeData.nodes.map((node) => node.id)
const latticeNodeById = new Map(latticeData.nodes.map((node) => [node.id, node]))
const wikipediaNames: Record<string, WikipediaCloneName> = wikipediaCloneNamesById
const displayedGapLowerNodeIds = new Set(
  latticeData.edges
    .filter(
      (edge) =>
        edge.data.semanticKind === 'displayed-gap' && !edge.source.startsWith('Sn'),
    )
    .map((edge) => edge.source),
)
const displayedGapUpperNodeIds = new Set(
  latticeData.edges
    .filter(
      (edge) =>
        edge.data.semanticKind === 'displayed-gap' && edge.source.startsWith('Sn'),
    )
    .map((edge) => edge.target),
)
const nodeCenterById = new Map(
  latticeData.nodes.map((node) => [
    node.id,
    {
      x: layoutPosition(node).x + nodeDiameter / 2,
      y: layoutPosition(node).y + nodeDiameter / 2,
    },
  ]),
)

const nodeTypes = {
  latticeNode: LatticeNode,
}

const edgeTypes = {
  latticeEdge: LatticeEdge,
}

const initialStatusColorThemes: Record<EditableLatticeStatus, StatusColorTheme> = {
  generator: {
    background: '#ccfbf1',
    border: '#0f766e',
    text: '#0f3f3a',
    ring: 'rgba(20, 184, 166, 0.24)',
    shadow: 'rgba(15, 118, 110, 0.22)',
  },
  generated: {
    background: '#dbeafe',
    border: '#2f80ed',
    text: '#123d76',
    ring: 'rgba(47, 128, 237, 0.22)',
    shadow: 'rgba(47, 128, 237, 0.16)',
  },
  complement: {
    background: '#fef3c7',
    border: '#f59e0b',
    text: '#78350f',
    ring: 'rgba(245, 158, 11, 0.2)',
    shadow: 'rgba(245, 158, 11, 0.14)',
  },
  complementGenerator: {
    background: '#fed7aa',
    border: '#ea580c',
    text: '#7c2d12',
    ring: 'rgba(249, 115, 22, 0.28)',
    shadow: 'rgba(234, 88, 12, 0.2)',
  },
}

const initialShareState = readShareStateFromUrl()
const defaultPageTitle = 'Post lattice explorer'

function App() {
  const [pageTitle, setPageTitle] = useState(
    initialShareState?.title ?? defaultPageTitle,
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialShareState?.selectedIds ?? []),
  )
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(
    initialShareState?.selectionMode ?? 'upward',
  )
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)
  const [viewport, setViewport] = useState<FlowViewport>(
    initialShareState?.viewport ?? { x: 0, y: 0, zoom: 1 },
  )
  const [statusColorThemes, setStatusColorThemes] = useState<
    Record<EditableLatticeStatus, StatusColorTheme>
  >(() =>
    applySharedColors(initialStatusColorThemes, initialShareState?.colors),
  )
  const [activeDialog, setActiveDialog] = useState<'share' | 'about' | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const generatedSet = useMemo(
    () =>
      selectionMode === 'upward'
        ? upwardClosure(selectedIds, graphEdges)
        : downwardClosure(selectedIds, graphEdges),
    [selectedIds, selectionMode],
  )

  const complement = useMemo(
    () =>
      selectedIds.size === 0
        ? new Set<string>()
        : new Set(graphNodeIds.filter((id) => !generatedSet.has(id))),
    [generatedSet, selectedIds.size],
  )

  const complementGenerators = useMemo(
    () =>
      selectedIds.size === 0
        ? new Set<string>()
        : selectionMode === 'upward'
          ? maximalElementsOutsideClosure(graphNodeIds, graphEdges, generatedSet)
          : minimalElementsOutsideClosure(graphNodeIds, graphEdges, generatedSet),
    [generatedSet, selectedIds.size, selectionMode],
  )

  const selectedNodes = useMemo(
    () =>
      latticeData.nodes.filter((node) => selectedIds.has(node.id)).map((node) => ({
        id: node.id,
        labelLatex: node.data.labelLatex,
        description: node.data.description,
      })),
    [selectedIds],
  )
  const hoveredNode = hoveredId === null ? undefined : latticeNodeById.get(hoveredId)
  const shareUrl = useMemo(
    () =>
      createShareUrl({
        title: pageTitle,
        selectedIds: [...selectedIds],
        selectionMode,
        viewport: flow?.getViewport() ?? viewport,
        colors: statusColorThemeBackgrounds(statusColorThemes),
      }),
    [flow, pageTitle, selectedIds, selectionMode, statusColorThemes, viewport],
  )

  useEffect(() => {
    document.title = pageTitle.trim() === '' ? defaultPageTitle : pageTitle
  }, [pageTitle])

  const nodes = useMemo<Node<LatticeNodeData>[]>(
    () =>
      latticeData.nodes.map((node) => {
        const status = selectedIds.has(node.id)
          ? 'generator'
          : generatedSet.has(node.id)
            ? 'generated'
            : complementGenerators.has(node.id)
              ? 'complementGenerator'
              : complement.has(node.id)
                ? 'complement'
              : 'default'

        return {
          id: node.id,
          type: 'latticeNode',
          position: layoutPosition(node),
          draggable: false,
          selectable: true,
          selected: selectedIds.has(node.id),
          data: {
            label: node.data.label,
            labelLatex: node.data.labelLatex,
            description: node.data.description,
            definition: node.data.definition,
            bases: node.data.bases,
            group: node.data.group,
            status,
          },
        }
      }),
    [complement, complementGenerators, generatedSet, selectedIds],
  )

  const edges = useMemo<Edge<LatticeEdgeData>[]>(
    () =>
      latticeData.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'latticeEdge',
        selectable: false,
        focusable: false,
        data: {
          sourceId: edge.source,
          targetId: edge.target,
          sourceCenter: nodeCenterById.get(edge.source) ?? { x: 0, y: 0 },
          targetCenter: nodeCenterById.get(edge.target) ?? { x: 0, y: 0 },
          semanticKind: edge.data.semanticKind,
          tikzRouting: edge.data.tikzRouting ?? undefined,
        },
        style: {
          stroke: edge.data.semanticKind === 'displayed-gap' ? '#9aa4b2' : '#697386',
          strokeDasharray: edge.data.semanticKind === 'displayed-gap' ? '6 4' : undefined,
          strokeWidth: 1.25,
        },
      })),
    [],
  )

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(node.id)) {
        next.delete(node.id)
      } else {
        next.add(node.id)
      }

      return next
    })
  }

  const onNodeMouseEnter: NodeMouseHandler = (_event, node) => {
    setHoveredId(node.id)
  }

  const onNodeMouseLeave: NodeMouseHandler = () => {
    setHoveredId(null)
  }

  const clearSelection = () => setSelectedIds(new Set())

  const resetView = () => {
    clearSelection()
    void flow?.fitView({ padding: 0.12, duration: 300 })
  }

  const openShareDialog = () => {
    setViewport(flow?.getViewport() ?? viewport)
    setCopyStatus('idle')
    setActiveDialog('share')
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const updateStatusColor = (status: EditableLatticeStatus, color: string) => {
    setStatusColorThemes((current) => ({
      ...current,
      [status]: createStatusColorTheme(color),
    }))
  }

  return (
    <main className="app-shell" style={statusColorThemeStyle(statusColorThemes)}>
      <header className="topbar">
        <div>
          <input
            className="title-input"
            value={pageTitle}
            aria-label="Page title"
            onChange={(event) => setPageTitle(event.target.value)}
          />
        </div>
        <div className="actions" aria-label="Explorer controls">
          <div className="mode-toggle" aria-label="Selection mode">
            <button
              type="button"
              className={selectionMode === 'upward' ? 'active' : undefined}
              aria-pressed={selectionMode === 'upward'}
              onClick={() => setSelectionMode('upward')}
            >
              Upward
            </button>
            <button
              type="button"
              className={selectionMode === 'downward' ? 'active' : undefined}
              aria-pressed={selectionMode === 'downward'}
              onClick={() => setSelectionMode('downward')}
            >
              Downward
            </button>
          </div>
          <button type="button" onClick={resetView}>
            Reset
          </button>
          <button type="button" onClick={openShareDialog}>
            Share
          </button>
          <button type="button" onClick={() => setActiveDialog('about')}>
            About
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Interactive Hasse diagram">
        <div className="diagram">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            fitView={initialShareState?.viewport === undefined}
            defaultViewport={initialShareState?.viewport}
            minZoom={0.35}
            maxZoom={2}
            onInit={setFlow}
            onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="inspector" aria-label="Selection details">
          <div className="legend" aria-label="Node legend">
            <LegendItem
              swatch="generator"
              label="Selected clones"
              color={statusColorThemes.generator.background}
              onColorChange={updateStatusColor}
            />
            <LegendItem
              swatch="generated"
              color={statusColorThemes.generated.background}
              onColorChange={updateStatusColor}
              label={
                selectionMode === 'upward'
                  ? 'Generated upward set'
                  : 'Generated downward set'
              }
            />
            <LegendItem
              swatch="complement"
              color={statusColorThemes.complement.background}
              onColorChange={updateStatusColor}
              label={
                selectionMode === 'upward'
                  ? 'Downward closed complement'
                  : 'Upward closed complement'
              }
            />
            <LegendItem
              swatch="complementGenerator"
              color={statusColorThemes.complementGenerator.background}
              onColorChange={updateStatusColor}
              label={
                selectionMode === 'upward'
                  ? 'Maximal elements of the downward closed complement'
                  : 'Minimal elements of the upward closed complement'
              }
            />
          </div>

          <div className="selection-list">
            <h2>Selected clones</h2>
            {selectedNodes.length > 0 ? (
              <ul>
                {selectedNodes.map((node) => (
                  <li key={node.id}>
                    <strong>
                      <LatexLabel latex={node.labelLatex} />
                    </strong>
                    <span>{node.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select one or more nodes in the diagram.</p>
            )}
          </div>

          <CloneInfoBox node={hoveredNode} />
        </aside>
      </section>

      {activeDialog === 'share' && (
        <OverlayDialog title="Share" onClose={() => setActiveDialog(null)}>
          <div className="share-panel">
            <input readOnly value={shareUrl} aria-label="Share URL" />
            <button type="button" onClick={copyShareUrl}>
              Copy
            </button>
          </div>
          {copyStatus === 'copied' && <p className="dialog-note">Copied.</p>}
          {copyStatus === 'failed' && (
            <p className="dialog-note">Copy failed. The URL can be selected manually.</p>
          )}
        </OverlayDialog>
      )}

      {activeDialog === 'about' && (
        <OverlayDialog title="About" onClose={() => setActiveDialog(null)}>
          <p>
            Vibe coded by Balder ten Cate, based on original LaTeX code by Arne
            Meier
          </p>
        </OverlayDialog>
      )}
    </main>
  )
}

function CloneInfoBox({
  node,
}: {
  node: LatticeJsonNode | undefined
}) {
  if (node === undefined) {
    return null
  }

  const wikipediaName = wikipediaNames[node.id]
  const basis = node.data.bases[0]

  return (
    <section className="clone-info" aria-label="Clone information">
      <dl>
        <div>
          <dt>Names</dt>
          <dd>
            <NameList
              names={[
                { key: 'latex', content: <LatexLabel latex={node.data.labelLatex} /> },
                wikipediaName === undefined
                  ? undefined
                  : {
                      key: 'wikipedia',
                      content: (
                        <>
                          Also known as: <MathText text={wikipediaName.name.plain} />
                        </>
                      ),
                    },
              ]}
            />
          </dd>
        </div>
        {node.data.group !== null && (
          <div>
            <dt>Family</dt>
            <dd>{node.data.group}</dd>
          </div>
        )}
        <div>
          <dt>Description</dt>
          <dd>{node.data.description}</dd>
        </div>
        <div>
          <dt>Definition</dt>
          <dd>
            <MathText text={node.data.definition.plain} />
          </dd>
        </div>
        <div>
          <dt>Generating basis</dt>
          <dd>
            {basis === undefined ? (
              'No finite basis recorded.'
            ) : (
              <MathText text={basis.plain} />
            )}
          </dd>
        </div>
        {node.data.properties.length > 0 && (
          <div>
            <dt>Properties</dt>
            <dd>{node.data.properties.join(', ')}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

function OverlayDialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="dialog-title">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  )
}

function NameList({
  names,
}: {
  names: Array<{ key: string; content: ReactNode } | undefined>
}) {
  return (
    <ul className="name-list">
      {names.filter(isPresent).map((name) => (
        <li key={name.key}>{name.content}</li>
      ))}
    </ul>
  )
}

function MathText({ text }: { text: string }) {
  return <span className="math-text">{renderMathText(text)}</span>
}

function renderMathText(text: string) {
  const normalized = normalizeMathText(text)
  const parts: ReactNode[] = []

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]

    if (char === '_' || char === '^') {
      const parsed = readScript(normalized, index + 1)
      const nextChar = normalized[parsed.nextIndex]

      if ((char === '_' && nextChar === '^') || (char === '^' && nextChar === '_')) {
        const secondParsed = readScript(normalized, parsed.nextIndex + 1)
        const subscript = char === '_' ? parsed.value : secondParsed.value
        const superscript = char === '^' ? parsed.value : secondParsed.value

        parts.push(
          <span className="script-stack" key={`${char}-${index}`}>
            <sub>{subscript}</sub>
            <sup>{superscript}</sup>
          </span>,
        )
        index = secondParsed.nextIndex - 1
        continue
      }

      const ScriptTag = char === '_' ? 'sub' : 'sup'
      parts.push(<ScriptTag key={`${char}-${index}`}>{parsed.value}</ScriptTag>)
      index = parsed.nextIndex - 1
      continue
    }

    if (char === '↛') {
      parts.push(<NotImplication key={`not-implies-${index}`} />)
      continue
    }

    parts.push(char)
  }

  return parts
}

function NotImplication() {
  return (
    <span className="not-implies" aria-label="does not imply">
      →
    </span>
  )
}

function normalizeMathText(text: string) {
  return text
    .replaceAll('\\mathsf', '')
    .replaceAll('\\operatorname{aimp}(x,y,z)', 'x∧(y→z)')
    .replaceAll('\\aimp(x,y,z)', 'x∧(y→z)')
    .replaceAll('aimp(x,y,z)', 'x∧(y→z)')
    .replaceAll('\\top', '⊤')
    .replaceAll('\\bot', '⊥')
    .replaceAll('\\Lambda', 'Λ')
    .replaceAll('\\infty', '∞')
    .replaceAll('\\varnothing', '∅')
    .replaceAll('\\land', '∧')
    .replaceAll('\\lor', '∨')
    .replaceAll('\\neg', '¬')
    .replaceAll('\\oplus', '⊕')
    .replaceAll('\\leftrightarrow', '↔')
    .replaceAll('\\rightarrow', '→')
    .replaceAll('\\nrightarrow', '↛')
}

function readScript(text: string, startIndex: number) {
  if (text[startIndex] === '(') {
    return readDelimitedScript(text, startIndex, '(', ')')
  }

  if (text[startIndex] !== '{') {
    return {
      value: text[startIndex] ?? '',
      nextIndex: startIndex + 1,
    }
  }

  return readDelimitedScript(text, startIndex, '{', '}')
}

function readDelimitedScript(
  text: string,
  startIndex: number,
  openDelimiter: string,
  closeDelimiter: string,
) {
  let depth = 0
  let value = ''

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]

    if (char === openDelimiter) {
      if (depth > 0) {
        value += char
      }
      depth += 1
      continue
    }

    if (char === closeDelimiter) {
      depth -= 1
      if (depth === 0) {
        return { value, nextIndex: index + 1 }
      }
    }

    value += char
  }

  return { value, nextIndex: text.length }
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined
}

function stretchedPosition(position: Point): Point {
  return {
    x: layoutCenterX + (position.x - layoutCenterX) * horizontalLayoutScale,
    y: layoutTop + (position.y - layoutTop) * verticalLayoutScale,
  }
}

function layoutPosition(node: LatticeJsonNode): Point {
  const position = stretchedPosition(node.position)

  return {
    x: position.x,
    y: position.y + displayedGapYOffset(node.id),
  }
}

function displayedGapYOffset(nodeId: string) {
  if (displayedGapLowerNodeIds.has(nodeId)) {
    return displayedGapNodeOffset
  }

  if (displayedGapUpperNodeIds.has(nodeId)) {
    return -displayedGapNodeOffset
  }

  return 0
}

function LatticeEdge({ data, id, style }: EdgeProps<Edge<LatticeEdgeData>>) {
  const sourceCenter = data?.sourceCenter ?? { x: 0, y: 0 }
  const targetCenter = data?.targetCenter ?? { x: 0, y: 0 }
  const path = getCircleEdgePath({
    sourceCenter,
    sourceId: data?.sourceId ?? '',
    targetCenter,
    targetId: data?.targetId ?? '',
    tikzRouting: data?.tikzRouting,
  })

  return <BaseEdge id={id} path={path} style={style} />
}

function LatticeNode({ data, selected }: NodeProps<Node<LatticeNodeData>>) {
  return (
    <div className={`lattice-node ${data.status}`} aria-selected={selected}>
      <Handle type="target" position={Position.Bottom} className="node-handle" />
      <span className="node-label">
        <LatexLabel latex={data.labelLatex} />
      </span>
      <Handle type="source" position={Position.Top} className="node-handle" />
    </div>
  )
}

function getCircleEdgePath({
  sourceCenter,
  sourceId,
  targetCenter,
  targetId,
  tikzRouting,
}: {
  sourceCenter: Point
  sourceId: string
  targetCenter: Point
  targetId: string
  tikzRouting?: TikzRouting
}) {
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  const length = Math.hypot(dx, dy)

  if (length === 0) {
    return `M ${sourceCenter.x} ${sourceCenter.y}`
  }

  const unitX = dx / length
  const unitY = dy / length
  const source = {
    x: sourceCenter.x + unitX * nodeRadius,
    y: sourceCenter.y + unitY * nodeRadius,
  }
  const target = {
    x: targetCenter.x - unitX * nodeRadius,
    y: targetCenter.y - unitY * nodeRadius,
  }

  if (
    Math.abs(dx) < 1 &&
    shouldCurveVerticalEdge(sourceId, targetId) &&
    tikzRouting?.out !== undefined &&
    tikzRouting.in !== undefined
  ) {
    const curvedSource = pointOnCircleAtTikzAngle(sourceCenter, tikzRouting.out)
    const curvedTarget = pointOnCircleAtTikzAngle(targetCenter, tikzRouting.in + 180)

    return tikzRoutedPath(curvedSource, curvedTarget, tikzRouting)
  }

  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
}

function tikzRoutedPath(source: Point, target: Point, routing: TikzRouting) {
  const distance = Math.hypot(target.x - source.x, target.y - source.y)
  const controlDistance = distance * 0.36 * (routing.looseness ?? 1)
  const sourceControl = offsetByTikzAngle(source, routing.out ?? 90, controlDistance)
  const targetControl = offsetByTikzAngle(target, routing.in ?? 270, controlDistance)

  return `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y} ${targetControl.x} ${targetControl.y} ${target.x} ${target.y}`
}

function offsetByTikzAngle(point: Point, degrees: number, distance: number) {
  const radians = (degrees * Math.PI) / 180

  return {
    x: point.x + Math.cos(radians) * distance,
    y: point.y - Math.sin(radians) * distance,
  }
}

function pointOnCircleAtTikzAngle(center: Point, degrees: number) {
  return offsetByTikzAngle(center, degrees, nodeRadius)
}

function shouldCurveVerticalEdge(sourceId: string, targetId: string) {
  return !(
    isSamePrefixedCluster(sourceId, targetId, 'S') ||
    isSamePrefixedCluster(sourceId, targetId, 'D') ||
    isSamePrefixedCluster(sourceId, targetId, 'L')
  )
}

function isSamePrefixedCluster(sourceId: string, targetId: string, prefix: string) {
  return sourceId.startsWith(prefix) && targetId.startsWith(prefix)
}

function LatexLabel({ latex }: { latex: string }) {
  const label = parseMathsfLabel(latex)
  const hasStackedScripts =
    label.subscript !== undefined && label.superscript !== undefined

  return (
    <span
      className={`math-label${hasStackedScripts ? ' has-stacked-scripts' : ''}`}
      aria-label={latex}
    >
      <span>{label.base}</span>
      {hasStackedScripts ? (
        <span className="script-stack">
          <sub>{label.subscript}</sub>
          <sup>{label.superscript}</sup>
        </span>
      ) : (
        <>
          {label.subscript !== undefined && <sub>{label.subscript}</sub>}
          {label.superscript !== undefined && <sup>{label.superscript}</sup>}
        </>
      )}
    </span>
  )
}

function parseMathsfLabel(latex: string) {
  const normalized = latex.replaceAll('\\mathsf', '')
  const text = unwrapSingleGroup(normalized)
  const parsedBase =
    text[0] === '{' ? readScript(text, 0) : readBareBase(text)

  if (parsedBase.value === '') {
    return { base: normalized.replace(/[{}]/g, '') }
  }

  let index = parsedBase.nextIndex
  const label: {
    base: string
    subscript?: string
    superscript?: string
  } = { base: parsedBase.value }

  while (index < text.length) {
    const char = text[index]

    if (char === '_' || char === '^') {
      const parsed = readScript(text, index + 1)
      if (char === '_') {
        label.subscript = parsed.value
      } else {
        label.superscript = parsed.value
      }
      index = parsed.nextIndex
      continue
    }

    if (char === '{' || char === '}') {
      index += 1
      continue
    }

    return { base: normalized.replace(/[{}]/g, '') }
  }

  return label
}

function readBareBase(text: string) {
  const baseMatch = text.match(/^[A-Z]+/)

  return {
    value: baseMatch?.[0] ?? '',
    nextIndex: baseMatch?.[0].length ?? 0,
  }
}

function unwrapSingleGroup(text: string) {
  const trimmed = text.trim()

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return trimmed
  }

  const parsed = readScript(trimmed, 0)
  return parsed.nextIndex === trimmed.length ? parsed.value : trimmed
}

function LegendItem({
  swatch,
  label,
  color,
  onColorChange,
}: {
  swatch: EditableLatticeStatus
  label: string
  color: string
  onColorChange: (status: EditableLatticeStatus, color: string) => void
}) {
  return (
    <div className="legend-item">
      <label className="legend-color-picker">
        <span className={`legend-swatch ${swatch}`} aria-hidden="true" />
        <span className="sr-only">Choose color for {label}</span>
        <input
          type="color"
          value={color}
          onChange={(event) => onColorChange(swatch, event.target.value)}
        />
      </label>
      <span>{label}</span>
    </div>
  )
}

function statusColorThemeStyle(
  themes: Record<EditableLatticeStatus, StatusColorTheme>,
) {
  const style: CSSProperties & Record<string, string> = {}

  for (const [status, theme] of Object.entries(themes) as Array<
    [EditableLatticeStatus, StatusColorTheme]
  >) {
    const key = statusCssKey(status)

    style[`--${key}-bg`] = theme.background
    style[`--${key}-border`] = theme.border
    style[`--${key}-text`] = theme.text
    style[`--${key}-ring`] = theme.ring
    style[`--${key}-shadow`] = theme.shadow
  }

  return style
}

function statusColorThemeBackgrounds(
  themes: Record<EditableLatticeStatus, StatusColorTheme>,
) {
  return Object.fromEntries(
    (Object.entries(themes) as Array<[EditableLatticeStatus, StatusColorTheme]>).map(
      ([status, theme]) => [status, theme.background],
    ),
  ) as Record<EditableLatticeStatus, string>
}

function applySharedColors(
  defaults: Record<EditableLatticeStatus, StatusColorTheme>,
  colors: ShareState['colors'],
) {
  if (colors === undefined) {
    return defaults
  }

  return {
    generator:
      colors.generator === undefined
        ? defaults.generator
        : createStatusColorTheme(colors.generator),
    generated:
      colors.generated === undefined
        ? defaults.generated
        : createStatusColorTheme(colors.generated),
    complement:
      colors.complement === undefined
        ? defaults.complement
        : createStatusColorTheme(colors.complement),
    complementGenerator:
      colors.complementGenerator === undefined
        ? defaults.complementGenerator
        : createStatusColorTheme(colors.complementGenerator),
  }
}

function createShareUrl(state: Required<ShareState>) {
  const url = new URL(window.location.href)

  url.searchParams.set('state', encodeShareState(state))
  return url.toString()
}

function readShareStateFromUrl(): ShareState | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const encoded = new URL(window.location.href).searchParams.get('state')
  if (encoded === null) {
    return undefined
  }

  try {
    return normalizeShareState(JSON.parse(decodeShareState(encoded)))
  } catch {
    return undefined
  }
}

function normalizeShareState(value: unknown): ShareState | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const title =
    typeof record.title === 'string' && record.title.trim() !== ''
      ? record.title
      : undefined
  const selectedIds = Array.isArray(record.selectedIds)
    ? record.selectedIds.filter(
        (id): id is string => typeof id === 'string' && graphNodeIds.includes(id),
      )
    : undefined
  const selectionMode =
    record.selectionMode === 'downward' || record.selectionMode === 'upward'
      ? record.selectionMode
      : undefined
  const viewport = normalizeViewport(record.viewport)
  const colors = normalizeSharedColors(record.colors)

  return { title, selectedIds, selectionMode, viewport, colors }
}

function normalizeViewport(value: unknown): FlowViewport | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.x !== 'number' ||
    typeof record.y !== 'number' ||
    typeof record.zoom !== 'number'
  ) {
    return undefined
  }

  return {
    x: record.x,
    y: record.y,
    zoom: Math.min(2, Math.max(0.35, record.zoom)),
  }
}

function normalizeSharedColors(value: unknown): ShareState['colors'] {
  if (value === null || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const colors: Partial<Record<EditableLatticeStatus, string>> = {}

  for (const status of [
    'generator',
    'generated',
    'complement',
    'complementGenerator',
  ] as const) {
    const color = record[status]
    if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) {
      colors[status] = color
    }
  }

  return colors
}

function encodeShareState(state: Required<ShareState>) {
  const bytes = new TextEncoder().encode(JSON.stringify(state))
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return window
    .btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function decodeShareState(encoded: string) {
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function statusCssKey(status: EditableLatticeStatus) {
  return status === 'complementGenerator' ? 'complement-generator' : status
}

function createStatusColorTheme(background: string): StatusColorTheme {
  const rgb = hexToRgb(background)
  const border = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.38)
  const shadow = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.22)

  return {
    background,
    border: rgbToHex(border),
    text: readableTextColor(rgb),
    ring: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
    shadow: `rgba(${shadow.r}, ${shadow.g}, ${shadow.b}, 0.22)`,
  }
}

function hexToRgb(hex: string) {
  const trimmed = hex.replace('#', '')
  const normalized =
    trimmed.length === 3
      ? [...trimmed].map((char) => `${char}${char}`).join('')
      : trimmed
  const value = Number.parseInt(normalized, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function mixRgb(
  first: { r: number; g: number; b: number },
  second: { r: number; g: number; b: number },
  amount: number,
) {
  return {
    r: Math.round(first.r * (1 - amount) + second.r * amount),
    g: Math.round(first.g * (1 - amount) + second.g * amount),
    b: Math.round(first.b * (1 - amount) + second.b * amount),
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function readableTextColor({ r, g, b }: { r: number; g: number; b: number }) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

  return luminance > 0.54 ? '#172033' : '#ffffff'
}

export default App
