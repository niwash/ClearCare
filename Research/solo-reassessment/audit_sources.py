import json,zipfile,hashlib,datetime
from pathlib import Path
import requests,pymupdf
OUT=Path(__file__).resolve().parent
IDS=(362, 363, 1, 2, 990, 989, 374, 373, 102, 101, 434, 430)
def main():
 records=[]
 with zipfile.ZipFile(OUT/"snapshot.zip") as z:
  for rid in IDS:
   r=json.loads(z.read(f"reports/{rid}.json"))
   f=r["report_file"]; sha=f["sha256"]
   target=OUT/"audit-pdfs"/f"{rid}.pdf"
   target.parent.mkdir(exist_ok=True)
   if not target.exists():
    response=requests.get(f["url"],timeout=60);response.raise_for_status();data=response.content
    assert hashlib.sha256(data).hexdigest()==sha
    target.write_bytes(data)
   assert hashlib.sha256(target.read_bytes()).hexdigest()==sha
   pages=[]
   with pymupdf.open(target) as doc:
    for i,page in enumerate(doc):
     text=page.get_text(sort=True)
     if "Appendix 1" in text and i>2:
      pages.append({"page":i+1,"text":text})
      if rid == 990:
       pages.append({"page":i+2,"text":doc[i+1].get_text(sort=True).split("Compliance Plan")[0]})
   records.append({"report_id":rid,"centre_id":r["centre_id"],"centre_name":r["centre_name"],"inspection_date":r["inspection_date"],"url":f["url"],"sha256":sha,"exported":r["regulations"],"appendix_pages":pages})
 (OUT/"audit-evidence.json").write_text(json.dumps(records,indent=2),encoding="utf8")
 for r in records:
  print("\nREPORT",r["report_id"],r["centre_name"],"EXPORTED",len(r["exported"]))
  for page in r["appendix_pages"]:print("PAGE",page["page"],page["text"])
if __name__=="__main__": main()
