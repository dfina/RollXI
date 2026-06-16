import json, sys, os
sys.path.insert(0,'_build')
from audit import nc, load_packs, DATA

WAVE='public/data/pack-pickable-c4.json'
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
    # remove from ALL tier-O opponent packs
    added={(nc(s['club']),s['season']) for s in squads}
    import glob as _glob
    for opp_path in _glob.glob(os.path.join(DATA,'pack-opponents-*.json')):
        op=json.load(open(opp_path))
        before_op=len(op['squads'])
        op['squads']=[r for r in op['squads'] if (nc(r['club']),r['season']) not in added]
        if len(op['squads'])!=before_op:
            json.dump(op,open(opp_path,'w'),ensure_ascii=False,indent=1)
            print(f"  removed {before_op-len(op['squads'])} from {os.path.basename(opp_path)}")
    # legacy print kept for EC/UCL (now handled above)
    ec=json.load(open(EC)); print(f"ec-ucl tier-O: {len(ec['squads'])} (after cleanup)")

def P(n,p,r,nat,dp): return {"n":n,"p":p,"r":r,"nat":nat,"dp":dp}
