import json, sys, os
sys.path.insert(0,'_build')
from audit import nc, load_packs, DATA

WAVE='public/data/pack-pickable-wavefe.json'
EC='public/data/pack-opponents-ec-ucl.json'

def add(squads):
    """squads: list of full squad dicts. Appends to wavefc, removes matching tier-O rows from ec-ucl."""
    wave=json.load(open(WAVE))
    have={(nc(s['club']),s['season']) for s in wave['squads']}
    for sq in squads:
        k=(nc(sq['club']),sq['season'])
        if k in have:
            print("SKIP already in wavefc:",sq['club'],sq['season']); continue
        wave['squads'].append(sq); have.add(k)
        print("ADDED",sq['club'],sq['season'],"players=",len(sq['players']))
    json.dump(wave, open(WAVE,'w'), ensure_ascii=False, indent=1)
    # remove from tier-O ec-ucl
    ec=json.load(open(EC))
    added={(nc(s['club']),s['season']) for s in squads}
    before=len(ec['squads'])
    ec['squads']=[r for r in ec['squads'] if (nc(r['club']),r['season']) not in added]
    json.dump(ec, open(EC,'w'), ensure_ascii=False, indent=1)
    print(f"ec-ucl tier-O: {before} -> {len(ec['squads'])}")

def P(n,p,r,nat,dp): return {"n":n,"p":p,"r":r,"nat":nat,"dp":dp}
