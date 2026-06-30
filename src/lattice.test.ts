import { describe, expect, it } from 'vitest'
import latticeData from '../source material/posts-lattice.json'
import {
  downwardClosure,
  maximalElementsOutsideClosure,
  minimalElementsOutsideClosure,
  upwardClosure,
  type DirectedEdge,
} from './lattice'

const diamondEdges: DirectedEdge[] = [
  { source: 'bottom', target: 'left' },
  { source: 'bottom', target: 'right' },
  { source: 'left', target: 'top' },
  { source: 'right', target: 'top' },
]

describe('upwardClosure', () => {
  it('follows outgoing edges from every selected generator', () => {
    expect([...upwardClosure(['left'], diamondEdges)].sort()).toEqual([
      'left',
      'top',
    ])
  })

  it('unions the closures of multiple selected generators', () => {
    expect([...upwardClosure(['left', 'right'], diamondEdges)].sort()).toEqual([
      'left',
      'right',
      'top',
    ])
  })

  it('uses Post lattice edges as upward reachability', () => {
    const closure = upwardClosure(['R2'], latticeData.edges)

    expect(closure.has('R2')).toBe(true)
    expect(closure.has('R1')).toBe(true)
    expect(closure.has('R0')).toBe(true)
    expect(closure.has('BF')).toBe(true)
  })
})

describe('downwardClosure', () => {
  it('follows incoming edges from every selected generator', () => {
    expect([...downwardClosure(['left'], diamondEdges)].sort()).toEqual([
      'bottom',
      'left',
    ])
  })

  it('unions the downward closures of multiple selected generators', () => {
    expect([...downwardClosure(['left', 'right'], diamondEdges)].sort()).toEqual([
      'bottom',
      'left',
      'right',
    ])
  })

  it('uses Post lattice edges as downward reachability', () => {
    const closure = downwardClosure(['BF'], latticeData.edges)

    expect(closure.has('BF')).toBe(true)
    expect(closure.has('R2')).toBe(true)
    expect(closure.has('I2')).toBe(true)
  })
})

describe('maximalElementsOutsideClosure', () => {
  it('finds outside elements with no larger outside neighbour', () => {
    const closure = upwardClosure(['left'], diamondEdges)
    const maximal = maximalElementsOutsideClosure(
      ['bottom', 'left', 'right', 'top'],
      diamondEdges,
      closure,
    )

    expect([...maximal]).toEqual(['right'])
  })

  it('marks nothing when the closure is the whole lattice', () => {
    const closure = upwardClosure(['bottom'], diamondEdges)
    const maximal = maximalElementsOutsideClosure(
      ['bottom', 'left', 'right', 'top'],
      diamondEdges,
      closure,
    )

    expect(maximal.size).toBe(0)
  })
})

describe('minimalElementsOutsideClosure', () => {
  it('finds outside elements with no smaller outside neighbour', () => {
    const closure = downwardClosure(['left'], diamondEdges)
    const minimal = minimalElementsOutsideClosure(
      ['bottom', 'left', 'right', 'top'],
      diamondEdges,
      closure,
    )

    expect([...minimal]).toEqual(['right'])
  })

  it('marks nothing when the closure is the whole lattice', () => {
    const closure = downwardClosure(['top'], diamondEdges)
    const minimal = minimalElementsOutsideClosure(
      ['bottom', 'left', 'right', 'top'],
      diamondEdges,
      closure,
    )

    expect(minimal.size).toBe(0)
  })
})
