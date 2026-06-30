import { describe, expect, it } from 'vitest'
import latticeData from '../source material/posts-lattice.json'
import { wikipediaCloneNamesById } from './wikipediaCloneNames'

describe('wikipediaCloneNamesById', () => {
  it('records a Wikipedia clone name for every displayed lattice node', () => {
    const nodeIds = latticeData.nodes.map((node) => node.id).sort()
    const wikipediaIds = Object.keys(wikipediaCloneNamesById).sort()

    expect(wikipediaIds).toEqual(nodeIds)
  })

  it('stores both plain text and math notation for display later', () => {
    expect(wikipediaCloneNamesById.R0.name).toEqual({
      plain: 'P_0',
      latex: 'P_{0}',
    })
    expect(wikipediaCloneNamesById.S302.name).toEqual({
      plain: 'PT_0^3',
      latex: 'PT_{0}^{3}',
    })
    expect(wikipediaCloneNamesById.I2.name).toEqual({
      plain: '⊥',
      latex: '\\bot',
    })
  })
})
