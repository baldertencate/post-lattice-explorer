import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
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
import { useMemo, useState, type ReactNode } from 'react'
import latticeData from '../source material/posts-lattice.reactflow.json'
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
import './App.css'

type SelectionMode = 'upward' | 'downward'
type LatticeStatus =
  | 'default'
  | 'generator'
  | 'generated'
  | 'complement'
  | 'complementGenerator'

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

type TikzRouting = {
  out?: number
  in?: number
  looseness?: number
}

type Point = {
  x: number
  y: number
}

const nodeDiameter = 48
const nodeRadius = nodeDiameter / 2
const verticalLayoutScale = 1.5
const displayedGapNodeOffset = 23
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

function App() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('upward')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Post lattice explorer</h1>
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
            fitView
            minZoom={0.35}
            maxZoom={2}
            onInit={setFlow}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneClick={clearSelection}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => nodeColor(node.data?.status)}
              maskColor="rgba(248, 250, 252, 0.72)"
            />
          </ReactFlow>
        </div>

        <aside className="inspector" aria-label="Selection details">
          <div className="legend" aria-label="Node legend">
            <LegendItem swatch="generator" label="Selected generator" />
            <LegendItem
              swatch="generated"
              label={
                selectionMode === 'upward'
                  ? 'Generated upward set'
                  : 'Generated downward set'
              }
            />
            <LegendItem
              swatch="complement"
              label={
                selectionMode === 'upward'
                  ? 'Downward complement'
                  : 'Upward complement'
              }
            />
            <LegendItem
              swatch="complementGenerator"
              label={
                selectionMode === 'upward'
                  ? 'Maximal complement generator'
                  : 'Minimal complement generator'
              }
            />
          </div>

          <div className="selection-list">
            <h2>
              {selectionMode === 'upward'
                ? 'Upward generators'
                : 'Downward generators'}
            </h2>
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
    </main>
  )
}

function CloneInfoBox({
  node,
}: {
  node: (typeof latticeData.nodes)[number] | undefined
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
                          Wikipedia: <MathText text={wikipediaName.name.plain} />
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

    if (char === '{' || char === '}') {
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
    x: position.x,
    y: layoutTop + (position.y - layoutTop) * verticalLayoutScale,
  }
}

function layoutPosition(node: (typeof latticeData.nodes)[number]): Point {
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
    return tikzRoutedPath(source, target, tikzRouting)
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

  return (
    <span className="math-label" aria-label={latex}>
      <span>{label.base}</span>
      {label.subscript !== undefined && label.superscript !== undefined ? (
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
}: {
  swatch: LatticeStatus
  label: string
}) {
  return (
    <div className="legend-item">
      <span className={`legend-swatch ${swatch}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function nodeColor(status: unknown) {
  switch (status) {
    case 'generator':
      return '#0f766e'
    case 'generated':
      return '#2f80ed'
    case 'complement':
      return '#fde68a'
    case 'complementGenerator':
      return '#d97706'
    default:
      return '#ffffff'
  }
}

export default App
