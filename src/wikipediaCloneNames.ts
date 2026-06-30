export type CloneName = {
  plain: string
  latex: string
}

export type WikipediaCloneName = {
  name: CloneName
  source: 'Wikipedia:Post_lattice'
}

export const wikipediaCloneNamesById = {
  BF: name('⊤', '\\top'),
  R0: name('P_0', 'P_{0}'),
  R1: name('P_1', 'P_{1}'),
  R2: name('P', 'P'),
  M: name('M', 'M'),
  M0: name('MP_0', 'MP_{0}'),
  M1: name('MP_1', 'MP_{1}'),
  M2: name('MP', 'MP'),
  S20: name('T_0^2', 'T_{0}^{2}'),
  S30: name('T_0^3', 'T_{0}^{3}'),
  Sn0: name('T_0^n', 'T_{0}^{n}'),
  S0: name('T_0^∞', 'T_{0}^{\\infty}'),
  S202: name('PT_0^2', 'PT_{0}^{2}'),
  S302: name('PT_0^3', 'PT_{0}^{3}'),
  Sn02: name('PT_0^n', 'PT_{0}^{n}'),
  S02: name('PT_0^∞', 'PT_{0}^{\\infty}'),
  S201: name('MT_0^2', 'MT_{0}^{2}'),
  S301: name('MT_0^3', 'MT_{0}^{3}'),
  Sn01: name('MT_0^n', 'MT_{0}^{n}'),
  S01: name('MT_0^∞', 'MT_{0}^{\\infty}'),
  S200: name('MPT_0^2', 'MPT_{0}^{2}'),
  S300: name('MPT_0^3', 'MPT_{0}^{3}'),
  Sn00: name('MPT_0^n', 'MPT_{0}^{n}'),
  S00: name('MPT_0^∞', 'MPT_{0}^{\\infty}'),
  S21: name('T_1^2', 'T_{1}^{2}'),
  S31: name('T_1^3', 'T_{1}^{3}'),
  Sn1: name('T_1^n', 'T_{1}^{n}'),
  S1: name('T_1^∞', 'T_{1}^{\\infty}'),
  S212: name('PT_1^2', 'PT_{1}^{2}'),
  S312: name('PT_1^3', 'PT_{1}^{3}'),
  Sn12: name('PT_1^n', 'PT_{1}^{n}'),
  S12: name('PT_1^∞', 'PT_{1}^{\\infty}'),
  S211: name('MT_1^2', 'MT_{1}^{2}'),
  S311: name('MT_1^3', 'MT_{1}^{3}'),
  Sn11: name('MT_1^n', 'MT_{1}^{n}'),
  S11: name('MT_1^∞', 'MT_{1}^{\\infty}'),
  S210: name('MPT_1^2', 'MPT_{1}^{2}'),
  S310: name('MPT_1^3', 'MPT_{1}^{3}'),
  Sn10: name('MPT_1^n', 'MPT_{1}^{n}'),
  S10: name('MPT_1^∞', 'MPT_{1}^{\\infty}'),
  E: name('Λ', '\\Lambda'),
  E0: name('ΛP_0', '\\Lambda P_{0}'),
  E1: name('ΛP_1', '\\Lambda P_{1}'),
  E2: name('ΛP', '\\Lambda P'),
  V: name('V', 'V'),
  V0: name('VP_0', 'VP_{0}'),
  V1: name('VP_1', 'VP_{1}'),
  V2: name('VP', 'VP'),
  D: name('D', 'D'),
  D1: name('DP', 'DP'),
  D2: name('DM', 'DM'),
  L: name('A', 'A'),
  L0: name('AP_0', 'AP_{0}'),
  L1: name('AP_1', 'AP_{1}'),
  L2: name('AP', 'AP'),
  L3: name('AD', 'AD'),
  N: name('U', 'U'),
  N2: name('UD', 'UD'),
  I: name('UM', 'UM'),
  I0: name('UP_0', 'UP_{0}'),
  I1: name('UP_1', 'UP_{1}'),
  I2: name('⊥', '\\bot'),
} as const satisfies Record<string, WikipediaCloneName>

function name(plain: string, latex: string): WikipediaCloneName {
  return {
    name: { plain, latex },
    source: 'Wikipedia:Post_lattice',
  }
}
