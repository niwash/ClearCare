"""Render study figures from the frozen descriptive tables."""
import csv
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
OUT=Path(__file__).resolve().parent
COLORS=["#24746c","#d2a648","#b44d4d","#c7cbd0"]
def load(name):
 with (OUT/name).open() as f:
  return [{k:(v if k in ("regulation","earlier_judgment") else int(v)) for k,v in r.items()} for r in csv.DictReader(f)]
def main():
 rows=load("by-earlier-judgment.csv")
 rows.sort(key=lambda r:["Compliant","Substantially compliant","Not compliant"].index(r["earlier_judgment"]))
 plt.rcParams.update({"font.family":"DejaVu Sans","font.size":11})
 fig,axes=plt.subplots(1,2,figsize=(15,5.4))
 for ax,conditional in zip(axes,(False,True)):
  left=[0]*3
  columns=["later_compliant","later_substantially_compliant","later_not_compliant"]+([] if conditional else ["omitted"])
  for column,color in zip(columns,COLORS):
   vals=[100*r[column]/r["reassessed" if conditional else "with_later_report"] for r in rows]
   ax.barh(range(3),vals,left=left,height=.6,color=color,label=column.replace("later_","").replace("_"," ").capitalize())
   left=[a+b for a,b in zip(left,vals)]
  ax.set_yticks(range(3),[r["earlier_judgment"] for r in rows]);ax.set_ylim(2.8,-.5)
  ax.set_xlim(0,100);ax.set_xlabel("Percentage")
  ax.set_title("Among later reports" if not conditional else "Among reassessments")
  for i,r in enumerate(rows):
   n=r["reassessed" if conditional else "with_later_report"]
   homes=r["homes_reassessed" if conditional else "homes_followup"]
   ax.text(0,i+.47,f"n = {n:,}, homes = {homes}",fontsize=9)
 axes[0].legend(loc="upper center",bbox_to_anchor=(1.05,-.17),ncol=4,frameon=False)
 fig.suptitle("Judgements in the next loaded report, by earlier judgement")
 fig.subplots_adjust(bottom=.25,wspace=.48,top=.83,left=.15)
 fig.savefig(OUT/"earlier-judgment.png",dpi=180);plt.close(fig)
 rows=sorted(load("denominators.csv"),key=lambda r:100*r["reassessed"]/r["with_later_report"])
 fig,ax=plt.subplots(figsize=(12,12))
 ax.barh([r["regulation"] for r in rows],[100*r["reassessed"]/r["with_later_report"] for r in rows],color=COLORS[0])
 for i,r in enumerate(rows):
  ax.text(101,i,f'{r["reassessed"]:,}/{r["with_later_report"]:,}   |   {r["homes_reassessed"]}',va="center",fontsize=9)
 ax.text(101,len(rows), "Rechecks / follow-ups | homes rechecked",fontsize=9)
 ax.set_xlim(0,145);ax.set_xticks([0,25,50,75,100])
 ax.set_xlabel("Reassessed at the next report (%)");ax.set_title("Reassessment coverage by regulation")
 fig.tight_layout();fig.savefig(OUT/"regulation-coverage.png",dpi=180);plt.close(fig)
if __name__=="__main__":main()
