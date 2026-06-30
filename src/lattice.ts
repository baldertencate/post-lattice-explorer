export type DirectedEdge = {
  source: string
  target: string
}

export function upwardClosure(
  selected: Iterable<string>,
  edges: readonly DirectedEdge[],
): Set<string> {
  const outgoing = buildOutgoing(edges)
  const result = new Set(selected)
  const stack = [...result]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) {
      continue
    }

    for (const target of outgoing.get(current) ?? []) {
      if (!result.has(target)) {
        result.add(target)
        stack.push(target)
      }
    }
  }

  return result
}

export function downwardClosure(
  selected: Iterable<string>,
  edges: readonly DirectedEdge[],
): Set<string> {
  const incoming = buildIncoming(edges)
  const result = new Set(selected)
  const stack = [...result]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) {
      continue
    }

    for (const source of incoming.get(current) ?? []) {
      if (!result.has(source)) {
        result.add(source)
        stack.push(source)
      }
    }
  }

  return result
}

export function maximalElementsOutsideClosure(
  nodeIds: Iterable<string>,
  edges: readonly DirectedEdge[],
  closure: ReadonlySet<string>,
): Set<string> {
  const outside = new Set([...nodeIds].filter((id) => !closure.has(id)))
  const outgoing = buildOutgoing(edges)
  const maximal = new Set<string>()

  for (const id of outside) {
    const hasLargerOutsideElement = (outgoing.get(id) ?? []).some((target) =>
      outside.has(target),
    )

    if (!hasLargerOutsideElement) {
      maximal.add(id)
    }
  }

  return maximal
}

export function minimalElementsOutsideClosure(
  nodeIds: Iterable<string>,
  edges: readonly DirectedEdge[],
  closure: ReadonlySet<string>,
): Set<string> {
  const outside = new Set([...nodeIds].filter((id) => !closure.has(id)))
  const incoming = buildIncoming(edges)
  const minimal = new Set<string>()

  for (const id of outside) {
    const hasSmallerOutsideElement = (incoming.get(id) ?? []).some((source) =>
      outside.has(source),
    )

    if (!hasSmallerOutsideElement) {
      minimal.add(id)
    }
  }

  return minimal
}

function buildOutgoing(edges: readonly DirectedEdge[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    const targets = outgoing.get(edge.source) ?? []
    targets.push(edge.target)
    outgoing.set(edge.source, targets)
  }

  return outgoing
}

function buildIncoming(edges: readonly DirectedEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>()

  for (const edge of edges) {
    const sources = incoming.get(edge.target) ?? []
    sources.push(edge.source)
    incoming.set(edge.target, sources)
  }

  return incoming
}
