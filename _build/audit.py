import json, glob, os, unicodedata, re

DATA='public/data'

def strip_acc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn')

ALIAS={
 'marseille':'olympique marseille','monaco':'as monaco','porto':'fc porto',
 'internazionale':'inter','fc internazionale':'inter','inter milan':'inter',
 'bayern munchen':'bayern munich','crvena zvezda':'red star belgrade',
 'steaua bucuresti':'steaua bucharest','as saint-etienne':'saint-etienne',
 'atletico madrid':'atletico madrid',
}
def nc(c):
    c=strip_acc(c).strip().lower()
    return ALIAS.get(c,c)

def load_packs():
    return {os.path.basename(f):json.load(open(f)) for f in glob.glob(DATA+'/*.json') if os.path.basename(f)!='index.json'}

def pools(packs=None):
    if packs is None: packs=load_packs()
    pick={}; opp={}
    for pn,pd in packs.items():
        for r in pd.get('squads',[]):
            k=(nc(r['club']),r['season'])
            if r.get('tierType')=='O': opp.setdefault(k,[]).append((pn,r))
            else: pick.setdefault(k,[]).append((pn,r))
    return pick,opp

if __name__=='__main__':
    packs=load_packs()
    pick,opp=pools(packs)
    nsq=sum(len(v) for v in pick.values())
    npl=sum(len(r['players']) for v in pick.values() for _,r in v if 'players' in r)
    nopp=sum(len(v) for v in opp.values())
    overlap=sorted(set(pick)&set(opp))
    dups=sorted([k for k,v in pick.items() if len(v)>1])
    print("pickable squads:",nsq,"| players:",npl,"| distinct pickable club-seasons:",len(pick))
    print("tier-O rows:",nopp,"| distinct tier-O club-seasons:",len(opp))
    print("O/P overlap:",len(overlap))
    for k in overlap: print("  ! overlap",k,[p for p,_ in pick[k]],[p for p,_ in opp[k]])
    print("P/P duplicates:",len(dups))
    for k in dups: print("  ! dup",k,[p for p,_ in pick[k]])
