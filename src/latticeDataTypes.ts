export type Point = {
  x: number
  y: number
}

export type CloneBasis = {
  plain: string
}

export type CloneDefinition = {
  plain: string
}

export type LatticeJsonNode = {
  id: string
  position: Point
  data: {
    label: string
    labelLatex: string
    description: string
    definition: CloneDefinition
    bases: CloneBasis[]
    group: string | null
    properties: string[]
  }
}

export type TikzRouting = {
  out?: number
  in?: number
  looseness?: number
}

export type LatticeJsonEdge = {
  id: string
  source: string
  target: string
  data: {
    semanticKind: string
    tikzRouting: TikzRouting | null
  }
}

export type LatticeJsonData = {
  nodes: LatticeJsonNode[]
  edges: LatticeJsonEdge[]
}
