# ATL-160 Most Improved award GIF: Nathan's approved v5 render (4 Oct 2026), driven by the award engine.
# Usage: python3 scripts/most_improved_gif.py spec.json out.gif
# spec = {"data": [[name, baseline, current], ...top 6 eligible], "weekEnding": "Sun 4 Oct 2026",
#         "window": "27 Sep - 4 Oct", "dpi": 80}
import sys, json
spec=json.load(open(sys.argv[1])); OUT=sys.argv[2]
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, numpy as np, matplotlib.colors
from matplotlib import patheffects as pe
from matplotlib.animation import FuncAnimation, PillowWriter
from matplotlib.patches import Polygon
plt.rcParams["text.parse_math"]=False
data=[(str(d[0]),float(d[1]),float(d[2])) for d in spec["data"]][:6]
cols=["#FFC422","#0DC1E8","#E013E0","#44EC1E","#FF2910","#9F00D0"]
bg="#07080c"; n=len(data); ends=[10-1.55*i for i in range(n)]
DPI=int(spec.get("dpi",80))
fig,ax=plt.subplots(figsize=(12,7.4),dpi=DPI);fig.patch.set_facecolor(bg);ax.set_facecolor(bg)
t=np.linspace(0,1,200); K=189
lines=[];arrows=[];labels=[]
for i in reversed(range(n)):
    nm,b,w=data[i]; pct=(w-b)/b*100; c=cols[i]; e=ends[i]; lw=3.4 if i==0 else 2.6
    y=e*t**2.2
    ln,=ax.plot([],[],color=c,lw=lw,solid_capstyle="round",zorder=10-i,path_effects=[pe.Stroke(linewidth=lw+7,foreground=c,alpha=.18),pe.Normal()])
    ar=ax.annotate("",xy=(1.0,e),xytext=(t[K],y[K]),arrowprops=dict(arrowstyle="-|>,head_length=0.9,head_width=0.45" if i==0 else "-|>,head_length=0.8,head_width=0.4",color=c,lw=lw,shrinkA=0,shrinkB=0,mutation_scale=20),zorder=20)
    ar.set_visible(False)
    tx=[ax.text(1.04,e+0.18,nm,color=c,va="center",fontsize=16 if i==0 else 13,fontweight="bold" if i==0 else "normal"),
        ax.text(1.04,e-0.42,f"+{pct:.1f}%",color=c,va="center",fontsize=15 if i==0 else 12,fontweight="bold")]
    if i==0:
        tx+= [ax.text(1.04,e+0.85,"WINNER",color="#FFC422",va="center",fontsize=11,fontweight="bold"),
              ax.text(1.20,e-0.42,f"${b:,.0f} -> ${w:,.0f} /day",color="#d9d9d9",va="center",fontsize=10.5)]
    for x in tx: x.set_alpha(0)
    lines.append((i,ln,y)); arrows.append(ar); labels.append(tx)
ax.scatter([0],[0],s=70,color="#ffffff",edgecolor=bg,lw=2,zorder=30)
ax.axhline(0,xmax=0.66,color="#2a2d36",lw=1)
plane=ax.text(0,0,"\u2708",color="#ffffff",fontsize=40,ha="center",va="center",zorder=40,family="DejaVu Sans",
              path_effects=[pe.Stroke(linewidth=2,foreground="#FFC422",alpha=.35),pe.Normal()])
BTXT="WINNER \u2022 "+data[0][0].upper()
bglow=Polygon([[0,0]],closed=True,fc="none",ec="#FFC422",lw=6,alpha=.14,zorder=36,clip_on=True)
bpoly=Polygon([[0,0]],closed=True,fc="#050505",ec="#FFC422",lw=1.8,zorder=37,clip_on=True)
shim=[Polygon([[0,0]],closed=True,fc="#FFD86B",ec="none",alpha=a_,zorder=37.6) for a_ in (.07,.13,.22)]
for sp_ in shim: ax.add_patch(sp_)
ax.add_patch(bglow);ax.add_patch(bpoly)
chars=[ax.text(0,0,ch,color="#FFC422",fontsize=13,fontweight="bold",family="DejaVu Sans Mono",ha="center",va="center",zorder=39,clip_on=True) for ch in BTXT]
rope1,=ax.plot([],[],color="#FFC422",lw=0.9,zorder=38,clip_on=True)
rope2,=ax.plot([],[],color="#FFC422",lw=0.9,zorder=38,clip_on=True)
trail,=ax.plot([],[],color="#ffffff",lw=2,alpha=.18,zorder=35,clip_on=True,solid_capstyle="round")
for a_ in (plane,): a_.set_clip_on(True)
rng=np.random.default_rng(7); NS=60
sp_ang=rng.uniform(0,2*np.pi,NS); sp_spd=rng.uniform(0.4,1.0,NS); sp_col=rng.choice(["#FFC422","#FFFFFF","#0DC1E8","#E013E0","#44EC1E"],NS)
spark=ax.scatter([0],[0],s=[1],color="#FFC422",marker="*",linewidths=0,zorder=45,clip_on=False)
ax.set_xlim(-0.05,1.55); ax.set_ylim(-0.6,11.2)
ax.set_xticks([0,1]); ax.set_xticklabels(["Their own normal\n(previous 28 days)","This week\n("+spec["window"]+")"],color="#c8c8c8",fontsize=12)
ax.set_yticks([]); [s.set_visible(False) for s in ax.spines.values()]; ax.tick_params(length=0)
fig.text(.05,.94,"BEAGLE MOST IMPROVED",color="#fff",fontsize=24,fontweight="bold")
fig.text(.05,.895,"Week ending "+spec["weekEnding"]+"  ·  raw contribution/day vs each player's own 28-day normal",color="#9aa0aa",fontsize=12)
fig.text(.05,.025,"Everyone starts from their own normal. To qualify: a 28-day average of at least $25,000/day. Top 10 of the raw ranking not eligible.",color="#6d717b",fontsize=10)
plt.subplots_adjust(left=.05,right=.98,top=.86,bottom=.11)
EW=ends[0]
FR=70; HOLD=45; PL=0.028
BW=0.40*max(1.0,len(BTXT)/len("WINNER \u2022 AIR SORCHY")); BH=0.95; AMP=0.035
(x0,y0),(x1,y1)=ax.transData.transform((0,0)),ax.transData.transform((1,1)); XR=(x1-x0)/(y1-y0)
def draw(f):
    p=min(f/FR,1.0); k=int(p*K)
    for (i,ln,y) in lines: ln.set_data(t[:k+1],y[:k+1])
    done=f>=FR
    for ar in arrows: ar.set_visible(done)
    for tx in labels:
        for x in tx: x.set_alpha(1 if done else 0)
    nose = t[k]/t[K] if not done else 1.0
    px=nose-PL
    plane.set_position((px,EW)); plane.set_rotation(0); plane.set_alpha(1)
    ph=f*0.55
    bf=px-0.07; bb=bf-BW
    xs=np.linspace(bb,bf,40)
    amp=AMP*(0.35+0.65*(bf-xs)/BW)
    wav=lambda xx,a_: a_*np.sin((xx-bb)/BW*2.4*np.pi - ph)
    top=EW+BH/2+wav(xs,amp); bot=EW-BH/2+wav(xs,amp)
    pts=np.column_stack([np.r_[xs,xs[::-1]],np.r_[top,bot[::-1]]])
    bpoly.set_xy(pts); bglow.set_xy(pts)
    per=38; sc=bb-0.08+((f%per)/per)*(BW+0.16)
    for w_,sp_ in zip((0.06,0.035,0.015),shim):
        sl=0.025
        sp_.set_xy([[sc-w_-sl,EW-BH],[sc+w_-sl,EW-BH],[sc+w_+sl,EW+BH],[sc-w_+sl,EW+BH]])
        sp_.set_clip_path(bpoly)
    n_=len(chars); cx=np.linspace(bb+0.025,bf-0.025,n_)
    for j,c_ in enumerate(chars):
        a_=AMP*(0.35+0.65*(bf-cx[j])/BW)
        yy=EW+wav(cx[j],a_)
        d=(wav(cx[j]+0.003,a_)-wav(cx[j]-0.003,a_))/0.006
        c_.set_position((cx[j],yy)); c_.set_rotation(np.degrees(np.arctan(d/XR)))
        k_=max(0,1-abs(cx[j]-sc)/0.05)
        c_.set_color(matplotlib.colors.to_hex(np.array(matplotlib.colors.to_rgb("#FFC422"))*(1-k_)+np.array([1,0.97,0.85])*k_))
    rope1.set_data([bf,px-0.025],[top[-1],EW]); rope2.set_data([bf,px-0.025],[bot[-1],EW])
    trail.set_data([max(-0.05,px-0.75),px-0.03],[EW+0.02,EW+0.02]) if not done else trail.set_data([],[])
    if f>=FR:
        g=(f-FR)/20.0
        if g<=1.2:
            r=sp_spd*g*2.6
            sx_=1.0+np.cos(sp_ang)*r/XR; sy_=EW+np.sin(sp_ang)*r
            spark.set_offsets(np.column_stack([sx_,sy_])); spark.set_sizes(np.full(NS,160*(1.25-g)))
            spark.set_facecolor(sp_col); spark.set_alpha(min(1,max(0,1.15-g)))
        else: spark.set_offsets(np.empty((0,2)))
    else: spark.set_offsets(np.empty((0,2)))
    return []
FuncAnimation(fig,draw,frames=FR+HOLD,blit=False).save(OUT,writer=PillowWriter(fps=25))
